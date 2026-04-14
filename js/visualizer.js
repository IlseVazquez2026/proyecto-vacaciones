const Visualizer = {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(),
    miniYear: new Date().getFullYear(),
    miniMonth: new Date().getMonth(),
    selectedDates: [], 
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
            this.renderMiniCalendar();
        };

        document.getElementById('mini-cal-next').onclick = () => {
            this.miniMonth++;
            if (this.miniMonth > 11) {
                this.miniMonth = 0;
                this.miniYear++;
            }
            this.renderMiniCalendar();
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

        mSelect.innerHTML = months.map((m, i) => `<option value="${i}" ${i === this.currentMonth ? 'selected' : ''}>${m}</option>`).join('');
        
        const currentY = new Date().getFullYear();
        let yhtml = '';
        for (let y = currentY - 5; y <= currentY + 5; y++) {
            yhtml += `<option value="${y}" ${y === this.currentYear ? 'selected' : ''}>${y}</option>`;
        }
        ySelect.innerHTML = yhtml;
    },

    updateDateSelectors() {
        document.getElementById('cal-month-select').value = this.currentMonth;
        document.getElementById('cal-year-select').value = this.currentYear;
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
        const monthLabel = document.getElementById('mini-cal-month-year');
        const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        
        monthLabel.textContent = `${months[this.miniMonth]} ${this.miniYear}`;
        
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
            const date = new Date(d.actualdate);
            return date >= today && (d.status === 'approved' || d.status === 'programmed');
        }).sort((a,b) => new Date(a.actualdate) - new Date(b.actualdate));

        const uniqueRequests = [...new Set(futureDays.map(d => d.requestid))].slice(0, 5);

        if (uniqueRequests.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:20px; opacity:0.5;">No hay salidas próximas.</p>';
            return;
        }

        container.innerHTML = uniqueRequests.map(reqId => {
            const req = StateManager.data.vacationrequests.find(r => r.id === reqId);
            const col = StateManager.getCollaboratorById(req.collaboratorid);
            const firstDay = futureDays.find(d => d.requestid === reqId);
            const startDate = new Date(firstDay.actualdate);
            
            return `
                <div class="upcoming-item">
                    <div class="upcoming-date">
                        ${startDate.toLocaleDateString('es-ES', {month: 'short'}).toUpperCase()}
                        <strong>${startDate.getDate()}</strong>
                    </div>
                    <div class="upcoming-info">
                        <div style="font-weight:600;">${col ? col.name : 'Desconocido'}</div>
                        <div style="font-size:0.75rem; color:var(--text-secondary);">${req.dayscount} días hábiles</div>
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
            
            html += `
                <div class="calendar-day">
                    <div class="calendar-day-num">${day}</div>
                    <div class="calendar-events-list">
                        ${dayEvents.map(e => {
                            let inlineStyle = '';
                            if (!e.isWeekend) {
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
                            <div class="calendar-event status-${e.isWeekend ? 'weekend' : 'dynamic'}" style="${inlineStyle}" title="${e.colName}">
                                ${e.colName}
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
                                <i class="fas fa-calendar-check"></i> Registro completo de aniversario
                            </p>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-secondary);">Saldo Disponible</div>
                            <div style="font-size: 2.5rem; font-weight: 800; color: var(--primary-color); line-height: 1;">${balance.balance} <span style="font-size: 1rem; font-weight: 400;">días</span></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="periods-timeline" style="display: flex; flex-direction: column; gap: 30px;">
                ${balance.periods.length === 0 ? `
                    <div class="card" style="text-align:center; padding: 40px;">
                        <i class="fas fa-clock" style="font-size: 2rem; opacity: 0.2; margin-bottom: 15px;"></i>
                        <p>Aún no se cumplen aniversarios laborales.</p>
                    </div>
                ` : ''}

                ${[...balance.periods].reverse().map(p => {
                    const progress = (p.used / p.days) * 100;
                    return `
                    <div class="card period-card" style="padding: 0; overflow: hidden; border: 1px solid var(--border-color);">
                        <div class="period-header" style="padding: 15px 25px; background-color: #f9f9fb; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span class="badge" style="background-color: var(--primary-color); color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.7rem; margin-right: 10px;">AÑO ${p.year}</span>
                                <strong style="font-size: 1.1rem;">Periodo ${p.label}</strong>
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary);">
                                <i class="fas fa-info-circle"></i> Vence el ${new Date(p.activationDate).toLocaleDateString()}
                            </div>
                        </div>
                        <div class="period-body" style="padding: 25px;">
                            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 30px; margin-bottom: 25px;">
                                <div class="period-stats">
                        <div class="card" style="margin-bottom: 25px; border-left: 5px solid var(--primary-color);">
                            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 15px; border-bottom: 1px solid #eee;">
                                <div>
                                    <h3 style="margin:0;">
                                    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 15px; border-bottom: 1px solid #eee;">
                                        <div>
                                            <h3 style="margin:0;">
                                                Año ${p.year} <small style="font-weight: normal; opacity: 0.6;">(${p.label})</small>
                                            </h3>
                                            <p style="margin:5px 0 0; font-size: 0.75rem; color: var(--text-secondary);">
                                                Periodo de antigüedad. Activación legal: <strong>${new Date(p.activationDate + 'T12:00:00').toLocaleDateString()}</strong>
                                            </p>
                                        </div>
                                        <div style="text-align: right;">
                                            <div style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary);">Días Asignados 
                                                <button class="btn-icon admin-only" onclick="Visualizer.editPeriodDays(${p.year}, ${p.days})" style="display:inline-flex; width:20px; height:20px;"><i class="fas fa-pencil-alt" style="font-size:0.6rem;"></i></button>
                                            </div>
                                            <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color);">${p.days}</div>
                                        </div>
                                    </div>

                                    <div style="padding: 20px 0; display: grid; grid-template-columns: 1fr 200px; gap: 30px; align-items: center;">
                                        <div>
                                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                                <div style="font-size: 0.85rem; font-weight: 600;">Consumo de días hábiles</div>
                                                <div style="display: flex; gap: 15px;">
                                                    <div style="font-size: 0.7rem; text-transform: uppercase;">Disponibles</div>
                                                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--success-color);">${p.balance}</div>
                                                    <div style="font-size: 0.7rem; text-transform: uppercase;">Usados</div>
                                                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--secondary-color);">${p.used}</div>
                                                </div>
                                            </div>
                                            <div class="progress-bar" style="height: 8px; background-color: #eee; border-radius: 4px; overflow: hidden;">
                                                <div style="width: ${progress}%; height: 100%; background-color: var(--secondary-color);"></div>
                                            </div>
                                        </div>
                                        <div style="display:flex; align-items:center; color:var(--text-secondary); font-size:0.85rem; line-height:1.2;">
                                            Consumo secuencial por antigüedad (FIFO). Se agotan primero los días de este periodo antes de pasar al siguiente.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <table class="day-breakdown-table">
                                <thead>
                                    <tr>
                                        <th style="width: 150px;">Fecha</th>
                                        <th>Notas / Observaciones</th>
                                        <th style="width: 150px;">Periodo Asignado</th>
                                        <th style="width: 80px;" class="admin-only"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${p.daysList.length === 0 ? '<tr><td colspan="4" style="text-align:center; padding:15px; opacity:0.5;">Sin días consumidos de este periodo.</td></tr>' : ''}
                                    ${p.daysList.map(d => `
                                        <tr style="${!d.isBusinessDay ? 'opacity: 0.6; background-color: #fcfcfc;' : ''}">
                                            <td>
                                                <strong style="${!d.isBusinessDay ? 'color: var(--text-secondary);' : ''}">${new Date(d.actualdate + 'T12:00:00').toLocaleDateString()}</strong>
                                                ${!d.isBusinessDay ? '<span style="display:block; font-size: 0.65rem; color: #999; font-weight: normal;">(Día no laborable)</span>' : ''}
                                                <div class="admin-only" style="margin-top:4px;">
                                                    <select class="status-select input-field" style="padding:2px; font-size:0.7rem; height:auto" onchange="Visualizer.updateDayStatus('${d.id}', this.value)">
                                                        <option value="approved" ${d.status === 'approved' ? 'selected' : ''}>Aprobado</option>
                                                        <option value="programmed" ${d.status === 'programmed' ? 'selected' : ''}>Programado</option>
                                                        <option value="cancelled" ${d.status === 'cancelled' ? 'selected' : ''}>Cancelado</option>
                                                    </select>
                                                </div>
                                            </td>
                                            <td>
                                                <input type="text" class="note-input admin-only" value="${d.notes || ''}" 
                                                       placeholder="Agregar nota..." 
                                                       onblur="Visualizer.updateDayNote('${d.id}', this.value)">
                                                <span class="guest-only" style="font-size: 0.8rem; color: #666;">${d.notes || ''}</span>
                                            </td>
                                            <td>
                                                <div class="admin-only">
                                                    <select class="status-select input-field" style="padding:2px; font-size:0.7rem; height:auto; color: ${d.isManual ? 'var(--primary-color)' : 'inherit'}; font-weight: ${d.isManual ? '600' : 'normal'}" 
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
                                                <button class="btn-icon delete" onclick="Visualizer.deleteSingleDay('${d.id}')" title="Borrar permanentemente">
                                                    <i class="fas fa-times"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    `;
                }).join('')}
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

        const colId = this.currentCollaboratorId;
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
    }
};

window.Visualizer = Visualizer;
