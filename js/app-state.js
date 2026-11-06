/**
 * state.js - Manejo del estado centralizado con Supabase Cloud
 */

const StateManager = {
    data: {
        collaborators: [],
        users: [],
        vacationrequests: [],
        vacationdays: [],
        permissions: [],
        compensatoryrests: [],
        officemeetings: [],
        incapacities: [],
        authorizedoutings: [],
        vacationrules: {
            pre2023: [
                { years: 1, days: 6 }, { years: 2, days: 8 }, { years: 3, days: 10 }, { years: 4, days: 12 }, { years: 5, days: 14 },
                { years: 10, days: 16 }, { years: 15, days: 18 }, { years: 20, days: 20 }, { years: 25, days: 22 }, { years: 30, days: 24 }
            ],
            post2023: [
                { years: 1, days: 12 }, { years: 2, days: 14 }, { years: 3, days: 16 }, { years: 4, days: 18 }, { years: 5, days: 20 },
                { years: 6, days: 22 }, { years: 11, days: 24 }, { years: 16, days: 26 }, { years: 21, days: 28 }, { years: 26, days: 30 }, { years: 31, days: 32 }
            ]
        },
        currentUser: null
    },

    async init() {
        try {
            console.log("StateManager: Iniciando sincronización con Supabase Cloud...");

            const mergeRowsById = (primary = [], secondary = []) => {
                const map = new Map();
                [...primary, ...secondary].forEach(row => {
                    if (row && row.id !== undefined && row.id !== null) {
                        map.set(row.id, row);
                    }
                });
                return Array.from(map.values());
            };
            
            // Función interna para sincronizar una tabla individual con registro de errores
            const syncTable = async (tableName, propertyName) => {
                try {
                    const data = await this.fetchAllRows(tableName);
                    this.data[propertyName] = data || [];
                    console.log(`StateManager: ✓ Sincronizada tabla [${tableName}] (${this.data[propertyName].length} registros)`);
                    return true;
                } catch (e) {
                    console.warn(`StateManager: ⚠ No se pudo cargar [${tableName}]. Requerirá sesión activa.`);
                    this.data[propertyName] = []; 
                    return false;
                }
            };

            // Ejecutar sincronizaciones en paralelo
            await Promise.all([
                syncTable('collaborators', 'collaborators'),
                syncTable('users', 'users'),
                syncTable('vacation_requests', 'vacationrequests'),
                syncTable('vacation_days', 'vacationdays'),
                syncTable('permissions', 'permissions'),
                syncTable('compensatory_rest_days', 'compensatoryrests'),
                syncTable('offsite_meetings', 'officemeetings'),
                syncTable('incapacities', 'incapacities'),
                syncTable('authorized_outings', 'authorizedoutings')
            ]);

            const restoreLocalBackup = async (storageKey, propertyName, tableName) => {
                const raw = localStorage.getItem(storageKey);
                if (!raw) return;

                const parsedLocal = JSON.parse(raw);
                if (parsedLocal.length > 0) {
                    console.log(`StateManager: ⇅ Detectados ${parsedLocal.length} registros locales en [${propertyName}]. Reconciliando...`);
                    try {
                        if (!this.data[propertyName] || this.data[propertyName].length === 0) {
                            const { error } = await supabase.from(tableName).upsert(parsedLocal);
                            if (error) throw error;
                            const { data } = await supabase.from(tableName).select('*');
                            this.data[propertyName] = mergeRowsById(data || [], parsedLocal);
                        } else {
                            this.data[propertyName] = mergeRowsById(this.data[propertyName], parsedLocal);
                        }
                    } catch (migrationError) {
                        console.warn(`StateManager: ⚠ Fallback local para [${propertyName}]`, migrationError);
                        this.data[propertyName] = mergeRowsById(this.data[propertyName] || [], parsedLocal);
                    }
                } else if (!this.data[propertyName] || this.data[propertyName].length === 0) {
                    this.data[propertyName] = parsedLocal;
                }
            };

            await restoreLocalBackup('vacaciones_permissions_backup', 'permissions', 'permissions');
            await restoreLocalBackup('vacaciones_compensatory_backup', 'compensatoryrests', 'compensatory_rest_days');
            await restoreLocalBackup('vacaciones_offsite_meetings_backup', 'officemeetings', 'offsite_meetings');
            await restoreLocalBackup('vacaciones_incapacities_backup', 'incapacities', 'incapacities');
            await restoreLocalBackup('vacaciones_authorized_outings_backup', 'authorizedoutings', 'authorized_outings');

            // Restaurar sesión de usuario (si existe localmente)
            const savedUser = localStorage.getItem('vacaciones_user_session');
            if (savedUser) {
                this.data.currentUser = JSON.parse(savedUser);
            }

            console.log(`StateManager: Sincronización completada. Colaboradores: ${this.data.collaborators.length}`);
            return true;
        } catch (error) {
            console.error("StateManager: Error crítico durante el inicio:", error);
            return false;
        }
    },

    // Función helper para traer todas las filas paginando de 1000 en 1000 (Límite de Supabase)
    async fetchAllRows(tableName) {
        let allData = [];
        let from = 0;
        let to = 999;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .range(from, to);

            if (error) throw error;
            
            if (data && data.length > 0) {
                allData = allData.concat(data);
                if (data.length < 1000) {
                    hasMore = false;
                } else {
                    from += 1000;
                    to += 1000;
                }
            } else {
                hasMore = false;
            }
        }
        return allData;
    },

    // --- AUTH METHODS ---
    async login(username, password) {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (user) {
            if (user.status === 'suspended') throw new Error('Cuenta suspendida.');
            this.data.currentUser = user;
            localStorage.setItem('vacaciones_user_session', JSON.stringify(user));
            return user;
        }
        throw new Error('Usuario o contraseña incorrectos.');
    },

    logout() {
        this.data.currentUser = null;
        localStorage.removeItem('vacaciones_user_session');
    },

    getCurrentUser() {
        return this.data.currentUser;
    },

    getUsers() {
        return this.data.users;
    },

    async saveUser(userData) {
        const id = userData.id || Date.now().toString();
        const { error } = await supabase.from('users').upsert({ ...userData, id });
        if (error) throw error;
        await this.init();
    },

    async deleteUser(id) {
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) throw error;
        await this.init();
    },

    // --- COLLABORATOR METHODS ---
    getCollaborators(filter = 'all', search = '') {
        let list = [...this.data.collaborators];
        
        // FILTRO DE SEGURIDAD: Nunca mostrar el perfil de sistema
        list = list.filter(c => c.id !== 'SYS-CONFIG');

        if (filter === 'active') list = list.filter(c => c.status === 'active');
        if (filter === 'inactive') list = list.filter(c => c.status === 'inactive');
        if (search) {
            const query = search.toLowerCase();
            list = list.filter(c => c.name.toLowerCase().includes(query));
        }
        
        // Orden alfabético por nombre
        list.sort((a, b) => a.name.localeCompare(b.name));
        
        return list;
    },

    getCollaboratorById(id) {
        return this.data.collaborators.find(c => c.id === id);
    },

    async saveCollaborator(collaborator, oldId = null) {
        const now = new Date().toISOString();
        const payload = { ...collaborator, lastupdate: now };
        
        if (oldId && oldId !== payload.id) {
            await supabase.from('collaborators').delete().eq('id', oldId);
        }

        const { error } = await supabase.from('collaborators').upsert(payload);
        if (error) throw error;
        await this.init();
        return true;
    },

    async bulkSaveCollaborators(newList) {
        const now = new Date().toISOString();
        const payloads = newList.map(c => ({ ...c, lastupdate: now }));
        const { error } = await supabase.from('collaborators').upsert(payloads);
        if (error) throw error;
        await this.init();
        return true;
    },

    async deleteCollaborator(id) {
        try {
            // ELIMINACIÓN DEFINITIVA (HARD DELETE)
            await supabase.from('vacation_days').delete().eq('collaboratorid', id);
            await supabase.from('vacation_requests').delete().eq('collaboratorid', id);
            await supabase.from('compensatory_rest_days').delete().eq('collaboratorid', id);

            const compBackup = JSON.parse(localStorage.getItem('vacaciones_compensatory_backup') || '[]');
            if (compBackup.length > 0) {
                const filteredComp = compBackup.filter(r => r.collaboratorid !== id);
                localStorage.setItem('vacaciones_compensatory_backup', JSON.stringify(filteredComp));
                this.data.compensatoryrests = filteredComp;
            }

            const { error } = await supabase.from('collaborators').delete().eq('id', id);
            if (error) throw error;
            await this.init();
        } catch (err) {
            console.error('Error en eliminación definitiva:', err);
            throw err;
        }
    },

    getStats() {
        const all = this.data.collaborators;
        const today = new Date().toISOString().split('T')[0];
        const onLeaveCount = (this.data.vacationdays || []).filter(day => 
            day.actualdate === today && (day.status === 'approved' || day.status === 'programmed')
        ).length;

        return {
            total: all.length,
            active: all.filter(c => c.status === 'active').length,
            inactive: all.filter(c => c.status === 'inactive').length,
            onLeave: onLeaveCount
        };
    },

    // --- VACATION METHODS ---
    getVacationRequests(collaboratorId) {
        let list = this.data.vacationrequests;
        // Ocultar peticiones de sistema
        list = list.filter(r => r.id !== 'SYS-HOLIDAYS');
        
        if (!collaboratorId) return list;
        return list.filter(r => r.collaboratorid === collaboratorId);
    },

    getVacationDays(collaboratorId, requestId = null) {
        let days = this.data.vacationdays;
        // Filtrar dias del sistema por defecto
        if (!collaboratorId) {
            days = days.filter(d => d.collaboratorid !== 'SYS-CONFIG');
        }
        
        if (collaboratorId) days = days.filter(d => d.collaboratorid === collaboratorId);
        if (requestId) days = days.filter(d => d.requestid === requestId);
        return days;
    },

    async saveVacationRequest(request, daysArr) {
        const reqid = request.id || 'req-' + Date.now();
        const now = new Date().toISOString();

        const { error: reqErr } = await supabase.from('vacation_requests').upsert({
            ...request, id: reqid, lastupdate: now
        });
        if (reqErr) throw reqErr;

        const daysPayload = daysArr.map(d => ({
            ...d, 
            id: d.id || `d-${Math.random().toString(36).substr(2, 9)}`,
            requestid: reqid,
            lastupdate: now
        }));

        const { error: daysErr } = await supabase.from('vacation_days').upsert(daysPayload);
        if (daysErr) throw daysErr;

        await this.init();
        return reqid;
    },

    async bulkSaveHistory(allRequests, allDays) {
        const now = new Date().toISOString();

        // Asegurar que tengan lastupdate
        const reqsPayload = allRequests.map(r => ({ ...r, lastupdate: now }));
        const daysPayload = allDays.map(d => ({ ...d, lastupdate: now }));

        // Upsert masivo de solicitudes (en bloques de 1000 máximo que es el límite normal de upsert, aunque supabase aguanta bien arreglos directos)
        // Mandamos todo completo. Supabase-js internamente fragmenta o postgREST aguanta si no es excesivo.
        // Si el arreglo es muy gigante (ej > 5000) deberíamos ciclar el array, pero 200-1000 pasa de un golpe sin problemas.
        
        let reqsError = null;
        if (reqsPayload.length > 0) {
            const { error } = await supabase.from('vacation_requests').upsert(reqsPayload);
            reqsError = error;
        }

        if (reqsError) throw reqsError;

        let daysError = null;
        if (daysPayload.length > 0) {
            const { error } = await supabase.from('vacation_days').upsert(daysPayload);
            daysError = error;
        }

        if (daysError) throw daysError;

        await this.init();
        return true;
    },

    async updateVacationDay(dayId, updates) {
        const { error } = await supabase.from('vacation_days')
            .update({ ...updates, lastupdate: new Date().toISOString() })
            .eq('id', dayId);
        if (error) throw error;
        await this.init();
    },

    async deleteVacationRequest(reqid) {
        await supabase.from('vacation_requests').delete().eq('id', reqid);
        // Supabase debería borrar cascada si está configurado, o borramos manual:
        await supabase.from('vacation_days').delete().eq('requestid', reqid);
        await this.init();
    },

    // --- PERMISSION METHODS ---
    getPermissions(collaboratorId = null) {
        let list = this.data.permissions || [];
        if (collaboratorId) list = list.filter(p => p.collaboratorid === collaboratorId);
        return list.sort((a,b) => new Date(b.date) - new Date(a.date));
    },

    async savePermission(permission) {
        const payload = {
            ...permission,
            id: permission.id || `perm-${Date.now()}`,
            lastupdate: new Date().toISOString()
        };
        
        // Sanitizar el payload para asegurar que solo contenga columnas existentes en DB
        const sanitizedPayload = {
            id: payload.id,
            collaboratorid: payload.collaboratorid,
            date: payload.date,
            start_time: payload.start_time,
            end_time: payload.end_time,
            total_hours: payload.total_hours,
            notes: payload.notes,
            lastupdate: payload.lastupdate
        };

        // Intentar guardar en Supabase. Si la tabla no existe o falla, guardamos localmente como fallback.
        try {
            const { error } = await supabase.from('permissions').upsert(sanitizedPayload);
            if (error) throw error;
        } catch (err) {
            console.warn("StateManager: Guardando permiso localmente debido a falta de tabla 'permissions' en DB.", err);
            const current = JSON.parse(localStorage.getItem('vacaciones_permissions_backup') || '[]');
            const index = current.findIndex(p => p.id === payload.id);
            if (index > -1) current[index] = payload; else current.push(payload);
            localStorage.setItem('vacaciones_permissions_backup', JSON.stringify(current));
            
            // Forzar actualización de la data local del StateManager
            this.data.permissions = current;
            return payload;
        }

        await this.init();
        return payload;
    },

    async deletePermission(id) {
        try {
            const { error } = await supabase.from('permissions').delete().eq('id', id);
            if (error) throw error;
        } catch (err) {
            console.warn("StateManager: Error en nube, procediendo con borrado local.", err);
        }
        
        // --- Siempre borrar del respaldo local ---
        const current = JSON.parse(localStorage.getItem('vacaciones_permissions_backup') || '[]');
        const filtered = current.filter(p => p.id !== id);
        localStorage.setItem('vacaciones_permissions_backup', JSON.stringify(filtered));
        this.data.permissions = filtered;
        
        await this.init();
    },

    getCompensatoryRests(collaboratorId = null) {
        let list = this.data.compensatoryrests || [];
        if (collaboratorId) list = list.filter(r => r.collaboratorid === collaboratorId);

        return [...list].sort((a, b) => {
            const dateA = new Date(`${a.rest_date || a.date || '1970-01-01'}T12:00:00`);
            const dateB = new Date(`${b.rest_date || b.date || '1970-01-01'}T12:00:00`);
            return dateB - dateA;
        });
    },

    getCompensatoryRestById(id) {
        return (this.data.compensatoryrests || []).find(r => r.id === id);
    },

    async saveCompensatoryRest(rest) {
        const payload = {
            ...rest,
            id: rest.id || `comp-${Date.now()}`,
            status: rest.status || 'programmed',
            lastupdate: new Date().toISOString()
        };

        const sanitizedPayload = {
            id: payload.id,
            collaboratorid: payload.collaboratorid,
            event_date: payload.event_date,
            reason: payload.reason,
            rest_date: payload.rest_date,
            rest_type: payload.rest_type,
            start_time: payload.start_time,
            end_time: payload.end_time,
            total_hours: payload.total_hours,
            status: payload.status,
            notes: payload.notes,
            lastupdate: payload.lastupdate
        };

        try {
            const { error } = await supabase.from('compensatory_rest_days').upsert(sanitizedPayload);
            if (error) throw error;
        } catch (err) {
            console.warn("StateManager: Guardando descanso compensatorio localmente debido a falta de tabla 'compensatory_rest_days' en DB.", err);
        }

        const current = JSON.parse(localStorage.getItem('vacaciones_compensatory_backup') || '[]');
        const index = current.findIndex(r => r.id === payload.id);
        if (index > -1) current[index] = payload; else current.push(payload);
        localStorage.setItem('vacaciones_compensatory_backup', JSON.stringify(current));
        this.data.compensatoryrests = current;

        await this.init();
        return payload;
    },

    async deleteCompensatoryRest(id) {
        try {
            const { error } = await supabase.from('compensatory_rest_days').delete().eq('id', id);
            if (error) throw error;
        } catch (err) {
            console.warn("StateManager: Error en nube, procediendo con borrado local de descanso compensatorio.", err);
        }

        const current = JSON.parse(localStorage.getItem('vacaciones_compensatory_backup') || '[]');
        const filtered = current.filter(r => r.id !== id);
        localStorage.setItem('vacaciones_compensatory_backup', JSON.stringify(filtered));
        this.data.compensatoryrests = filtered;

        await this.init();
    },

    // --- OFFSITE MEETING METHODS ---
    getOffsiteMeetings(collaboratorId = null) {
        let list = this.data.officemeetings || [];
        if (collaboratorId) list = list.filter(m => m.collaboratorid === collaboratorId);
        return [...list].sort((a, b) => {
            const dateA = new Date(`${a.meeting_date || '1970-01-01'}T12:00:00`);
            const dateB = new Date(`${b.meeting_date || '1970-01-01'}T12:00:00`);
            return dateB - dateA;
        });
    },

    getOffsiteMeetingById(id) {
        return (this.data.officemeetings || []).find(m => m.id === id);
    },

    async saveOffsiteMeeting(meeting) {
        const payload = {
            ...meeting,
            id: meeting.id || `meeting-${Date.now()}`,
            lastupdate: new Date().toISOString()
        };
        const sanitizedPayload = {
            id: payload.id,
            collaboratorid: payload.collaboratorid,
            meeting_date: payload.meeting_date,
            start_time: payload.start_time,
            end_time: payload.end_time,
            total_hours: payload.total_hours,
            notes: payload.notes,
            lastupdate: payload.lastupdate
        };
        try {
            const { error } = await supabase.from('offsite_meetings').upsert(sanitizedPayload);
            if (error) throw error;
        } catch (err) {
            console.warn("StateManager: Guardando junta fuera de oficina localmente debido a falta de tabla 'offsite_meetings' en DB.", err);
        }
        const current = JSON.parse(localStorage.getItem('vacaciones_offsite_meetings_backup') || '[]');
        const index = current.findIndex(m => m.id === payload.id);
        if (index > -1) current[index] = payload; else current.push(payload);
        localStorage.setItem('vacaciones_offsite_meetings_backup', JSON.stringify(current));
        this.data.officemeetings = current;
        await this.init();
        return payload;
    },

    async deleteOffsiteMeeting(id) {
        try {
            const { error } = await supabase.from('offsite_meetings').delete().eq('id', id);
            if (error) throw error;
        } catch (err) {
            console.warn("StateManager: Error en nube, procediendo con borrado local de junta fuera de oficina.", err);
        }
        const current = JSON.parse(localStorage.getItem('vacaciones_offsite_meetings_backup') || '[]');
        const filtered = current.filter(m => m.id !== id);
        localStorage.setItem('vacaciones_offsite_meetings_backup', JSON.stringify(filtered));
        this.data.officemeetings = filtered;
        await this.init();
    },

    // --- INCAPACITY METHODS ---
    getIncapacities(collaboratorId = null) {
        let list = this.data.incapacities || [];
        if (collaboratorId) list = list.filter(i => i.collaboratorid === collaboratorId);
        return [...list].sort((a, b) => {
            const dateA = new Date(`${a.start_date || '1970-01-01'}T12:00:00`);
            const dateB = new Date(`${b.start_date || '1970-01-01'}T12:00:00`);
            return dateB - dateA;
        });
    },

    getIncapacityById(id) {
        return (this.data.incapacities || []).find(i => i.id === id);
    },

    async saveIncapacity(incapacity) {
        const payload = {
            ...incapacity,
            id: incapacity.id || `incap-${Date.now()}`,
            lastupdate: new Date().toISOString()
        };
        const sanitizedPayload = {
            id: payload.id,
            collaboratorid: payload.collaboratorid,
            start_date: payload.start_date,
            end_date: payload.end_date,
            type: payload.type || 'full_day',
            notes: payload.notes,
            lastupdate: payload.lastupdate
        };

        try {
            const { error } = await supabase.from('incapacities').upsert(sanitizedPayload);
            if (error) throw error;
        } catch (err) {
            console.warn("StateManager: Guardando incapacidad localmente debido a falta de tabla 'incapacities' en DB.", err);
        }

        const current = JSON.parse(localStorage.getItem('vacaciones_incapacities_backup') || '[]');
        const index = current.findIndex(i => i.id === payload.id);
        if (index > -1) current[index] = payload; else current.push(payload);
        localStorage.setItem('vacaciones_incapacities_backup', JSON.stringify(current));
        this.data.incapacities = current;
        await this.init();
        return payload;
    },

    async deleteIncapacity(id) {
        try {
            const { error } = await supabase.from('incapacities').delete().eq('id', id);
            if (error) throw error;
        } catch (err) {
            console.warn("StateManager: Error en nube, procediendo con borrado local de incapacidad.", err);
        }
        const current = JSON.parse(localStorage.getItem('vacaciones_incapacities_backup') || '[]');
        const filtered = current.filter(i => i.id !== id);
        localStorage.setItem('vacaciones_incapacities_backup', JSON.stringify(filtered));
        this.data.incapacities = filtered;
        await this.init();
    },

    // --- AUTHORIZED OUTING METHODS ---
    getAuthorizedOutings(collaboratorId = null) {
        let list = this.data.authorizedoutings || [];
        if (collaboratorId) list = list.filter(o => o.collaboratorid === collaboratorId);
        return [...list].sort((a, b) => {
            const dateA = new Date(`${a.outing_date || '1970-01-01'}T12:00:00`);
            const dateB = new Date(`${b.outing_date || '1970-01-01'}T12:00:00`);
            return dateB - dateA;
        });
    },

    getAuthorizedOutingById(id) {
        return (this.data.authorizedoutings || []).find(o => o.id === id);
    },

    async saveAuthorizedOuting(outing) {
        const payload = {
            ...outing,
            id: outing.id || `outing-${Date.now()}`,
            lastupdate: new Date().toISOString()
        };
        const sanitizedPayload = {
            id: payload.id,
            collaboratorid: payload.collaboratorid,
            outing_date: payload.outing_date,
            reason: payload.reason,
            departure_time: payload.departure_time,
            notes: payload.notes,
            lastupdate: payload.lastupdate
        };

        try {
            const { error } = await supabase.from('authorized_outings').upsert(sanitizedPayload);
            if (error) throw error;
        } catch (err) {
            console.warn("StateManager: Guardando salida autorizada localmente debido a falta de tabla 'authorized_outings' en DB.", err);
        }

        const current = JSON.parse(localStorage.getItem('vacaciones_authorized_outings_backup') || '[]');
        const index = current.findIndex(o => o.id === payload.id);
        if (index > -1) current[index] = payload; else current.push(payload);
        localStorage.setItem('vacaciones_authorized_outings_backup', JSON.stringify(current));
        this.data.authorizedoutings = current;
        await this.init();
        return payload;
    },

    async deleteAuthorizedOuting(id) {
        try {
            const { error } = await supabase.from('authorized_outings').delete().eq('id', id);
            if (error) throw error;
        } catch (err) {
            console.warn("StateManager: Error en nube, procediendo con borrado local de salida autorizada.", err);
        }
        const current = JSON.parse(localStorage.getItem('vacaciones_authorized_outings_backup') || '[]');
        const filtered = current.filter(o => o.id !== id);
        localStorage.setItem('vacaciones_authorized_outings_backup', JSON.stringify(filtered));
        this.data.authorizedoutings = filtered;
        await this.init();
    },

    async deletePermissionsByMonth(year, month) {
        // month is 0-indexed (0=Enero, 11=Diciembre)
        const targetPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        
        try {
            // Eliminar de Supabase (si existe tabla)
            const { error } = await supabase.from('permissions').delete().like('date', `${targetPrefix}%`);
            if (error) throw error;
        } catch (err) {
            console.warn("StateManager: Error o falta de tabla al borrar por mes en DB.", err);
        }
        
        // --- Siempre borrar del respaldo local ---
        const current = JSON.parse(localStorage.getItem('vacaciones_permissions_backup') || '[]');
        const filtered = current.filter(p => !p.date.startsWith(targetPrefix));
        localStorage.setItem('vacaciones_permissions_backup', JSON.stringify(filtered));
        this.data.permissions = filtered;
        
        await this.init();
    },

    // --- HOLIDAY METHODS (SCHEMA-SAFE) ---
    getHolidays() {
        // Leemos desde el almacenamiento local para evadir las reglas de la base de datos
        const savedArgs = localStorage.getItem('vacaciones_holidays_json');
        if (!savedArgs) return [];
        return JSON.parse(savedArgs).sort((a,b) => new Date(a.actualdate) - new Date(b.actualdate));
    },

    async saveHoliday(dateStr, title) {
        const current = this.getHolidays();
        const payload = {
            id: `hol-${Date.now()}`,
            collaboratorid: 'SYS-CONFIG',
            actualdate: dateStr,
            notes: title,
            status: 'holiday'
        };
        current.push(payload);
        localStorage.setItem('vacaciones_holidays_json', JSON.stringify(current));
    },

    async deleteHoliday(id) {
        let current = this.getHolidays();
        current = current.filter(h => h.id !== id);
        localStorage.setItem('vacaciones_holidays_json', JSON.stringify(current));
    },

    getVacationRules() {
        return this.data.vacationrules;
    }
};

window.StateManager = StateManager;
