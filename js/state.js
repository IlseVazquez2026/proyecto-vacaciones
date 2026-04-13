/**
 * state.js - Manejo del estado centralizado con Supabase Cloud
 */

const StateManager = {
    data: {
        collaborators: [],
        users: [],
        vacationRequests: [],
        vacationDays: [],
        vacationRules: {
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
            console.log("StateManager: Iniciando sincronización con Supabase...");
            
            // Cargar Tablas en Paralelo
            const [
                { data: collaborators },
                { data: users },
                { data: vacationRequests },
                { data: vacationDays }
            ] = await Promise.all([
                supabase.from('collaborators').select('*'),
                supabase.from('users').select('*'),
                supabase.from('vacation_requests').select('*'),
                supabase.from('vacation_days').select('*')
            ]);

            this.data.collaborators = collaborators || [];
            this.data.users = users || [];
            this.data.vacationRequests = vacationRequests || [];
            this.data.vacationDays = vacationDays || [];

            // Restaurar sesión de usuario (si existe localmente)
            const savedUser = localStorage.getItem('vacaciones_user_session');
            if (savedUser) {
                this.data.currentUser = JSON.parse(savedUser);
            }

            console.log("StateManager: Datos sincronizados correctamente.");
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
            .maybeSingle();

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
        await this.init(); // Refrescar cache
    },

    async deleteUser(id) {
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) throw error;
        await this.init();
    },

    // --- COLLABORATOR METHODS ---
    getCollaborators(filter = 'all', search = '') {
        let list = this.data.collaborators;
        if (filter === 'active') list = list.filter(c => c.status === 'active');
        if (filter === 'inactive') list = list.filter(c => c.status === 'inactive');
        if (search) {
            const query = search.toLowerCase();
            list = list.filter(c => c.name.toLowerCase().includes(query));
        }
        return list;
    },

    getCollaboratorById(id) {
        return this.data.collaborators.find(c => c.id === id);
    },

    async saveCollaborator(collaborator, oldId = null) {
        const now = new Date().toISOString();
        const payload = { ...collaborator, lastUpdate: now };
        
        // Si hay un oldId, significa que estamos editando y posiblemente cambiando el ID primario
        if (oldId && oldId !== collaborator.id) {
            // Eliminar viejo y crear nuevo (Supabase no permite cambiar PK fácilmente sin riesgos de integridad)
            // Pero como nuestras tablas tienen FK, debemos hacerlo con cuidado. 
            // En este prototipo, usaremos upsert directo si el ID no cambia, o delete+insert si cambia.
            await supabase.from('collaborators').delete().eq('id', oldId);
        }

        const { error } = await supabase.from('collaborators').upsert(payload);
        if (error) throw error;
        
        await this.init();
        return true;
    },

    async deleteCollaborator(id) {
        const col = this.getCollaboratorById(id);
        if (col) {
            const { error } = await supabase.from('collaborators').update({
                status: 'inactive',
                lastUpdate: new Date().toISOString()
            }).eq('id', id);
            if (error) throw error;
            await this.init();
        }
    },

    getStats() {
        const all = this.data.collaborators;
        const today = new Date().toISOString().split('T')[0];
        const onLeaveCount = (this.data.vacationDays || []).filter(day => 
            day.actualDate === today && (day.status === 'approved' || day.status === 'programmed')
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
        if (!collaboratorId) return this.data.vacationRequests;
        return this.data.vacationRequests.filter(r => r.collaboratorId === collaboratorId);
    },

    getVacationDays(collaboratorId, requestId = null) {
        let days = this.data.vacationDays;
        if (collaboratorId) days = days.filter(d => d.collaboratorId === collaboratorId);
        if (requestId) days = days.filter(d => d.requestId === requestId);
        return days;
    },

    async saveVacationRequest(request, days) {
        const reqId = request.id || 'req-' + Date.now();
        const now = new Date().toISOString();

        // 1. Guardar Cabecera
        const { error: reqErr } = await supabase.from('vacation_requests').upsert({
            ...request, id: reqId, lastUpdate: now
        });
        if (reqErr) throw reqErr;

        // 2. Guardar Días
        const daysPayload = days.map(d => ({
            ...d, 
            id: d.id || `d-${Math.random().toString(36).substr(2, 9)}`,
            requestId: reqId,
            lastUpdate: now
        }));

        const { error: daysErr } = await supabase.from('vacation_days').upsert(daysPayload);
        if (daysErr) throw daysErr;

        await this.init();
        return reqId;
    },

    async updateVacationDay(dayId, updates) {
        const { error } = await supabase.from('vacation_days')
            .update({ ...updates, lastUpdate: new Date().toISOString() })
            .eq('id', dayId);
        if (error) throw error;
        await this.init();
    },

    async deleteVacationRequest(reqId) {
        await supabase.from('vacation_requests').delete().eq('id', reqId);
        await this.init();
    },

    getVacationRules() {
        return this.data.vacationRules;
    }
};
