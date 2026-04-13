/**
 * vacationAgent.js - Motor central de la lógica operativa de vacaciones
 */

const VacationAgent = {
    /**
     * Calcula cuántos días le corresponden a un colaborador en un año (aniversario) específico.
     * @param {string} hireDate - Fecha de contratación (YYYY-MM-DD).
     * @param {number} targetYear - Año del aniversario a evaluar.
     */
    calculateEntitlement(hireDate, targetYear) {
        const hire = new Date(hireDate);
        const anniversaryDate = new Date(targetYear, hire.getMonth(), hire.getDate());
        
        // Antigüedad al cumplir el aniversario en ese año
        const yearsOfService = targetYear - hire.getFullYear();
        
        if (yearsOfService <= 0) return 0;

        const rules = StateManager.getVacationRules();
        // Determinamos qué ley aplica según la fecha del aniversario
        // Si el aniversario es >= 2023-01-01, aplica Ley Post-2023
        const isPost2023 = anniversaryDate >= new Date('2023-01-01');
        const ruleSet = isPost2023 ? rules.post2023 : rules.pre2023;

        // Buscamos la regla que aplique (la mayor que no exceda yearsOfService)
        let days = 0;
        for (const rule of ruleSet) {
            if (yearsOfService >= rule.years) {
                days = rule.days;
            } else {
                break;
            }
        }
        return days;
    },

    /**
     * Obtiene el resumen de saldos por periodo para un colaborador.
     */
    getCollaboratorBalance(collaboratorId) {
        const collaborator = StateManager.getCollaboratorById(collaboratorId);
        if (!collaborator) return [];

        const hireDate = new Date(collaborator.hireDate);
        const currentYear = new Date().getFullYear();
        const balances = [];

        // Calculamos saldos desde el año de contratación hasta el año actual + 1 (periodo vigente)
        for (let year = hireDate.getFullYear() + 1; year <= currentYear + 1; year++) {
            const entitlement = this.calculateEntitlement(collaborator.hireDate, year);
            if (entitlement === 0) continue;

            const periodLabel = `${year - 1}-${year}`;
            
            // Días usados en este periodo
            const usedDays = StateManager.getVacationDays(collaboratorId).filter(d => 
                d.period === periodLabel && 
                (d.status === 'programmed' || d.status === 'taken_original' || d.status === 'rescheduled')
            ).length;

            balances.push({
                period: periodLabel,
                entitlement,
                used: usedDays,
                remaining: entitlement - usedDays
            });
        }

        return balances.reverse(); // Mostrar periodos más recientes primero
    },

    /**
     * Procesa una solicitud de vacaciones (rango o selección múltiple).
     */
    processRequest(collaboratorId, { dates, notes, period }) {
        // 'dates' puede ser un array de strings YYYY-MM-DD
        if (!dates || dates.length === 0) throw new Error('Debe seleccionar al menos un día.');

        const requestHeader = {
            collaboratorId,
            totalDays: dates.length,
            notes,
            status: 'registered'
        };

        const daysDetail = dates.map(date => ({
            collaboratorId,
            officialDate: date,
            actualDate: date,
            period: period, // El usuario selecciona a qué periodo afecta
            status: 'programmed',
            log: [{
                date: new Date().toISOString(),
                action: 'registration',
                note: 'Registro inicial'
            }]
        }));

        return StateManager.saveVacationRequest(requestHeader, daysDetail);
    },

    /**
     * Cancela uno o varios días específicos.
     */
    cancelDays(dayIds, reason) {
        dayIds.forEach(id => {
            const day = StateManager.data.vacationDays.find(d => d.id === id);
            if (day) {
                const logEntry = {
                    date: new Date().toISOString(),
                    action: 'cancel',
                    note: reason || 'Cancelación manual'
                };
                const newLog = [...(day.log || []), logEntry];
                StateManager.updateVacationDay(id, { 
                    status: 'cancelled',
                    log: newLog
                });
            }
        });
    },

    /**
     * Reprograma un día específico.
     */
    rescheduleDay(dayId, newDate, reason) {
        const day = StateManager.data.vacationDays.find(d => d.id === dayId);
        if (day) {
            const logEntry = {
                date: new Date().toISOString(),
                action: 'reschedule',
                note: `Movido de ${day.actualDate} a ${newDate}. Motivo: ${reason}`
            };
            const newLog = [...(day.log || []), logEntry];
            StateManager.updateVacationDay(dayId, { 
                actualDate: newDate,
                status: 'rescheduled',
                log: newLog
            });
        }
    },

    /**
     * Obtiene los días para el calendario (formato simplificado).
     */
    getCalendarEvents(month, year) {
        const targetMonth = month.toString().padStart(2, '0');
        const prefix = `${year}-${targetMonth}`;
        
        return StateManager.data.vacationDays
            .filter(d => d.actualDate.startsWith(prefix) && d.status !== 'cancelled')
            .map(d => {
                const col = StateManager.getCollaboratorById(d.collaboratorId);
                return {
                    id: d.id,
                    date: d.actualDate,
                    collaboratorName: col ? col.name : 'Desconocido',
                    status: d.status
                };
            });
    }
};
