/**
 * state.js - Manejo del estado centralizado con Almacenamiento Local (Offline)
 * Sin dependencias de Supabase o bases de datos en la nube.
 */

const LocalDB = {
    getKey(table) {
        return `vacaciones_db_${table}`;
    },
    read(table) {
        try {
            const dataStr = localStorage.getItem(this.getKey(table));
            return dataStr ? JSON.parse(dataStr) : [];
        } catch (e) {
            console.error(`Error leyendo tabla ${table} de LocalStorage`, e);
            return [];
        }
    },
    write(table, data) {
        try {
            localStorage.setItem(this.getKey(table), JSON.stringify(data));
        } catch (e) {
            console.error(`Error guardando tabla ${table} en LocalStorage (Limpiar caché o excedió límite)`, e);
            throw new Error(`Memoria llena. No se pudo guardar en ${table}.`);
        }
    }
};

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
            console.log("StateManager: Iniciando sincronización con Base de Datos Local (OFFLINE)...");
            
            // Cargar Tablas desde LocalStorage
            this.data.collaborators = LocalDB.read('collaborators');
            this.data.users = LocalDB.read('users');
            this.data.vacationrequests = LocalDB.read('vacation_requests');
            this.data.vacationdays = LocalDB.read('vacation_days');

            // Crear usuario administrador por defecto si es la primera vez
            if (this.data.users.length === 0) {
                const defaultAdmin = {
                    id: 'admin_default',
                    name: 'Administrador Local',
                    username: 'admin',
                    password: '123',
                    role: 'admin',
                    status: 'active',
                    lastupdate: new Date().toISOString()
                };
                this.data.users.push(defaultAdmin);
                LocalDB.write('users', this.data.users);
            }

            // Restaurar sesión de usuario (si existe localmente)
            const savedUser = localStorage.getItem('vacaciones_user_session');
            if (savedUser) {
                this.data.currentUser = JSON.parse(savedUser);
            }

            console.log("StateManager: Datos locales cargados y unificados correctamente.");
            return true;
        } catch (error) {
            console.error("Error al inicializar StateManager Local:", error);
            throw error;
        }
    },

    // --- AUTH METHODS ---
    async login(username, password) {
        // Simular latencia de red para evitar que la UI parpadee muy rápido si hubiera loaders
        await new Promise(r => setTimeout(r, 100)); 
        
        const user = this.data.users.find(u => u.username === username && u.password === password);

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
        const payload = { ...userData, id };
        
        let users = LocalDB.read('users');
        const existingIdx = users.findIndex(u => u.id === id);
        
        if (existingIdx > -1) {
            users[existingIdx] = payload;
        } else {
            users.push(payload);
        }
        
        LocalDB.write('users', users);
        await this.init(); // Refrescar cache
    },

    async deleteUser(id) {
        let users = LocalDB.read('users');
        users = users.filter(u => u.id !== id);
        LocalDB.write('users', users);
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
        const payload = { ...collaborator, lastupdate: now };
        
        let list = LocalDB.read('collaborators');
        
        if (oldId && oldId !== payload.id) {
            list = list.filter(c => c.id !== oldId);
        }

        const existingIdx = list.findIndex(c => c.id === payload.id);
        if (existingIdx > -1) {
            list[existingIdx] = payload;
        } else {
            list.push(payload);
        }
        
        LocalDB.write('collaborators', list);
        await this.init();
        return true;
    },

    async bulkSaveCollaborators(newList) {
        const now = new Date().toISOString();
        // Generar un mapa para reemplazar o insertar rápidamente
        let list = LocalDB.read('collaborators');
        
        newList.forEach(c => {
            const payload = { ...c, lastupdate: now };
            const existingIdx = list.findIndex(exist => exist.id === payload.id);
            if (existingIdx > -1) {
                list[existingIdx] = payload;
            } else {
                list.push(payload);
            }
        });
        
        LocalDB.write('collaborators', list);
        await this.init();
        return true;
    },

    async deleteCollaborator(id) {
        // ELIMINACIÓN DEFINITIVA (HARD DELETE) LOCAL
        try {
            // 1. Borrar días individuales
            let days = LocalDB.read('vacation_days');
            days = days.filter(d => d.collaboratorid !== id);
            LocalDB.write('vacation_days', days);
            
            // 2. Borrar solicitudes de vacaciones
            let requests = LocalDB.read('vacation_requests');
            requests = requests.filter(r => r.collaboratorid !== id);
            LocalDB.write('vacation_requests', requests);
            
            // 3. Borrar el colaborador
            let cols = LocalDB.read('collaborators');
            cols = cols.filter(c => c.id !== id);
            LocalDB.write('collaborators', cols);
            
            await this.init();
        } catch (err) {
            console.error('Error en eliminación definitiva local:', err);
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
        const reqid = request.id || 'req-' + Date.now() + '-' + Math.floor(Math.random()*1000);
        const now = new Date().toISOString();

        // 1. Guardar Cabecera
        let requestsList = LocalDB.read('vacation_requests');
        const reqPayload = { ...request, id: reqid, lastupdate: now };
        const reqIdx = requestsList.findIndex(r => r.id === reqid);
        if (reqIdx > -1) {
            requestsList[reqIdx] = reqPayload;
        } else {
            requestsList.push(reqPayload);
        }
        LocalDB.write('vacation_requests', requestsList);

        // 2. Guardar Días
        let daysList = LocalDB.read('vacation_days');
        const mappedDays = daysArr.map(d => ({
            ...d, 
            id: d.id || `d-${Math.random().toString(36).substr(2, 9)}`,
            requestid: reqid,
            lastupdate: now
        }));

        mappedDays.forEach(md => {
            const dIdx = daysList.findIndex(x => x.id === md.id);
            if (dIdx > -1) {
                daysList[dIdx] = md;
            } else {
                daysList.push(md);
            }
        });
        LocalDB.write('vacation_days', daysList);

        await this.init();
        return reqid;
    },

    async updateVacationDay(dayId, updates) {
        let daysList = LocalDB.read('vacation_days');
        const dIdx = daysList.findIndex(d => d.id === dayId);
        
        if (dIdx > -1) {
            daysList[dIdx] = { ...daysList[dIdx], ...updates, lastupdate: new Date().toISOString() };
            LocalDB.write('vacation_days', daysList);
            await this.init();
        } else {
            throw new Error('Día no encontrado localmente');
        }
    },

    async deleteVacationRequest(reqid) {
        let reqs = LocalDB.read('vacation_requests');
        reqs = reqs.filter(r => r.id !== reqid);
        LocalDB.write('vacation_requests', reqs);

        // Opcional: También borrar los días asociados a esta solicitud en Cascada
        let days = LocalDB.read('vacation_days');
        days = days.filter(d => d.requestid !== reqid);
        LocalDB.write('vacation_days', days);

        await this.init();
    },

    getVacationRules() {
        return this.data.vacationrules;
    }
};

window.StateManager = StateManager;
