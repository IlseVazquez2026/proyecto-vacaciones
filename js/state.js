/**
 * state.js - Manejo del estado centralizado con Supabase Cloud
 */

const StateManager = {
    data: {
        collaborators: [],
        users: [],
        vacationrequests: [],
        vacationdays: [],
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
            console.log("StateManager: Iniciando sincronización recursiva con Supabase...");
            
            // Función helper para traer todas las filas paginando de 1000 en 1000
            const fetchAllRows = async (tableName) => {
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
            };

            const [
                collaborators,
                users,
                vacationrequests,
                vacationdays
            ] = await Promise.all([
                fetchAllRows('collaborators'),
                fetchAllRows('users'),
                fetchAllRows('vacation_requests'),
                fetchAllRows('vacation_days')
            ]);

            this.data.collaborators = collaborators || [];
            this.data.users = users || [];
            this.data.vacationrequests = vacationrequests || [];
            this.data.vacationdays = vacationdays || [];

            // Restaurar sesión de usuario (si existe)
            const savedUser = localStorage.getItem('vacaciones_user_session');
            if (savedUser) {
                this.data.currentUser = JSON.parse(savedUser);
            }

            console.log(`StateManager: ${this.data.vacationdays.length} registros de días sincronizados.`);
            return true;
        } catch (error) {
            console.error("Error al inicializar StateManager:", error);
            throw error;
        }
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
        if (!collaboratorId) return this.data.vacationrequests;
        return this.data.vacationrequests.filter(r => r.collaboratorid === collaboratorId);
    },

    getVacationDays(collaboratorId, requestId = null) {
        let days = this.data.vacationdays;
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

    getVacationRules() {
        return this.data.vacationrules;
    }
};

window.StateManager = StateManager;
