const Visualizer = {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(),
    miniYear: new Date().getFullYear(),
    miniMonth: new Date().getMonth(),
    permYear: new Date().getFullYear(),
    permMonth: new Date().getMonth(),
    selectedDates: [], 
    permissionSelectedDate: null,
    editingPermissionId: null,
    selectedColId: null,

    init() {
        this.setupNavigation();
        this.populateDateSelectors();
        this.renderCalendar();
        this.renderPersonnelPanel();
        this.populateColSelect();
        this.renderDashboard();
    },

    setupNavigation() {
        // Calendario Principal
        document.getElementById('cal-prev').onclick = () => {
            this.currentMonth--;
            if (this.currentMonth < 0) {
                this.currentMonth = 11;
                this.currentYear--;
            }
            this.updateDateSelectors();
            this.renderCalendar();
        };

        document.getElementById('cal-next').onclick = () => {
            this.currentMonth++;
            if (this.currentMonth > 11) {
                this.currentMonth = 0;
                this.currentYear++;
            }
            this.updateDateSelectors();
            this.renderCalendar();
        };

        document.getElementById('cal-month-select').onchange = (e) => {
            this.currentMonth = parseInt(e.target.value);
            this.renderCalendar();
        };
        document.getElementById('cal-year-select').onchange = (e) => {
            this.currentYear = parseInt(e.target.value);
            this.renderCalendar();
        };

        // Mini Calendario (Dashboard)
        document.getElementById('mini-cal-prev').onclick = () => {
            this.miniMonth--;
            if (this.miniMonth < 0) {
                this.miniMonth = 11;
                this.miniYear--;
            }
            this.updateMiniDateSelectors();
            this.renderMiniCalendar();
        };

        document.getElementById('mini-cal-next').onclick = () => {
            this.miniMonth++;
            if (this.miniMonth > 11) {
                this.miniMonth = 0;
                this.miniYear++;
            }
            this.updateMiniDateSelectors();
            this.renderMiniCalendar();
        };

        const miniMSelect = document.getElementById('mini-month-select');
        const miniYSelect = document.getElementById('mini-year-select');
        if (miniMSelect) {
            miniMSelect.onchange = (e) => {
                this.miniMonth = parseInt(e.target.value);
                this.renderMiniCalendar();
            };
        }
        if (miniYSelect) {
            miniYSelect.onchange = (e) => {
                this.miniYear = parseInt(e.target.value);
                this.renderMiniCalendar();
            };
        }

        // Permisos Calendario
        const pBtnPrev = document.getElementById('perm-cal-prev');
        const pBtnNext = document.getElementById('perm-cal-next');
        const pMSelect = document.getElementById('perm-month-select');
        const pYSelect = document.getElementById('perm-year-select');

        if (pBtnPrev) pBtnPrev.onclick = () => {
            this.permMonth--;
            if (this.permMonth < 0) { this.permMonth = 11; this.permYear--; }
            this.updatePermDateSelectors();
            this.renderPermissionMiniCalendar();
        };
        if (pBtnNext) pBtnNext.onclick = () => {
            this.permMonth++;
            if (this.permMonth > 11) { this.permMonth = 0; this.permYear++; }
            this.updatePermDateSelectors();
            this.renderPermissionMiniCalendar();
        };
        if (pMSelect) pMSelect.onchange = (e) => {
            this.permMonth = parseInt(e.target.value);
            this.renderPermissionMiniCalendar();
        };
        if (pYSelect) pYSelect.onchange = (e) => {
            this.permYear = parseInt(e.target.value);
            this.renderPermissionMiniCalendar();
        };

        // Histórico
        document.getElementById('history-col-select').onchange = (e) => {
            this.selectedColId = e.target.value;
            this.renderHistory();
        };

        // Filtros Panel General
        const statusFilter = document.getElementById('filter-panel-status');
        if (statusFilter) statusFilter.onchange = () => this.renderPersonnelPanel();
    },

    populateDateSelectors() {
        const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const mSelect = document.getElementById('cal-month-select');
        const ySelect = document.getElementById('cal-year-select');
        const mmSelect = document.getElementById('mini-month-select');
        const mySelect = document.getElementById('mini-year-select');
        const pmSelect = document.getElementById('perm-month-select');
        const pySelect = document.getElementById('perm-year-select');

        const mOptions = months.map((m, i) => `<option value="${i}">${m}</option>`).join('');
        const currentY = new Date().getFullYear();
        let yOptions = '';
        for (let y = 2013; y <= currentY + 10; y++) {
            yOptions += `<option value="${y}">${y}</option>`;
        }

        if (mSelect) mSelect.innerHTML = mOptions;
        if (ySelect) ySelect.innerHTML = yOptions;
        if (mmSelect) mmSelect.innerHTML = mOptions;
        if (mySelect) mySelect.innerHTML = yOptions;
        if (pmSelect) pmSelect.innerHTML = mOptions;
        if (pySelect) pySelect.innerHTML = yOptions;

        this.updateDateSelectors();
        this.updateMiniDateSelectors();
        this.updatePermDateSelectors();
    },

    updateDateSelectors() {
        if (document.getElementById('cal-month-select')) document.getElementById('cal-month-select').value = this.currentMonth;
        if (document.getElementById('cal-year-select')) document.getElementById('cal-year-select').value = this.currentYear;
    },

    updateMiniDateSelectors() {
        if (document.getElementById('mini-month-select')) document.getElementById('mini-month-select').value = this.miniMonth;
        if (document.getElementById('mini-year-select')) document.getElementById('mini-year-select').value = this.miniYear;
    },

    updatePermDateSelectors() {
        if (document.getElementById('perm-month-select')) document.getElementById('perm-month-select').value = this.permMonth;
        if (document.getElementById('perm-year-select')) document.getElementById('perm-year-select').value = this.permYear;
    },

    // --- VISTA 0: DASHBOARD ---
    renderDashboard() {
        const stats = StateManager.getStats();
        const allCollaborators = StateManager.getCollaborators('all');
        
        document.getElementById('dash-total').textContent = stats.total;
        document.getElementById('dash-on-leave').textContent = stats.onLeave;

        const vacSelect = document.getElementById('vac-col-select');
        if (vacSelect) {
            vacSelect.innerHTML = '<option value="">Selecciona Colaborador...</option>' + 
                allCollaborators.filter(c => c.status === 'active')
                .map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }

        this.renderMiniCalendar();
        this.renderUpcomingLeaves();
    },

    renderMiniCalendar() {
        const container = document.getElementById('quick-vacation-calendar');
        this.updateMiniDateSelectors();
        
        const firstDay = new Date(this.miniYear, this.miniMonth, 1).getDay();
        const daysInMonth = new Date(this.miniYear, this.miniMonth + 1, 0).getDate();
        
        let html = `
            <div class="mini-calendar-header">
                <div>D</div><div>L</div><div>M</div><div>M</div><div>J</div><div>V</div><div>S</div>
            </div>
        `;

        for (let i = 0; i < firstDay; i++) {
            html += `<div class="mini-day other-month"></div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${this.miniYear}-${String(this.miniMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isWeekend = !VacationManager.isBusinessDay(dateStr);
            const isSelected = this.selectedDates.includes(dateStr);
            
            html += `
                <div class="mini-day ${isWeekend ? 'weekend' : ''} ${isSelected ? 'selected' : ''}" 
                     onclick="Visualizer.toggleMiniDate('${dateStr}', ${isWeekend})">
                    ${day}
                </div>
            `;
        }

        container.innerHTML = html;
        this.updateSelectedCount();
    },

    toggleMiniDate(dateStr, isWeekend) {
        if (isWeekend) return;
        const index = this.selectedDates.indexOf(dateStr);
        if (index > -1) {
            this.selectedDates.splice(index, 1);
        } else {
            this.selectedDates.push(dateStr);
        }
        this.renderMiniCalendar();
    },

    updateSelectedCount() {
        const count = document.getElementById('selected-days-count');
        if (count) count.textContent = this.selectedDates.length;
    },

    renderUpcomingLeaves() {
        const container = document.getElementById('upcoming-list');
        const days = StateManager.data.vacationdays || [];
        const today = new Date();
        today.setHours(0,0,0,0);

        const futureDays = days.filter(d => {
            const date = new Date(d.actualdate + 'T12:00:00');
            return date >= today && (d.status === 'approved' || d.status === 'programmed');
        }).sort((a,b) => new Date(a.actualdate + 'T12:00:00') - new Date(b.actualdate + 'T12:00:00'));

        const uniqueRequests = [...new Set(futureDays.map(d => d.requestid))].slice(0, 5);

        if (uniqueRequests.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:20px; opacity:0.5;">No hay salidas próximas.</p>';
            return;
        }

        container.innerHTML = uniqueRequests.map(reqId => {
            const req = StateManager.data.vacationrequests.find(r => r.id === reqId);
            const col = StateManager.getCollaboratorById(req.collaboratorid);
            const firstDay = futureDays.find(d => d.requestid === reqId);
            const startDate = new Date(firstDay.actualdate + 'T12:00:00');
            
            return `
                <div class="upcoming-item">
                    <div class="upcoming-date">
                        ${startDate.toLocaleDateString('es-ES', {month: 'short'}).toUpperCase()}
                        <strong>${startDate.getDate()}</strong>
                    </div>
                    <div class="upcoming-info">
                        <div style="font-weight:600;">${col ? col.name : 'Desconocido'}</div>
                        <div style="font-size:0.75rem; color:var(--text-secondary);">${req.dayscount} días en este periodo</div>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderCalendar() {
        const container = document.getElementById('calendar-container');
        if (!container) return;
        
        const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        
        let html = `
            <div class="calendar-grid">
                <div class="calendar-day-head">Dom</div>
                <div class="calendar-day-head">Lun</div>
                <div class="calendar-day-head">Mar</div>
                <div class="calendar-day-head">Mié</div>
                <div class="calendar-day-head">Jue</div>
                <div class="calendar-day-head">Vie</div>
                <div class="calendar-day-head">Sáb</div>
        `;

        const events = VacationManager.getEventsForMonth(this.currentYear, this.currentMonth);
        const pEvents = VacationManager.getPermissionsForMonth(this.currentYear, this.currentMonth);
        
        const allCols = StateManager.getCollaborators('all').sort((a, b) => String(a.id).localeCompare(String(b.id)));
        const colColorMap = {};
        allCols.forEach((col, index) => {
            colColorMap[col.id] = (index * 137.508) % 360;
        });

        for (let i = 0; i < firstDay; i++) {
            html += `<div class="calendar-day other-month"></div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = events.filter(e => e.date === dateStr);
            
            const hasHoliday = dayEvents.some(e => e.status === 'holiday');
            const totalOnLeave = dayEvents.filter(e => e.status !== 'holiday').length;
            
            const dayPermissions = pEvents.filter(p => p.date === dateStr);

            const countBadge = (totalOnLeave > 0 && !hasHoliday)
                ? `<span style="background:var(--primary-color); color:white; border-radius:10px; padding:2px 6px; font-size:0.65rem; font-weight:bold;" title="${totalOnLeave} en vacaciones">${totalOnLeave} <i class="fas fa-users" style="font-size:0.5rem;"></i></span>` 
                : '';
            
            const permBadge = (dayPermissions.length > 0)
                ? `<span style="background:#f59e0b; color:white; border-radius:10px; padding:2px 6px; font-size:0.65rem; font-weight:bold; margin-left:2px;" title="${dayPermissions.length} permisos registrados">${dayPermissions.length} <i class="fas fa-clock" style="font-size:0.5rem;"></i></span>`
                : '';

            html += `
                <div class="calendar-day">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                        <div class="calendar-day-num" style="margin-bottom:0;">${day}</div>
                        <div style="display:flex;">
                            ${permBadge}
                            ${countBadge}
                        </div>
                    </div>
                    <div class="calendar-events-list">
                        ${dayEvents.map(e => {
                            let inlineStyle = '';
                            let cssClass = `status-${e.isWeekend ? 'weekend' : 'dynamic'}`;

                            if (e.status === 'holiday') {
                                cssClass = 'status-holiday';
                            } else if (!e.isWeekend) {
                                let hue = colColorMap[e.colId];
                                if (hue === undefined) {
                                    let hash = 0;
                                    const str = String(e.colId || e.colName);
                                    for(let i=0; i<str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
                                    hue = Math.abs(hash) % 360;
                                }
                                inlineStyle = `background-color: hsl(${hue}, 75%, 85%) !important; color: #1a1a1a !important; font-weight: 600 !important; border-left: 4px solid hsl(${hue}, 80%, 40%) !important; box-shadow: 1px 1px 2px rgba(0,0,0,0.1) !important;`;
                            }
                            return `
                            <div class="calendar-event ${cssClass}" style="${inlineStyle}" title="${e.colName}">
                                ${e.colName}
                            </div>
                            `;
                        }).join('')}
                        ${dayPermissions.map(p => {
                            const col = StateManager.getCollaboratorById(p.collaboratorid);
                            return `
                            <div class="calendar-event" style="background-color: #fef3c7; color: #92400e; border-left: 4px solid #f59e0b; font-size: 0.7rem; padding: 2px 4px; margin-top:2px;" title="Permiso: ${p.start_time} - ${p.end_time} (${p.notes || ''})">
                                <i class="fas fa-clock" style="font-size:0.6rem;"></i> ${col ? col.name.split(' ')[0] : 'Permiso'}
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        html += `</div>`;
        container.innerHTML = html;
    },

    populateColSelect() {
        const select = document.getElementById('history-col-select');
        if (!select) return;
        const cols = StateManager.getCollaborators('all');
        
        select.innerHTML = '<option value="">Selecciona un colaborador...</option>' + 
            cols.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            
        if (this.selectedColId) select.value = this.selectedColId;
    },

    renderHistory() {
        const container = document.getElementById('history-content');
        if (!container) return;

        if (!this.selectedColId) {
            container.innerHTML = `
                <div class="empty-state card">
                    <i class="fas fa-history"></i>
                    <p>Selecciona un colaborador para ver su historial detallado.</p>
                </div>`;
            return;
        }

        const balance = VacationManager.getCollaboratorBalance(this.selectedColId);
        const col = StateManager.getCollaboratorById(this.selectedColId);

        let html = `
            <div class="history-summary-header" style="margin-bottom: 30px;">
                <div class="card" style="padding: 25px; border-left: 5px solid var(--primary-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h2 style="margin: 0; font-size: 1.5rem;">${col.name}</h2>
                            <p style="margin: 5px 0 0; color: var(--text-secondary);">
                                <i class="fas fa-history"></i> Historial de vacaciones consolidado
                            </p>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-secondary);">Saldo General</div>
                            <div style="font-size: 2.5rem; font-weight: 800; color: var(--primary-color); line-height: 1;">${balance.balance} <span style="font-size: 1rem; font-weight: 400;">días</span></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Resumen de Periodos Superior -->
            <div class="card" style="margin-bottom: 30px; padding: 20px;">
                <h3 style="margin: 0 0 15px; font-size: 1.1rem; color: var(--text-primary);">Resumen de Periodos</h3>
                <div class="table-container">
                <table class="personnel-table" style="font-size: 0.85rem;">
                    <thead>
                        <tr>
                            <th>Año</th>
                            <th>Periodo</th>
                            <th>Activación</th>
                            <th>Asignados</th>
                            <th>Usados</th>
                            <th>Balance</th>
                        </tr>
                    </thead>
                                <tbody>
                                    ${balance.periods.map(p => `
                                        <tr style="${p.isEarned ? '' : 'background-color: #fff5f5;'}">
                                            <td>
                                                <strong style="color: ${p.isEarned ? 'inherit' : '#dc2626'}">Año ${p.year}</strong>
                                                ${p.isEarned ? '' : '<span style="display:block; font-size: 0.65rem; color: #dc2626; font-weight: 700;">ANTICIPO</span>'}
                                            </td>
                                            <td>${p.label}</td>
                                            <td>${new Date(p.activationDate + 'T12:00:00').toLocaleDateString()}</td>
                                            <td>${p.days}</td>
                                            <td style="color: var(--secondary-color); font-weight: 600;">${p.used}</td>
                                            <td><strong style="color: ${p.balance > 0 ? 'var(--success-color)' : 'var(--text-secondary)'}">${p.balance}</strong></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                            </div>
                        </div>
                        
            <div class="periods-timeline" style="display: flex; flex-direction: column; gap: 30px;">
                ${(() => {
                    const seenDates = new Set();
                    return [...balance.periods].reverse().map(p => {
                        const progress = (p.used / p.days) * 100;
                        
                        // Generar el desglose de días para este periodo
                        const daysRows = [...p.daysList]
                            .sort((a, b) => new Date(b.actualdate + 'T12:00:00') - new Date(a.actualdate + 'T12:00:00'))
                            .map(d => {
                                const isDuplicate = seenDates.has(d.actualdate);
                                seenDates.add(d.actualdate);
                                
                                let rowStyle = '';
                                if (isDuplicate) {
                                    rowStyle = 'background-color: #fef9c3; border-left: 4px solid #eab308;';
                                } else if (!d.isBusinessDay) {
                                    rowStyle = 'background-color: #fef2f2; border-left: 4px solid #ef4444;';
                                }

                                return `
                                <tr style="${rowStyle}">
                                    <td style="white-space: nowrap;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <strong style="${isDuplicate ? 'color: #854d0e;' : (!d.isBusinessDay ? 'color: #b91c1c;' : '')}">${new Date(d.actualdate + 'T12:00:00').toLocaleDateString()}</strong>
                                            <button class="btn-icon admin-only" onclick="Visualizer.editDayDate('${d.id}', '${d.actualdate}')" style="width:20px; height:20px;" title="Editar Fecha">
                                                <i class="fas fa-pencil-alt" style="font-size:0.6rem;"></i>
                                            </button>
                                        </div>
                                        ${isDuplicate ? '<span style="display:block; font-size: 0.65rem; color: #854d0e; font-weight: 600; margin-top: 2px;">⚠️ DUPLICADO</span>' : ''}
                                        ${(!d.isBusinessDay && !isDuplicate) ? '<span style="display:block; font-size: 0.65rem; color: #b91c1c; font-weight: 600; margin-top: 2px;">⚠️ FIN DE SEMANA</span>' : ''}
                                    </td>
                                    <td>
                                        <div class="admin-only">
                                            <select class="status-select input-field" style="padding:2px; font-size:0.75rem; height:auto; width:100%; ${!d.isBusinessDay ? 'border-color: #ef4444;' : ''}" onchange="Visualizer.updateDayStatus('${d.id}', this.value)">
                                                <option value="approved" ${d.status === 'approved' ? 'selected' : ''}>Aprobado</option>
                                                <option value="programmed" ${d.status === 'programmed' ? 'selected' : ''}>Programado</option>
                                                <option value="cancelled" ${d.status === 'cancelled' ? 'selected' : ''}>Cancelado</option>
                                            </select>
                                        </div>
                                        <div class="guest-only">
                                            <span class="status-pill pill-${d.status}" style="font-size: 0.65rem;">${d.status.toUpperCase()}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <input type="text" class="note-input admin-only" value="${d.notes || ''}" 
                                               placeholder="Agregar nota..." 
                                               onblur="Visualizer.updateDayNote('${d.id}', this.value)" style="width: 100%;">
                                        <span class="guest-only" style="font-size: 0.8rem; color: #666;">${d.notes || ''}</span>
                                    </td>
                                    <td>
                                        <div class="admin-only">
                                            <select class="status-select input-field" style="padding:2px; font-size:0.75rem; height:auto; width:100%; color: ${d.isManual ? 'var(--primary-color)' : 'inherit'}; font-weight: ${d.isManual ? '600' : 'normal'}" 
                                                onchange="Visualizer.updateDayPeriod('${d.id}', this.value)">
                                                <option value="">Auto (FIFO)</option>
                                                ${balance.periods.map(per => `
                                                    <option value="${per.year}" ${parseInt(d.period_override) === per.year ? 'selected' : ''}>Año ${per.year}</option>
                                                `).join('')}
                                            </select>
                                        </div>
                                        <div class="guest-only" style="font-size: 0.75rem;">
                                            ${d.period_override ? 'Año ' + d.period_override : 'Automático'}
                                        </div>
                                    </td>
                                    <td class="admin-only">
                                        <button class="btn-icon delete" onclick="Visualizer.deleteSingleDay('${d.id}')" title="Borrar">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </td>
                                </tr>`;
                            }).join('');

                        return `
                        <div class="card period-card" style="padding: 0; overflow: hidden; border: 1px solid var(--border-color); border-left: 5px solid ${p.isEarned ? (p.balance > 0 ? 'var(--primary-color)' : '#cbd5e0') : '#dc2626'};">
                            <div class="period-header" style="padding: 20px 25px; background-color: ${p.isEarned ? '#f9f9fb' : '#fef2f2'}; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <h3 style="margin:0; color: ${p.isEarned ? 'inherit' : '#dc2626'}">
                                        AÑO ${p.year} <small style="font-weight: normal; opacity: 0.6;">(${p.label})</small>
                                        ${p.isEarned ? '' : '<span style="margin-left: 10px; font-size: 0.7rem; background: #dc2626; color: white; padding: 2px 6px; border-radius: 4px; vertical-align: middle;">ANTICIPO</span>'}
                                    </h3>
                                    <p style="margin:5px 0 0; font-size: 0.75rem; color: ${p.isEarned ? 'var(--text-secondary)' : '#b91c1c'};">
                                        ${p.isEarned ? 'Activación legal:' : '⚠️ ADEUDADO / ADELANTO (Activa:'} <strong>${new Date(p.activationDate + 'T12:00:00').toLocaleDateString()}</strong>${p.isEarned ? '' : ')'}
                                    </p>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary);">Días Asignados 
                                        <button class="btn-icon admin-only" onclick="Visualizer.editPeriodDays(${p.year}, ${p.days})" style="display:inline-flex; width:20px; height:20px; padding:0; justify-content:center; align-items:center;"><i class="fas fa-pencil-alt" style="font-size:0.6rem;"></i></button>
                                    </div>
                                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color);">${p.days}</div>
                                </div>
                            </div>

                            <div class="period-body" style="padding: 25px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                                    <div style="flex: 1; max-width: 400px;">
                                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                            <div style="font-size: 0.8rem; font-weight: 600;">Consumo del periodo</div>
                                            <div style="font-size: 0.8rem;">
                                                <span style="color: var(--success-color); font-weight: 700;">${p.balance} disponibles</span>
                                            </div>
                                        </div>
                                        <div class="progress-bar" style="height: 6px; background-color: #eee; border-radius: 3px; overflow: hidden;">
                                            <div style="width: ${progress}%; height: 100%; background-color: var(--secondary-color);"></div>
                                        </div>
                                    </div>
                                    <div style="color:var(--text-secondary); font-size:0.8rem; font-style: italic;">
                                        Consumo FIFO por antigüedad
                                    </div>
                                </div>

                                <div class="table-container">
                                    <table class="day-breakdown-table" style="margin: 0;">
                                        <thead>
                                            <tr>
                                                <th style="width: 160px;">Fecha</th>
                                                <th style="width: 140px;">Estatus</th>
                                                <th>Notas</th>
                                                <th style="width: 160px;">Asignación</th>
                                                <th style="width: 50px;" class="admin-only"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${p.daysList.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding:15px; opacity:0.5;">Sin días consumidos.</td></tr>' : daysRows}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>`;
                    }).join('');
                })()}
            </div>
        `;

        container.innerHTML = html;
    },

    async updateDayStatus(dayId, status) {
        try {
            await StateManager.updateVacationDay(dayId, { status });
            UIManager.showToast('Estatus actualizado', 'success');
            this.renderHistory();
            this.renderCalendar();
        } catch (err) {
            UIManager.showToast('Error: ' + err.message, 'error');
        }
    },

    async updateDayNote(dayId, notes) {
        try {
            await StateManager.updateVacationDay(dayId, { notes });
            UIManager.showToast('Nota guardada', 'success');
        } catch (err) {
            UIManager.showToast('Error: ' + err.message, 'error');
        }
    },

    async deleteSingleDay(dayId) {
        if (confirm('¿Deseas eliminar este día de las vacaciones? El saldo se recalculará.')) {
            try {
                await StateManager.updateVacationDay(dayId, { status: 'cancelled' });
                this.renderHistory();
                this.renderCalendar();
                this.renderDashboard();
            } catch (err) {
                UIManager.showToast('Error: ' + err.message, 'error');
            }
        }
    },

    renderPersonnelPanel() {
        const body = document.getElementById('panel-general-body');
        if (!body) return;

        const statusFilter = document.getElementById('filter-panel-status').value;
        const summary = VacationManager.getAllPersonnelSummary();
        
        const filtered = summary.filter(s => statusFilter === 'all' || s.status === statusFilter);

        body.innerHTML = filtered.map(s => `
            <tr>
                <td><div style="font-weight:600;">${s.name}</div></td>
                <td><span class="status-pill pill-${s.status}">${s.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
                <td>${s.assigned}</td>
                <td>${s.used}</td>
                <td><strong style="color: ${s.balance > 0 ? 'var(--success-color)' : 'var(--error-color)'}">${s.balance}</strong></td>
                <td>${s.hasPending ? '<span class="pill-has-pending">Pendientes</span>' : '<span class="pill-no-pending">Al día</span>'}</td>
                <td>
                    <button class="btn-icon" onclick="UIManager.navigate('nav-history', '${s.id}')" title="Ver Histórico">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    renderPersonnelPanelSearch(query) {
        const body = document.getElementById('panel-general-body');
        if (!body) return;
        const summary = VacationManager.getAllPersonnelSummary();
        const filtered = summary.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
        
        body.innerHTML = filtered.map(s => `
            <tr>
                <td><div style="font-weight:600;">${s.name}</div></td>
                <td><span class="status-pill pill-${s.status}">${s.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
                <td>${s.assigned}</td>
                <td>${s.used}</td>
                <td><strong style="color: ${s.balance > 0 ? 'var(--success-color)' : 'var(--error-color)'}">${s.balance}</strong></td>
                <td>${s.hasPending ? '<span class="pill-has-pending">Pendientes</span>' : '<span class="pill-no-pending">Al día</span>'}</td>
                <td>
                    <button class="btn-icon" onclick="UIManager.navigate('nav-history', '${s.id}')" title="Ver Histórico">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    renderUserManagement() {
        const body = document.getElementById('user-management-body');
        if (!body) return;

        const users = StateManager.getUsers();
        body.innerHTML = users.map(u => `
            <tr style="${u.status === 'suspended' ? 'opacity:0.6;' : ''}">
                <td>${u.name} ${u.status === 'suspended' ? '<span style="color:red;font-size:0.7em">(Suspendido)</span>' : ''}</td>
                <td><code>${u.username}</code></td>
                <td><span class="badge">${u.role === 'admin' ? 'Administrador' : 'Invitado'}</span></td>
                <td>
                    ${u.username === 'admin' ? '' : `
                        <button class="btn-icon delete admin-only" onclick="UIManager.handleDeleteUser('${u.id}')" title="Eliminar">
                            <i class="fas fa-user-minus"></i>
                        </button>
                        <button class="btn-icon primary admin-only" onclick="UIManager.toggleUserSuspension('${u.id}')" title="${u.status === 'suspended' ? 'Activar' : 'Suspender'}">
                            <i class="fas ${u.status === 'suspended' ? 'fa-play' : 'fa-pause'}"></i>
                        </button>
                    `}
                    <button class="btn-icon edit admin-only" onclick="UIManager.showUserModal('${u.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    async editPeriodDays(year, currentDays) {
        const newVal = prompt(`Editar días asignados para el Año ${year}:`, currentDays);
        if (newVal === null || newVal === '') return;

        const days = parseInt(newVal);
        if (isNaN(days)) return alert('Ingresa un número válido.');

        const colId = this.selectedColId;
        if (!colId) return;

        try {
            const col = StateManager.getCollaboratorById(colId);
            const overrides = typeof col.period_overrides === 'string' 
                ? JSON.parse(col.period_overrides) 
                : (col.period_overrides || {});

            overrides[year] = days;
            
            await StateManager.saveCollaborator({
                ...col,
                period_overrides: JSON.stringify(overrides)
            });

            UIManager.showToast(`Días del Año ${year} actualizados a ${days}`, 'success');
            this.renderHistory();
            this.renderDashboard();
        } catch (err) {
            UIManager.showToast('Error: ' + err.message, 'error');
        }
    },

    async updateDayPeriod(dayId, year) {
        try {
            const val = year === "" ? null : parseInt(year);
            await StateManager.updateVacationDay(dayId, { period_override: val });
            UIManager.showToast('Asignación de periodo actualizada', 'success');
            this.renderHistory();
            this.renderDashboard();
        } catch (err) {
            UIManager.showToast('Error: ' + err.message, 'error');
        }
    },

    async editDayDate(dayId, currentDate) {
        const newDate = prompt('Ingresa la nueva fecha para este día (formato AAAA-MM-DD):', currentDate);
        if (newDate === null || newDate === '' || newDate === currentDate) return;

        // Validar formato básico
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(newDate)) {
            return alert('Formato de fecha inválido. Usa AAAA-MM-DD.');
        }

        try {
            await StateManager.updateVacationDay(dayId, { actualdate: newDate });
            UIManager.showToast('Fecha actualizada correctamente', 'success');
            this.renderHistory();
            this.renderCalendar();
            this.renderDashboard();
        } catch (err) {
            UIManager.showToast('Error al actualizar: ' + err.message, 'error');
        }
    },

    // --- VISTA 6: PERMISOS ---
    renderPermissionsView() {
        const allColabs = StateManager.getCollaborators('active');
        const select = document.getElementById('perm-col-select');
        if (select) {
            select.innerHTML = '<option value="">Selecciona Colaborador...</option>' + 
                allColabs.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }

        this.renderPermissionMiniCalendar();
        this.renderPermissionsTable();
    },

    renderPermissionMiniCalendar() {
        const container = document.getElementById('permission-mini-calendar');
        if (!container) return;

        this.updatePermDateSelectors();
        
        const firstDay = new Date(this.permYear, this.permMonth, 1).getDay();
        const daysInMonth = new Date(this.permYear, this.permMonth + 1, 0).getDate();
        
        let html = `
            <div class="mini-calendar-header">
                <div>D</div><div>L</div><div>M</div><div>M</div><div>J</div><div>V</div><div>S</div>
            </div>
        `;

        for (let i = 0; i < firstDay; i++) {
            html += `<div class="mini-day other-month"></div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${this.permYear}-${String(this.permMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isWeekend = !VacationManager.isBusinessDay(dateStr);
            const isSelected = this.permissionSelectedDate === dateStr;
            
            html += `
                <div class="mini-day ${isWeekend ? 'weekend' : ''} ${isSelected ? 'selected' : ''}" 
                     onclick="Visualizer.selectPermissionDate('${dateStr}', ${isWeekend})">
                    ${day}
                </div>
            `;
        }

        container.innerHTML = html;
    },

    selectPermissionDate(dateStr, isWeekend) {
        if (isWeekend) return;
        this.permissionSelectedDate = dateStr;
        const text = document.getElementById('perm-selected-date-text');
        if (text) text.textContent = 'Fecha: ' + UIManager.formatDate(dateStr);
        this.renderPermissionMiniCalendar();
    },

    renderPermissionsTable() {
        const body = document.getElementById('permissions-table-body');
        if (!body) return;

        const permissions = StateManager.getPermissions().slice(0, 15); // Top 15 recents
        body.innerHTML = '';

        if (permissions.length === 0) {
            body.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; opacity:0.6;">Sin permisos registrados.</td></tr>';
            return;
        }

        permissions.forEach(p => {
            const col = StateManager.getCollaboratorById(p.collaboratorid);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="font-weight:600;">${col ? col.name : 'Desconocido'}</div>
                    <div style="font-size:0.7rem; color:var(--text-secondary);">${p.notes || '-'}</div>
                </td>
                <td>${UIManager.formatDate(p.date)}</td>
                <td style="white-space:nowrap;">
                    <span class="status-pill" style="background:#fff7ed; color:#c2410c; border:1px solid #ffedd5; white-space:nowrap; display:inline-block;">${p.start_time} - ${p.end_time}</span>
                </td>
                <td><strong>${p.total_hours}</strong></td>
                <td>
                    <button class="btn-icon edit" onclick="UIManager.handleEditPermission('${p.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete" onclick="UIManager.handleDeletePermission('${p.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            body.appendChild(tr);
        });
    }
};

window.Visualizer = Visualizer;
