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
                syncTable('permissions', 'permissions')
            ]);

            // --- REFUERZO DE PERSISTENCIA PARA PERMISOS ---
            // Si la tabla no existe en Supabase o está vacía, intentamos cargar el backup local
            const localPerms = localStorage.getItem('vacaciones_permissions_backup');
            if (localPerms && (!this.data.permissions || this.data.permissions.length === 0)) {
                this.data.permissions = JSON.parse(localPerms);
                console.log(`StateManager: ✓ Cargados ${this.data.permissions.length} permisos desde respaldo local.`);
            }

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
        
        // Intentar guardar en Supabase. Si la tabla no existe o falla, guardamos localmente como fallback.
        try {
            const { error } = await supabase.from('permissions').upsert(payload);
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
            const current = JSON.parse(localStorage.getItem('vacaciones_permissions_backup') || '[]');
            const filtered = current.filter(p => p.id !== id);
            localStorage.setItem('vacaciones_permissions_backup', JSON.stringify(filtered));
            this.data.permissions = filtered;
        }
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
            console.warn("StateManager: Error o falta de tabla al borrar por mes en DB. Usando local.", err);
            const current = JSON.parse(localStorage.getItem('vacaciones_permissions_backup') || '[]');
            const filtered = current.filter(p => !p.date.startsWith(targetPrefix));
            localStorage.setItem('vacaciones_permissions_backup', JSON.stringify(filtered));
            this.data.permissions = filtered;
        }
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
