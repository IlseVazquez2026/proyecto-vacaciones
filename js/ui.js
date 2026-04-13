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
        // Formulario de login ya está en AuthManager
        // Solo necesitamos que se inicie después de StateManager
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

        // Eventos de Colaboradores (Búsqueda global)
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

        // Filtros de la tabla de colaboradores
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderCollaboratorsTable(btn.dataset.filter, search ? search.value : '');
            });
        });

        // Modal de Colaboradores
        document.getElementById('btn-add-collaborator').onclick = () => {
            if (AuthManager.checkPermission('create')) this.showModal();
        };

        // Modal de Usuarios
        const btnAddUser = document.getElementById('btn-add-user');
        if (btnAddUser) {
            btnAddUser.onclick = () => this.showUserModal();
        }

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.onclick = () => {
                document.getElementById('collaborator-modal').classList.remove('active');
                document.getElementById('user-modal').classList.remove('active');
            };
        });

        document.getElementById('collaborator-form').onsubmit = (e) => this.handleFormSubmit(e);
        document.getElementById('user-form').onsubmit = (e) => this.handleUserFormSubmit(e);
        
        // Formulario de Vacaciones Rápidas (Dashboard)
        const quickVacForm = document.getElementById('quick-vacation-form');
        if (quickVacForm) {
            quickVacForm.onsubmit = (e) => this.handleVacationSubmit(e);
        }

        // Eventos de Configuración
        const btnUpload = document.getElementById('btn-trigger-upload');
        const fileInput = document.getElementById('historical-file-input');
        const uploadArea = document.getElementById('upload-personnel-area');

        if (btnUpload && fileInput) {
            btnUpload.onclick = () => { if (AuthManager.checkPermission('admin')) fileInput.click(); };
            uploadArea.onclick = () => { if (AuthManager.checkPermission('admin')) fileInput.click(); };
            fileInput.onchange = (e) => {
                if (e.target.files.length > 0) {
                    this.showToast(`Procesando archivo: ${e.target.files[0].name}`, 'info');
                }
            };
        }

        const btnReset = document.getElementById('btn-reset-data');
        if (btnReset) {
            btnReset.onclick = () => {
                if (!AuthManager.checkPermission('admin')) return;
                if (confirm('¿ESTÁS SEGURO? Esta acción borrará TODO el historial y colaboradores localmente.')) {
                    localStorage.clear();
                    location.reload();
                }
            };
        }

        const btnExport = document.getElementById('btn-export-data');
        if (btnExport) {
            btnExport.onclick = () => {
                if (AuthManager.checkPermission('admin')) {
                    this.handleExportAllHistory();
                }
            };
        }
    },

    navigate(navId, params = null) {
        // Actualizar UI del Sidebar
        document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
        const activeNav = document.getElementById(navId);
        if (activeNav) activeNav.classList.add('active');

        // Ocultar todas las vistas
        document.querySelectorAll('.app-view').forEach(v => v.style.display = 'none');

        // Mostrar vista destino
        const viewId = navId.replace('nav-', 'view-');
        const viewEl = document.getElementById(viewId);
        if (viewEl) {
            viewEl.style.display = 'block';
            this.currentView = viewId.replace('view-', '');
            
            // Actualizar visibilidad de herramientas superiores
            this.updateTopbarVisibility(this.currentView);
            
            // Actualizar contenido según la vista
            this.refreshView(this.currentView, params);
        }
    },

    updateTopbarVisibility(view) {
        const topSearch = document.getElementById('top-search-bar');
        const btnAdd = document.getElementById('btn-add-collaborator');
        
        // El buscador ya fue removido/oculto del HTML, aseguramos visibilidad hidden
        if (topSearch) topSearch.style.visibility = 'hidden';
        
        // Botón nuevo solo en Colaboradores
        if (btnAdd) {
            btnAdd.style.display = (view === 'collaborators') ? 'flex' : 'none';
        }
    },

    refreshView(view, params) {
        switch(view) {
            case 'dashboard':
                Visualizer.renderDashboard();
                break;
            case 'collaborators':
                this.renderCollaboratorsTable();
                this.renderStats();
                break;
            case 'vacations':
                Visualizer.renderCalendar();
                break;
            case 'history':
                if (params) {
                    document.getElementById('history-col-select').value = params;
                    Visualizer.selectedColId = params;
                }
                Visualizer.populateColSelect();
                Visualizer.renderHistory();
                break;
            case 'personnel':
                Visualizer.renderPersonnelPanel();
                break;
            case 'config':
                Visualizer.renderUserManagement();
                break;
        }
    },

    // --- LÓGICA DE COLABORADORES ---
    renderCollaboratorsTable(filter = 'all', search = '') {
        const body = document.getElementById('collaborators-body');
        if (!body) return;

        const collaborators = StateManager.getCollaborators(filter, search);
        body.innerHTML = '';

        if (collaborators.length === 0) {
            body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:40px; color:var(--text-secondary);">No se encontraron colaboradores.</td></tr>';
            return;
        }

        collaborators.forEach(col => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600;">${col.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">ID: ${col.id}</div>
                </td>
                <td>${this.formatDate(col.hireDate)}</td>
                <td><span class="status-pill pill-${col.status}">${col.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn-icon edit-btn" title="Editar" onclick="if(AuthManager.checkPermission('edit')) UIManager.showModal('${col.id}');"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon delete-btn delete" title="Dar de baja" onclick="UIManager.handleQuickDelete('${col.id}')" ${col.status === 'inactive' ? 'style="display:none"' : ''}><i class="fas fa-user-minus"></i></button>
                    </div>
                </td>
            `;

            body.appendChild(tr);
        });
    },

    renderStats() {
        const stats = StateManager.getStats();
        // DASHBOARD / REGISTRO
        const dashTotal = document.getElementById('dash-total');
        const dashOnLeave = document.getElementById('dash-on-leave');
        if (dashTotal) dashTotal.textContent = stats.total;
        if (dashOnLeave) dashOnLeave.textContent = stats.onLeave;

        // COLLABORATORS
        ['stat-total', 'stat-active', 'stat-on-leave'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = stats[id.replace('stat-', '')];
        });
    },

    // --- OPERACIONES DE VACACIONES ---
    async handleVacationSubmit(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;

        const data = {
            collaboratorId: document.getElementById('vac-col-select').value,
            observations: document.getElementById('vac-notes').value,
            status: 'approved' 
        };

        if (!data.collaboratorId) {
            this.showToast('Selecciona un colaborador', 'error');
            return;
        }

        if (Visualizer.selectedDates.length === 0) {
            this.showToast('Selecciona al menos un día en el calendario', 'error');
            return;
        }

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            const days = Visualizer.selectedDates.map(date => ({
                collaboratorId: data.collaboratorId,
                originalDate: date,
                actualDate: date,
                status: 'approved',
                notes: ''
            }));

            await StateManager.saveVacationRequest({ 
                ...data, 
                daysCount: Visualizer.selectedDates.length,
                startDate: Visualizer.selectedDates.sort()[0],
                endDate: Visualizer.selectedDates.sort()[Visualizer.selectedDates.length - 1]
            }, days);

            this.showToast('Vacaciones registradas correctamente', 'success');
            
            document.getElementById('quick-vacation-form').reset();
            Visualizer.selectedDates = [];
            Visualizer.renderMiniCalendar();
            this.refreshView('dashboard');

        } catch (err) {
            this.showToast('Error al guardar: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    },

    async handleDeleteRequest(reqId) {
        if (!AuthManager.checkPermission('delete')) return;
        if (confirm('¿Eliminar esta solicitud completa? El histórico se recalculará.')) {
            await StateManager.deleteVacationRequest(reqId);
            this.showToast('Solicitud eliminada', 'success');
            this.refreshView('history');
        }
    },

    // --- MODALES ---
    showModal(id = null) {
        const modal = document.getElementById('collaborator-modal');
        const form = document.getElementById('collaborator-form');
        if (form) form.reset();
        
        const colIdInput = document.getElementById('col-id');
        const colOldIdInput = document.getElementById('col-old-id');
        const modalTitle = document.getElementById('modal-title');
        
        if (colIdInput) colIdInput.value = id || '';
        if (colOldIdInput) colOldIdInput.value = id || '';
        if (modalTitle) modalTitle.textContent = id ? 'Editar Colaborador' : 'Nuevo Colaborador';

        if (id) {
            const col = StateManager.getCollaboratorById(id);
            if (col) {
                document.getElementById('col-name').value = col.name;
                document.getElementById('col-hire-date').value = col.hireDate;
                document.getElementById('col-status').value = col.status;
                document.getElementById('col-notes').value = col.notes || '';
            }
        }
        modal.classList.add('active');
    },

    showUserModal(userId = null) {
        const modal = document.getElementById('user-modal');
        const form = document.getElementById('user-form');
        if (form) form.reset();
        
        const userIdInput = document.getElementById('user-id');
        const userModalTitle = document.getElementById('user-modal-title');
        
        if (userIdInput) userIdInput.value = userId || '';
        if (userModalTitle) userModalTitle.textContent = userId ? 'Editar Usuario' : 'Nuevo Usuario';

        if (userId) {
            const users = StateManager.getUsers();
            const user = users.find(u => u.id === userId);
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
        const originalText = btn.innerHTML;

        const oldIdInput = document.getElementById('col-old-id');
        const oldId = oldIdInput ? oldIdInput.value : null;
        
        const colData = {
            id: document.getElementById('col-id').value,
            name: document.getElementById('col-name').value,
            hireDate: document.getElementById('col-hire-date').value,
            status: document.getElementById('col-status').value,
            notes: document.getElementById('col-notes').value
        };

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';

            await StateManager.saveCollaborator(colData, oldId);
            this.showToast(colData.id ? 'Cambios guardados' : 'Colaborador creado', 'success');
            document.getElementById('collaborator-modal').classList.remove('active');
            
            this.refreshView(this.currentView);
            this.renderStats();
            
            if (this.currentView === 'history') {
                Visualizer.populateColSelect();
                if (oldId && Visualizer.selectedColId === oldId) {
                    Visualizer.selectedColId = colData.id;
                    Visualizer.renderHistory();
                }
            }
        } catch (err) {
            this.showToast(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    },

    async handleUserFormSubmit(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;

        const userId = document.getElementById('user-id').value;
        const existingData = StateManager.getUsers().find(u => u.id === userId) || {};
        const userData = {
            id: userId,
            name: document.getElementById('user-name').value,
            username: document.getElementById('user-username').value,
            password: document.getElementById('user-password').value,
            role: document.getElementById('user-role').value,
            status: existingData.status || 'active'
        };

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
            await StateManager.saveUser(userData);
            this.showToast('Usuario guardado', 'success');
            document.getElementById('user-modal').classList.remove('active');
            Visualizer.renderUserManagement();
        } catch (err) {
            this.showToast('Error: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
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

        if (confirm('¿Dar de baja a este colaborador? El histórico se conservará.')) {
            await StateManager.deleteCollaborator(id);
            this.showToast('Baja procesada correctamente', 'success');
            this.refreshView('collaborators');
            this.renderStats();
        }
    },

    handleDownloadTemplate() {
        const data = [
            ["Nombre Completo", "Fecha Ingreso (AAAA-MM-DD)", "Area", "Estatus (active/inactive)", "Notas"],
            ["Juan Perez", "2023-01-15", "Ventas", "active", "Coordinador/Pendiente de validar"]
        ];
        this.downloadExcel(data, 'plantilla_personal.xlsx', 'Plantilla');
    },

    handleExportAllHistory() {
        // Exportación detallada: fila por cada día de vacación
        const days = StateManager.data.vacationDays || [];
        const data = [
            ["ID Empleado", "Nombre", "Fecha de Vacación", "Estatus", "Notas"]
        ];

        days.forEach(d => {
            const col = StateManager.getCollaboratorById(d.collaboratorId);
            if (col) {
                data.push([
                    col.id,
                    col.name,
                    d.actualDate,
                    d.status,
                    d.notes || ''
                ]);
            }
        });

        this.downloadExcel(data, 'historico_completo_vacaciones.xlsx', 'Historico');
    },

    downloadExcel(dataArray, filename, sheetName = "Datos") {
        try {
            if (typeof XLSX !== 'undefined') {
                const ws = XLSX.utils.aoa_to_sheet(dataArray);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
                XLSX.writeFile(wb, filename);
                this.showToast('Archivo Excel descargado', 'success');
                return;
            }
        } catch(e) {
            console.error('Error usando XLSX, aplicando alternativa', e);
        }
        
        // Alternativa CSV garantizada sin Blobs (para evitar UUIDs internos)
        let csvContent = "\uFEFF";
        dataArray.forEach(row => {
            let csvRow = row.map(item => `"${String(item || '').replace(/"/g, '""')}"`).join(",");
            csvContent += csvRow + "\n";
        });
        
        const uri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", uri);
        link.setAttribute("download", filename.replace('.xlsx', '.csv'));
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showToast('Descarga iniciada de forma nativa', 'success');
    },

    downloadExcelHTML(html, filename) {
        const fullHtml = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta charset="UTF-8"></head>
            <body>${html}</body>
            </html>
        `;
        const blob = new Blob([fullHtml], { type: 'application/vnd.ms-excel' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.showToast('Archivo Excel descargado', 'success');
    },

    formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'fa-check-circle';
        if (type === 'error') icon = 'fa-exclamation-circle';
        if (type === 'info') icon = 'fa-info-circle';

        toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
};

window.UIManager = UIManager;
