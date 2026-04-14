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

    // Obtener los periodos de aniversario cumplidos o futuros si hay vacaciones programadas
    getAnniversaryPeriods(colId) {
        const col = StateManager.getCollaboratorById(colId);
        if (!col) return [];
        
        const hire = new Date(col.hiredate + 'T12:00:00');
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
        
        // Cargar sobrescrituras manuales si existen (formato: {"1": 15, "2": 18})
        const dayOverrides = typeof col.period_overrides === 'string' 
            ? JSON.parse(col.period_overrides) 
            : (col.period_overrides || {});

        let yearNum = 1;
        while (true) {
            const anniversary = new Date(hire);
            anniversary.setFullYear(hire.getFullYear() + yearNum);
            
            const startPeriod = new Date(hire);
            startPeriod.setFullYear(hire.getFullYear() + yearNum - 1);

            // Si el inicio del periodo ya superó la fecha máxima de las vacaciones agendadas, dejamos de generar periodos.
            if (startPeriod > maxDate) {
                break;
            }
            
            // Determinar legislación aplicable
            const lawEntry = anniversary >= new Date('2023-01-01') ? 'post2023' : 'pre2023';
            
            // Calcular días según tabla o sobrescritura
            let days = 0;
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
            
            periods.push({
                year: yearNum,
                label: `${startPeriod.getFullYear()}-${anniversary.getFullYear()}`,
                activationDate: anniversary.toISOString().split('T')[0],
                days: days,
                law: lawEntry,
                isEarned: anniversary <= today
            });
            
            yearNum++;
            if (yearNum > 50) break;
        }
        
        // Asegurar primer periodo si no hay nada
        if (periods.length === 0) {
            const anniversary = new Date(hire);
            anniversary.setFullYear(hire.getFullYear() + 1);
            const lawEntry = anniversary >= new Date('2023-01-01') ? 'post2023' : 'pre2023';
            let days = dayOverrides[1] !== undefined ? parseInt(dayOverrides[1]) : rules[lawEntry][0].days;
            
            periods.push({ 
                year: 1, 
                label: `${hire.getFullYear()}-${anniversary.getFullYear()}`, 
                activationDate: anniversary.toISOString().split('T')[0], 
                days, 
                law: lawEntry,
                isEarned: anniversary <= today
            });
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
        const date = new Date(dateStr + 'T12:00:00'); // Evitar problemas de zona horaria
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
