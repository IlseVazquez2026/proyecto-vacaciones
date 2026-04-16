/**
 * ui.js - Agente de Interfaz y Navegación
 * Maneja la navegación SPA y la coordinación entre agentes (Control y Visualización).
 */

const UIManager = {
    // Elements
    mainView: document.getElementById('main-view'),
    onLeaveStat: document.getElementById('stat-on-leave'),
    
    currentView: 'collaborators',

    init() {
        this.setupNavigation();
        this.setupAuthHandlers();
        this.renderStats();
        // Cargar vista inicial
        this.navigate('nav-dashboard');
    },

    setupAuthHandlers() {
        AuthManager.init();
    },

    setupNavigation() {
        // NAVEGACIÓN PRINCIPAL (Sidebar)
        const navItems = {
            'nav-dashboard': 'view-dashboard',
            'nav-collaborators': 'view-collaborators',
            'nav-vacations': 'view-vacations',
            'nav-history': 'view-history',
            'nav-personnel': 'view-personnel',
            'nav-holidays': 'view-holidays',
            'nav-permissions': 'view-permissions',
            'nav-config': 'view-config'
        };

        Object.keys(navItems).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.navigate(id);
                });
            }
        });

        const search = document.getElementById('global-search');
        if (search) {
            search.addEventListener('input', (e) => {
                if (this.currentView === 'collaborators') {
                    const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
                    this.renderCollaboratorsTable(activeFilter, e.target.value);
                } else if (this.currentView === 'personnel') {
                    this.renderPersonnelPanelSearch(e.target.value);
                }
            });
        }

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderCollaboratorsTable(btn.dataset.filter, search ? search.value : '');
            });
        });

        document.getElementById('btn-add-collaborator').onclick = () => {
            if (AuthManager.checkPermission('create')) this.showModal();
        };

        const btnAddUser = document.getElementById('btn-add-user');
        if (btnAddUser) {
            btnAddUser.onclick = () => this.showUserModal();
        }

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.onclick = () => {
                document.getElementById('collaborator-modal').classList.remove('active');
                document.getElementById('user-modal').classList.remove('active');
                document.getElementById('modal-holiday').classList.remove('active');
            };
        });

        document.getElementById('collaborator-form').onsubmit = (e) => this.handleFormSubmit(e);
        document.getElementById('user-form').onsubmit = (e) => this.handleUserFormSubmit(e);
        document.getElementById('form-holiday').onsubmit = (e) => this.handleHolidaySubmit(e);

        const btnAddHoliday = document.getElementById('btn-show-add-holiday-modal');
        if (btnAddHoliday) {
            btnAddHoliday.onclick = () => {
                if (AuthManager.checkPermission('admin')) {
                    document.getElementById('modal-holiday').classList.add('active');
                }
            };
        }
        
        const quickVacForm = document.getElementById('quick-vacation-form');
        if (quickVacForm) {
            quickVacForm.onsubmit = (e) => this.handleVacationSubmit(e);
        }

        const permissionForm = document.getElementById('permission-form');
        if (permissionForm) {
            permissionForm.onsubmit = (e) => this.handlePermissionSubmit(e);
        }

        const btnPermCancel = document.getElementById('btn-perm-cancel');
        if (btnPermCancel) {
            btnPermCancel.onclick = () => this.handleCancelPermissionEdit();
        }

        const btnUpload = document.getElementById('btn-trigger-upload');
        const fileInput = document.getElementById('historical-file-input');
        const uploadArea = document.getElementById('upload-personnel-area');

        if (btnUpload && fileInput) {
            btnUpload.onclick = () => { if (AuthManager.checkPermission('admin')) fileInput.click(); };
            uploadArea.onclick = () => { if (AuthManager.checkPermission('admin')) fileInput.click(); };
            fileInput.onchange = async (e) => {
                if (e.target.files.length > 0) {
                    await this.handleFileUpload(e.target.files[0]);
                    e.target.value = ''; 
                }
            };
        }

        const btnReset = document.getElementById('btn-reset-data');
        if (btnReset) {
            btnReset.onclick = () => {
                if (!AuthManager.checkPermission('admin')) return;
                if (confirm('¿ESTÁS SEGURO?')) {
                    localStorage.clear();
                    location.reload();
                }
            };
        }

        const btnHistoryUpload = document.getElementById('btn-trigger-history-upload');
        const historyFileInput = document.getElementById('history-file-input');
        const historyUploadArea = document.getElementById('upload-history-area');

        if (btnHistoryUpload && historyFileInput) {
            btnHistoryUpload.onclick = () => { if (AuthManager.checkPermission('admin')) historyFileInput.click(); };
            historyUploadArea.onclick = () => { if (AuthManager.checkPermission('admin')) historyFileInput.click(); };
            historyFileInput.onchange = async (e) => {
                if (e.target.files.length > 0) {
                    await this.handleHistoryFileUpload(e.target.files[0]);
                    e.target.value = ''; 
                }
            };
        }

        const btnExport = document.getElementById('btn-export-data');
        if (btnExport) {
            btnExport.onclick = () => {
                if (AuthManager.checkPermission('admin')) this.handleExportAllHistory();
            };
        }

        const btnExportInd = document.getElementById('btn-export-individual');
        if (btnExportInd) {
            btnExportInd.onclick = () => {
                if (AuthManager.checkPermission('admin')) this.handleIndividualExport();
            };
        }
    },

    navigate(navId, params = null) {
        document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
        const activeNav = document.getElementById(navId);
        if (activeNav) activeNav.classList.add('active');

        document.querySelectorAll('.app-view').forEach(v => v.style.display = 'none');

        const viewId = navId.replace('nav-', 'view-');
        const viewEl = document.getElementById(viewId);
        if (viewEl) {
            viewEl.style.display = 'block';
            this.currentView = viewId.replace('view-', '');
            this.updateTopbarVisibility(this.currentView);
            this.refreshView(this.currentView, params);
        }
    },

    updateTopbarVisibility(view) {
        const topSearch = document.getElementById('top-search-bar');
        const btnAdd = document.getElementById('btn-add-collaborator');
        if (topSearch) topSearch.style.visibility = 'hidden';
        if (btnAdd) btnAdd.style.display = (view === 'collaborators') ? 'flex' : 'none';
    },

    refreshView(view, params) {
        switch(view) {
            case 'dashboard': Visualizer.renderDashboard(); break;
            case 'collaborators': this.renderCollaboratorsTable(); this.renderStats(); break;
            case 'vacations': Visualizer.renderCalendar(); break;
            case 'history':
                if (params) {
                    document.getElementById('history-col-select').value = params;
                    Visualizer.selectedColId = params;
                }
                Visualizer.populateColSelect();
                Visualizer.renderHistory();
                break;
            case 'personnel': Visualizer.renderPersonnelPanel(); break;
            case 'holidays': this.renderHolidaysTable(); break;
            case 'permissions': Visualizer.renderPermissionsView(); break;
            case 'config': Visualizer.renderUserManagement(); break;
        }
    },

    renderCollaboratorsTable(filter = 'all', search = '') {
        const body = document.getElementById('collaborators-body');
        if (!body) return;
        const collaborators = StateManager.getCollaborators(filter, search);
        body.innerHTML = '';
        if (collaborators.length === 0) {
            const msg = search ? 'No se encontraron coincidencias.' : 'No hay colaboradores registrados o hay un problema de conexión.';
            body.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:60px; color: var(--text-secondary); opacity: 0.6;">
                <i class="fas fa-users-slash" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                ${msg}
            </td></tr>`;
            return;
        }
        collaborators.forEach(col => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600;">${col.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">ID: ${col.id}</div>
                </td>
                <td>${this.formatDate(col.hiredate)}</td>
                <td><span class="status-pill pill-${col.status}">${col.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn-icon edit-btn" onclick="if(AuthManager.checkPermission('edit')) UIManager.showModal('${col.id}');"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon delete delete-btn" onclick="UIManager.handleQuickDelete('${col.id}')" ${col.status === 'inactive' ? 'style="display:none"' : ''}><i class="fas fa-user-minus"></i></button>
                    </div>
                </td>
            `;
            body.appendChild(tr);
        });
    },

    renderStats() {
        const stats = StateManager.getStats();
        const dashTotal = document.getElementById('dash-total');
        const dashOnLeave = document.getElementById('dash-on-leave');
        if (dashTotal) dashTotal.textContent = stats.total;
        if (dashOnLeave) dashOnLeave.textContent = stats.onLeave;
        ['stat-total', 'stat-active', 'stat-on-leave'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const key = id.replace('stat-', '');
                const finalKey = key === 'on-leave' ? 'onLeave' : key;
                el.textContent = stats[finalKey] || 0;
            }
        });
    },

    async handleVacationSubmit(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        const data = {
            collaboratorid: document.getElementById('vac-col-select').value,
            observations: document.getElementById('vac-notes').value,
            status: 'approved' 
        };
        if (!data.collaboratorid || Visualizer.selectedDates.length === 0) {
            this.showToast('Completa los datos', 'error'); return;
        }
        try {
            btn.disabled = true; btn.innerHTML = '...';
            const days = Visualizer.selectedDates.map(date => ({
                collaboratorid: data.collaboratorid,
                originaldate: date,
                actualdate: date,
                status: 'approved',
                notes: ''
            }));
            await StateManager.saveVacationRequest({ 
                ...data, 
                dayscount: Visualizer.selectedDates.length,
                startdate: Visualizer.selectedDates.sort()[0],
                enddate: Visualizer.selectedDates.sort()[Visualizer.selectedDates.length - 1]
            }, days);
            this.showToast('Éxito', 'success');
            document.getElementById('quick-vacation-form').reset();
            Visualizer.selectedDates = [];
            Visualizer.renderMiniCalendar();
            this.refreshView('dashboard');
        } catch (err) { this.showToast(err.message, 'error'); } 
        finally { btn.disabled = false; btn.innerHTML = originalText; }
    },

    async handlePermissionSubmit(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        
        const colId = document.getElementById('perm-col-select').value;
        const date = Visualizer.permissionSelectedDate;
        const startTime = document.getElementById('perm-start-time').value;
        const endTime = document.getElementById('perm-end-time').value;
        const reason = document.getElementById('perm-reason').value;

        if (!colId || !date) {
            this.showToast('Selecciona colaborador y fecha en el calendario', 'error');
            return;
        }

        try {
            btn.disabled = true; btn.innerHTML = '...';
            
            const totalHours = VacationManager.calculateHours(startTime, endTime);

            await StateManager.savePermission({
                id: Visualizer.editingPermissionId, // Si es null, el StateManager generará uno nuevo
                collaboratorid: colId,
                date: date,
                start_time: startTime,
                end_time: endTime,
                total_hours: totalHours,
                notes: reason,
                status: 'approved'
            });

            this.showToast(Visualizer.editingPermissionId ? 'Permiso actualizado' : 'Permiso registrado', 'success');
            this.handleCancelPermissionEdit(); // Limpia el formulario y el estado
            Visualizer.renderPermissionsView();
        } catch (err) {
            this.showToast('Error: ' + err.message, 'error');
        } finally {
            btn.disabled = false; btn.innerHTML = originalText;
        }
    },

    handleEditPermission(id) {
        const p = StateManager.data.permissions.find(perm => perm.id === id);
        if (!p) return;

        Visualizer.editingPermissionId = id;
        Visualizer.permissionSelectedDate = p.date;
        
        document.getElementById('perm-col-select').value = p.collaboratorid;
        document.getElementById('perm-start-time').value = p.start_time;
        document.getElementById('perm-end-time').value = p.end_time;
        document.getElementById('perm-reason').value = p.notes || '';
        document.getElementById('perm-selected-date-text').textContent = 'Fecha: ' + this.formatDate(p.date);
        
        // UI Feedback
        document.getElementById('btn-perm-submit').innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
        document.getElementById('btn-perm-cancel').style.display = 'block';
        
        Visualizer.renderPermissionMiniCalendar(); // Actualiza selección en mini calendar
    },

    handleCancelPermissionEdit() {
        Visualizer.editingPermissionId = null;
        Visualizer.permissionSelectedDate = null;
        document.getElementById('permission-form').reset();
        document.getElementById('perm-selected-date-text').textContent = 'Ninguna fecha seleccionada';
        document.getElementById('btn-perm-submit').innerHTML = '<i class="fas fa-save"></i> Registrar Permiso';
        document.getElementById('btn-perm-cancel').style.display = 'none';
        Visualizer.renderPermissionMiniCalendar();
    },

    async handleDeleteMonthPermissions(year, month) {
        if (!AuthManager.checkPermission('admin')) return;
        const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const monthName = months[month];
        
        if (confirm(`¿ESTÁS SEGURO?\nEsta acción eliminará TODOS los registros de permisos de ${monthName} ${year}.\nEste proceso es irreversible.`)) {
            await StateManager.deletePermissionsByMonth(year, month);
            this.showToast(`Historial de ${monthName} eliminado`, 'success');
            Visualizer.renderPermissionsView();
        }
    },

    async handleDeletePermission(id) {
        if (!AuthManager.checkPermission('admin')) return;
        if (confirm('¿Eliminar este registro de permiso?')) {
            await StateManager.deletePermission(id);
            this.showToast('Permiso eliminado', 'success');
            Visualizer.renderPermissionsView();
        }
    },

    showModal(id = null) {
        const modal = document.getElementById('collaborator-modal');
        const form = document.getElementById('collaborator-form');
        form.reset();
        document.getElementById('col-id').value = id || '';
        document.getElementById('col-old-id').value = id || '';
        if (id) {
            const col = StateManager.getCollaboratorById(id);
            if (col) {
                document.getElementById('col-name').value = col.name;
                document.getElementById('col-hire-date').value = col.hiredate;
                document.getElementById('col-status').value = col.status;
                document.getElementById('col-notes').value = col.notes || '';
            }
        }
        modal.classList.add('active');
    },

    showUserModal(userId = null) {
        const modal = document.getElementById('user-modal');
        document.getElementById('user-form').reset();
        document.getElementById('user-id').value = userId || '';
        if (userId) {
            const user = StateManager.getUsers().find(u => u.id === userId);
            if (user) {
                document.getElementById('user-name').value = user.name;
                document.getElementById('user-username').value = user.username;
                document.getElementById('user-password').value = user.password;
                document.getElementById('user-role').value = user.role;
            }
        }
        modal.classList.add('active');
    },

    async handleFormSubmit(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const oldId = document.getElementById('col-old-id').value;
        const colData = {
            id: document.getElementById('col-id').value,
            name: document.getElementById('col-name').value,
            hiredate: document.getElementById('col-hire-date').value,
            status: document.getElementById('col-status').value,
            notes: document.getElementById('col-notes').value
        };
        try {
            btn.disabled = true; btn.innerHTML = '...';
            await StateManager.saveCollaborator(colData, oldId);
            this.showToast('Éxito', 'success');
            document.getElementById('collaborator-modal').classList.remove('active');
            this.refreshView(this.currentView);
        } catch (err) { this.showToast(err.message, 'error'); } 
        finally { btn.disabled = false; btn.innerHTML = 'Guardar'; }
    },

    async toggleUserSuspension(id) {
        if (!AuthManager.checkPermission('admin')) return;
        const users = StateManager.getUsers();
        let user = users.find(u => u.id === id);
        if (user) {
            user.status = user.status === 'suspended' ? 'active' : 'suspended';
            await StateManager.saveUser(user);
            this.showToast(`Usuario ${user.status === 'suspended' ? 'suspendido' : 'activado'}`, 'info');
            Visualizer.renderUserManagement();
        }
    },

    async handleDeleteUser(id) {
        if (!AuthManager.checkPermission('admin')) return;
        if (confirm('¿Eliminar este acceso?')) {
            await StateManager.deleteUser(id);
            this.showToast('Usuario eliminado', 'success');
            Visualizer.renderUserManagement();
        }
    },

    async handleQuickDelete(id) {
        if (!AuthManager.checkPermission('admin')) return;
        if (confirm('¡ADVERTENCIA! ¿Deseas eliminar permanentemente a este colaborador? SE BORRARÁ TODO SU HISTORIAL DE VACACIONES Y ESTA ACCIÓN ES IRREVERSIBLE.')) {
            try {
                await StateManager.deleteCollaborator(id);
                this.showToast('Colaborador eliminado definitivamente', 'success');
                this.refreshView('collaborators');
                this.refreshView('dashboard'); // Refrescar KPIs
                this.refreshView('personnel'); // Refrescar panel general
                Visualizer.populateColSelect(); // Refrescar selector de histórico
            } catch (err) {
                this.showToast('Error al eliminar: ' + err.message, 'error');
            }
        }
    },

    handleDownloadTemplate() {
        const data = [
            ["ID", "Nombre Completo", "Fecha Ingreso (AAAA-MM-DD)", "Area", "Estatus (active/inactive)", "Notas"],
            ["00", "Juan Perez", "2023-01-15", "Ventas", "active", "Coordinador"]
        ];
        this.downloadExcel(data, 'plantilla_personal.xlsx', 'Plantilla');
    },

    async handleFileUpload(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                if (rows.length === 0) return;

                const currentCols = StateManager.getCollaborators('all');
                let nextIdNum = 0;
                const numericIds = currentCols.map(c => parseInt(c.id)).filter(n => !isNaN(n));
                if (numericIds.length > 0) nextIdNum = Math.max(...numericIds) + 1;

                const collaboratorsToSave = rows.map(row => {
                    let id = row['ID'] || row['id'] || row['Clave'] || '';
                    if (!id) { id = String(nextIdNum).padStart(2, '0'); nextIdNum++; }
                    return {
                        id: String(id),
                        name: row['Nombre Completo'] || row['nombre'] || 'Sin Nombre',
                        hiredate: this.normalizeExcelDate(row['Fecha Ingreso (AAAA-MM-DD)'] || row['fecha']),
                        area: row['Area'] || row['area'] || '',
                        status: (row['Estatus (active/inactive)'] || row['estatus'] || 'active').toLowerCase(),
                        notes: row['Notas'] || row['notas'] || ''
                    };
                });

                await StateManager.bulkSaveCollaborators(collaboratorsToSave);
                this.showToast('Carga completada', 'success');
                this.refreshView(this.currentView);
            } catch (err) { this.showToast(err.message, 'error'); }
        };
        reader.readAsArrayBuffer(file);
    },

    normalizeExcelDate(val) {
        if (!val) return null;
        
        // Si ya es un objeto Date (por cellDates: true)
        if (val instanceof Date) {
            if (isNaN(val.getTime())) return null;
            return val.toISOString().split('T')[0];
        }

        const str = String(val).trim();
        if (str === '') return null;

        // 1. Caso: Formato Estandar AAAA-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

        // 2. Caso: Formato Numero de Excel
        if (typeof val === 'number') {
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
        }

        // 3. Caso: Formato DD/MM/AAAA o DD/MM/AA
        const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (dmyMatch) {
            let day = parseInt(dmyMatch[1]);
            let month = parseInt(dmyMatch[2]) - 1;
            let year = parseInt(dmyMatch[3]);
            if (year < 100) year += 2000; // Asumir 20xx para años de 2 digitos
            
            const date = new Date(year, month, day, 12, 0, 0);
            if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
        }

        // 4. Intento desesperado: Date nativo (Cuidado con local vs UTC)
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            // Si el string no incluye '/', JS suele tratarlo como UTC. 
            // Para historial, forzamos mediodia local para evitar saltos de día.
            const forcedDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
            return forcedDate.toISOString().split('T')[0];
        }

        return null; // Formato no reconocido
    },

    handleDownloadHistoryTemplate() {
        const data = [
            ["ID Empleado", "Fecha (AAAA-MM-DD)", "Estatus (approved/cancelled)", "Notas"],
            ["00", "2023-04-10", "approved", "Día disfrutado"],
            ["00", "2023-04-11", "approved", "Día disfrutado"]
        ];
        this.downloadExcel(data, 'plantilla_historial_vacaciones.xlsx', 'Historial');
    },

    async handleHolidaySubmit(e) {
        e.preventDefault();
        const date = document.getElementById('holiday-date').value;
        const title = document.getElementById('holiday-title').value;

        try {
            await StateManager.saveHoliday(date, title);
            this.showToast('Día festivo guardado correctamente', 'success');
            document.getElementById('modal-holiday').classList.remove('active');
            e.target.reset();
            this.refreshView('holidays');
        } catch (err) {
            this.showToast('Error: ' + err.message, 'error');
        }
    },

    renderHolidaysTable() {
        const body = document.getElementById('holidays-table-body');
        if (!body) return;
        const holidays = StateManager.getHolidays();
        body.innerHTML = '';

        if (holidays.length === 0) {
            body.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:40px;">No hay días festivos registrados.</td></tr>';
            return;
        }

        holidays.forEach(h => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${h.actualdate}</strong></td>
                <td>${h.notes}</td>
                <td class="text-right">
                    <button class="btn btn-danger-outline btn-sm" onclick="UIManager.confirmDeleteHoliday('${h.id}')">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            body.appendChild(tr);
        });
    },

    confirmDeleteHoliday(id) {
        if (confirm('¿Eliminar este día festivo?')) {
            StateManager.deleteHoliday(id).then(() => {
                this.showToast('Festivo eliminado', 'success');
                this.refreshView('holidays');
            }).catch(err => this.showToast('Error: ' + err.message, 'error'));
        }
    },

    async handleHistoryFileUpload(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
                const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                if (rows.length === 0) return;

                this.showToast(`Procesando historial de ${rows.length} registros...`, 'info');

                // 1. Agrupar por Empleado
                const groups = {};
                let skippedRows = 0;

                rows.forEach(row => {
                    const colid = String(row['ID Empleado'] || row['id'] || row['ID'] || '');
                    const dateRaw = row['Fecha (AAAA-MM-DD)'] || row['fecha'] || row['Fecha'];
                    if (!colid || !dateRaw) return;

                    const cleanDate = this.normalizeExcelDate(dateRaw);
                    if (!cleanDate) {
                        skippedRows++;
                        return;
                    }

                    if (!groups[colid]) groups[colid] = [];
                    groups[colid].push({
                        date: cleanDate,
                        status: (row['Estatus (approved/cancelled)'] || row['estatus'] || 'approved').toLowerCase(),
                        notes: row['Notas'] || row['notas'] || 'Carga Histórica'
                    });
                });

                if (skippedRows > 0) {
                    this.showToast(`Se omitieron ${skippedRows} registros por formato de fecha inválido.`, 'warning');
                }

                // 2. Acumular todas las solicitudes y días en vez de guardarlos 1 a 1
                let allRequests = [];
                let allDays = [];
                let employeesProcessed = 0;

                for (const colid in groups) {
                    const dates = groups[colid];
                    const sortedDates = dates.map(d => d.date).sort();
                    const reqid = 'req-hist-' + colid + '-' + Date.now();
                    
                    const request = {
                        id: reqid,
                        collaboratorid: colid,
                        startdate: sortedDates[0],
                        enddate: sortedDates[sortedDates.length - 1],
                        dayscount: dates.filter(d => VacationManager.isBusinessDay(d.date)).length,
                        status: 'approved',
                        observations: 'Carga Masiva de Historial'
                    };

                    const daysPayload = dates.map(d => ({
                        id: `d-hist-${Math.random().toString(36).substr(2, 9)}`,
                        requestid: reqid,
                        collaboratorid: colid,
                        originaldate: d.date,
                        actualdate: d.date,
                        status: d.status,
                        notes: d.notes
                    }));

                    allRequests.push(request);
                    allDays.push(...daysPayload);
                    employeesProcessed++;
                }

                // Aquí disparamos EL UPSERT MASIVO UNA SOLA VEZ
                this.showToast(`Escribiendo base de datos, por favor espera...`, 'info');
                await StateManager.bulkSaveHistory(allRequests, allDays);

                this.showToast(`Historial cargado con éxito: ${employeesProcessed} empleados actualizados.`, 'success');
                this.refreshView(this.currentView);
            } catch (err) {
                console.error(err);
                this.showToast('Error al procesar historial: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    },



    handleExportAllHistory() {
        const days = StateManager.data.vacationdays || [];
        const collaborators = StateManager.getCollaborators('all');
        this.processAndDownloadHistory(days, collaborators, `Historial_Vacaciones_Global_${new Date().toISOString().split('T')[0]}`);
    },

    handleIndividualExport() {
        const colId = document.getElementById('export-individual-select').value;
        if (!colId) {
            this.showToast('Por favor selecciona un colaborador', 'error');
            return;
        }

        const col = StateManager.getCollaboratorById(colId);
        if (!col) return;

        const allDays = StateManager.data.vacationdays || [];
        const individualDays = allDays.filter(d => d.collaboratorid === colId);
        
        if (individualDays.length === 0) {
            this.showToast(`El colaborador ${col.name} no tiene historial de vacaciones registrado.`, 'info');
            return;
        }

        this.processAndDownloadHistory(individualDays, [col], `Historial_${col.name.replace(/\s+/g, '_')}_${col.id}`);
    },

    // Helper para procesar y descargar (evita duplicar lógica)
    processAndDownloadHistory(days, collaborators, filename) {
        const dayPeriodMap = {};
        collaborators.forEach(col => {
            const balance = VacationManager.getCollaboratorBalance(col.id);
            if (balance && balance.periods) {
                balance.periods.forEach(p => {
                    if (p.daysList) {
                        p.daysList.forEach(d => {
                            dayPeriodMap[d.id] = `Año ${p.year}`;
                        });
                    }
                });
            }
        });

        const data = [["ID Empleado", "Nombre", "Fecha", "Periodo Asignado", "Estatus", "Notas"]];
        const sortedDays = [...days].sort((a,b) => new Date(b.actualdate + 'T12:00:00') - new Date(a.actualdate + 'T12:00:00'));

        sortedDays.forEach(d => {
            const col = StateManager.getCollaboratorById(d.collaboratorid);
            if (col) {
                const periodLabel = dayPeriodMap[d.id] || (d.status === 'cancelled' ? 'Cancelado' : 'N/A (Excedente)');
                data.push([col.id, col.name, this.formatDate(d.actualdate), periodLabel, d.status, d.notes || '']);
            }
        });
        
        this.downloadExcel(data, `${filename}.xlsx`);
    },

    downloadExcel(dataArray, filename) {
        const ws = XLSX.utils.aoa_to_sheet(dataArray);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Datos");
        XLSX.writeFile(wb, filename);
    },

    formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        const parts = dateStr.split('-');
        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('visible'), 10);
        setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 300); }, 3000);
    }
};

window.UIManager = UIManager;
