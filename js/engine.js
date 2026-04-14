/**
 * engine.js - Agente de Control de Vacaciones
 * Encargado de la lógica de saldos, reglas de antigüedad y registro base.
 * Consume y gestiona los datos en StateManager (vacationrequests y vacationdays).
 */

const VacationManager = {
    // Reglas de la legislación mexicana
    getRules() {
        return StateManager.getVacationRules();
    },

    // Helper para generar un objeto de periodo estandarizado
    _createPeriod(col, yearNum, rules, today) {
        const hire = new Date(col.hiredate + 'T12:00:00');
        const anniversary = new Date(hire);
        anniversary.setFullYear(hire.getFullYear() + yearNum);
        
        const startPeriod = new Date(hire);
        startPeriod.setFullYear(hire.getFullYear() + yearNum - 1);

        // Determinar legislación aplicable
        const lawEntry = anniversary >= new Date('2023-01-01') ? 'post2023' : 'pre2023';
        
        // Calcular días según tabla o sobrescritura
        let days = 0;
        const dayOverrides = typeof col.period_overrides === 'string' 
            ? JSON.parse(col.period_overrides) 
            : (col.period_overrides || {});

        if (dayOverrides[yearNum] !== undefined) {
            days = parseInt(dayOverrides[yearNum]);
        } else {
            const currentRules = rules[lawEntry];
            for (const level of currentRules) {
                if (yearNum >= level.years) {
                    days = level.days;
                } else {
                    break;
                }
            }
        }

        return {
            year: yearNum,
            label: `${startPeriod.getFullYear()}-${anniversary.getFullYear()}`,
            activationDate: anniversary.toISOString().split('T')[0],
            days: days,
            law: lawEntry,
            isEarned: anniversary <= today,
            startPeriod: startPeriod // Para utilidad interna
        };
    },

    // Obtener los periodos de aniversario cumplidos o futuros si hay vacaciones programadas
    getAnniversaryPeriods(colId) {
        const col = StateManager.getCollaboratorById(colId);
        if (!col) return [];
        
        const today = new Date();
        let maxDate = new Date(); // Target cutoff date
        
        // Revisar si hay vacaciones solicitadas a futuro para generar los periodos
        const allDays = StateManager.getVacationDays(colId);
        allDays.forEach(d => {
            const dDate = new Date(d.actualdate + 'T12:00:00');
            if (dDate > maxDate) maxDate = dDate;
        });

        const periods = [];
        const rules = this.getRules();
        
        let yearNum = 1;
        while (true) {
            const p = this._createPeriod(col, yearNum, rules, today);
            
            // Si el inicio del periodo ya superó la fecha máxima de las vacaciones agendadas, dejamos de generar periodos.
            if (p.startPeriod > maxDate) {
                break;
            }
            
            periods.push(p);
            yearNum++;
            if (yearNum > 50) break;
        }
        
        // Asegurar primer periodo si no hay nada
        if (periods.length === 0) {
            periods.push(this._createPeriod(col, 1, rules, today));
        }
        
        return periods;
    },

    // Obtener balance completo de un colaborador
    getCollaboratorBalance(colId) {
        const col = StateManager.getCollaboratorById(colId);
        if (!col) return null;

        const periods = this.getAnniversaryPeriods(colId);
        const totalAssigned = periods.reduce((acc, p) => acc + p.days, 0);
        
        const allDays = StateManager.getVacationDays(colId);
        const activeDaysPool = allDays
            .filter(d => (d.status === 'approved' || d.status === 'programmed'))
            .sort((a, b) => new Date(a.actualdate + 'T12:00:00') - new Date(b.actualdate + 'T12:00:00'));

        const totalUsed = activeDaysPool.length;

        // --- LÓGICA DE ASIGNACIÓN MIXTA (MANUAL + FIFO) ---
        
        // 1. Identificar días con asignación manual (period_override)
        const manualDays = activeDaysPool.filter(d => d.period_override);
        const fifoPool = activeDaysPool.filter(d => !d.period_override);

        const periodsWithConsumption = periods.map(p => {
            const daysInThisPeriod = [];
            
            // A. Primero agregar los días asignados MANUALMENTE a este año
            const myManualDays = manualDays.filter(d => parseInt(d.period_override) === p.year);
            daysInThisPeriod.push(...myManualDays.map(d => ({ 
                ...d, 
                isBusinessDay: this.isBusinessDay(d.actualdate), 
                isManual: true 
            })));

            // B. Luego llenar el espacio restante con el FIFO Pool
            const capacityLeft = p.days - daysInThisPeriod.length;
            
            return {
                ...p,
                daysList: daysInThisPeriod, // Temporal, se terminará de llenar abajo
                capacityLeft: capacityLeft
            };
        });

        // Loop real de llenado FIFO
        let fifoIndex = 0;
        periodsWithConsumption.forEach(p => {
            while (p.capacityLeft > 0 && fifoIndex < fifoPool.length) {
                const currentDay = fifoPool[fifoIndex];
                p.daysList.push({
                    ...currentDay,
                    isBusinessDay: this.isBusinessDay(currentDay.actualdate),
                    isManual: false
                });
                fifoIndex++;
                p.capacityLeft--;
            }
            p.used = p.daysList.length;
            p.balance = p.days - p.used;
        });

        // --- EXTENSIÓN DINÁMICA DE PERIODOS ---
        // Si todavía hay días en el pool (sobregiro o carga masiva grande), generamos años extra
        const rules = this.getRules();
        const today = new Date();
        let lastYearNum = periodsWithConsumption.length > 0 
            ? periodsWithConsumption[periodsWithConsumption.length - 1].year 
            : 0;

        while (fifoIndex < fifoPool.length && lastYearNum < 50) {
            lastYearNum++;
            const newPeriod = this._createPeriod(col, lastYearNum, rules, today);
            const daysInThisPeriod = [];
            let capacityLeft = newPeriod.days;

            while (capacityLeft > 0 && fifoIndex < fifoPool.length) {
                const currentDay = fifoPool[fifoIndex];
                daysInThisPeriod.push({
                    ...currentDay,
                    isBusinessDay: this.isBusinessDay(currentDay.actualdate),
                    isManual: false
                });
                fifoIndex++;
                capacityLeft--;
            }

            periodsWithConsumption.push({
                ...newPeriod,
                daysList: daysInThisPeriod,
                used: daysInThisPeriod.length,
                balance: newPeriod.days - daysInThisPeriod.length
            });
        }

        const requests = StateManager.getVacationRequests(colId).map(req => {
            const reqDays = allDays.filter(d => d.requestid === req.id);
            return {
                ...req,
                days: reqDays,
                businessDaysCount: reqDays.filter(d => this.isBusinessDay(d.actualdate)).length
            };
        });

        // 3. FILTRADO: Ocultar periodos futuros sin consumo (Vacaciones por adelantado)
        const finalPeriods = periodsWithConsumption.filter(p => p.isEarned || p.daysList.length > 0);

        const summaryAssigned = finalPeriods.reduce((acc, p) => acc + p.days, 0);
        const summaryUsed = finalPeriods.reduce((acc, p) => acc + p.used, 0);

        return {
            assigned: summaryAssigned,
            used: summaryUsed,
            balance: summaryAssigned - summaryUsed,
            periods: finalPeriods,
            requests: requests.sort((a, b) => new Date(b.registrationdate + 'T12:00:00') - new Date(a.registrationdate + 'T12:00:00'))
        };
    },

    isBusinessDay(dateStr) {
        if (!dateStr || dateStr === 'null') return false;
        const date = new Date(dateStr + 'T12:00:00'); // Evitar problemas de zona horaria
        if (isNaN(date.getTime())) return false;
        const day = date.getDay();
        return day !== 0 && day !== 6; // 0=Domingo, 6=Sábado
    },

    // Obtener eventos para el calendario (Vista 1)
    getEventsForMonth(year, month) {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);
        
        const days = StateManager.data.vacationdays || [];
        const events = [];

        days.forEach(d => {
            const actualDate = new Date(d.actualdate);
            if (actualDate >= startDate && actualDate <= endDate) {
                if (d.status === 'cancelled') return;

                const col = StateManager.getCollaboratorById(d.collaboratorid);
                events.push({
                    dayId: d.id,
                    colId: d.collaboratorid,
                    colName: col ? col.name : 'Desconocido',
                    date: d.actualdate,
                    status: d.status,
                    isWeekend: !this.isBusinessDay(d.actualdate)
                });
            }
        });

        return events;
    },

    // Panel General (Vista 3)
    getAllPersonnelSummary() {
        const collaborators = StateManager.getCollaborators('all');
        return collaborators.map(col => {
            const balance = this.getCollaboratorBalance(col.id);
            return {
                id: col.id,
                name: col.name,
                status: col.status,
                assigned: balance.assigned,
                used: balance.used,
                balance: balance.balance,
                hasPending: balance.requests.some(r => r.status === 'requested')
            };
        });
    }
};

window.VacationManager = VacationManager;
