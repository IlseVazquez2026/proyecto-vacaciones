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
        
        const hire = new Date(col.hiredate);
        let maxDate = new Date(); // Target cutoff date
        
        // Revisar si hay vacaciones solicitadas a futuro para generar los periodos
        const allDays = StateManager.getVacationDays(colId);
        allDays.forEach(d => {
            const dDate = new Date(d.actualdate);
            if (dDate > maxDate) maxDate = dDate;
        });

        const periods = [];
        const rules = this.getRules();
        
        let yearNum = 1;
        while (true) {
            const anniversary = new Date(hire);
            anniversary.setFullYear(hire.getFullYear() + yearNum);
            
            // Si el inicio del periodo ya superó la fecha máxima de las vacaciones agendadas, dejamos de generar periodos.
            const startPeriod = new Date(hire);
            startPeriod.setFullYear(hire.getFullYear() + yearNum - 1);

            if (startPeriod > maxDate) {
                break;
            }
            
            // Determinar legislación aplicable (si aniversario >= 2023-01-01 -> post2023)
            const cutoffDate = new Date('2023-01-01');
            const law = anniversary >= cutoffDate ? 'post2023' : 'pre2023';
            
            // Calcular días según tabla
            const currentRules = rules[law];
            let days = 0;
            for (const level of currentRules) {
                if (yearNum >= level.years) {
                    days = level.days;
                } else {
                    break;
                }
            }
            
            periods.push({
                year: yearNum,
                label: `${startPeriod.getFullYear()}-${anniversary.getFullYear()}`,
                activationDate: anniversary.toISOString().split('T')[0],
                days: days,
                law: law
            });
            
            yearNum++;
            if (yearNum > 50) break;
        }
        
        // Asegurar que si el empleado tiene menos de 1 año y no ha pedido adelantos, al menos se muestre su primer periodo para uso futuro
        if (periods.length === 0) {
            const law = new Date(col.hiredate) >= new Date('2023-01-01') ? 'post2023' : 'pre2023';
            let days = rules[law][0].days;
            const anniversary = new Date(hire);
            anniversary.setFullYear(hire.getFullYear() + 1);
            periods.push({ year: 1, label: `${hire.getFullYear()}-${anniversary.getFullYear()}`, activationDate: anniversary.toISOString().split('T')[0], days, law });
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
        const activeDays = allDays.filter(d => 
            (d.status === 'approved' || d.status === 'programmed')
        ).sort((a, b) => new Date(a.actualdate) - new Date(b.actualdate)); 

        const totalUsed = activeDays.filter(d => this.isBusinessDay(d.actualdate)).length;

        // Distribución por VENTANA CRONOLÓGICA
        const hireDateObj = new Date(col.hiredate);
        
        const periodsWithConsumption = periods.map((p, index) => {
            const startDate = new Date(hireDateObj);
            startDate.setFullYear(hireDateObj.getFullYear() + p.year - 1);
            
            const endDate = new Date(hireDateObj);
            endDate.setFullYear(hireDateObj.getFullYear() + p.year);
            
            const periodDays = activeDays.filter(day => {
                const dDate = new Date(day.actualdate);
                return dDate >= startDate && dDate < endDate;
            }).map(day => ({
                ...day,
                isBusinessDay: this.isBusinessDay(day.actualdate)
            }));

            const usedInPeriod = periodDays.filter(d => d.isBusinessDay).length;

            return {
                ...p,
                used: usedInPeriod,
                balance: p.days - usedInPeriod,
                daysList: periodDays 
            };
        });

        const requests = StateManager.getVacationRequests(colId).map(req => {
            const reqDays = allDays.filter(d => d.requestid === req.id);
            return {
                ...req,
                days: reqDays,
                businessDaysCount: reqDays.filter(d => this.isBusinessDay(d.actualdate)).length
            };
        });

        return {
            assigned: totalAssigned,
            used: totalUsed,
            balance: totalAssigned - totalUsed,
            periods: periodsWithConsumption,
            requests: requests.sort((a, b) => new Date(b.registrationdate) - new Date(a.registrationdate))
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
