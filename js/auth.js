/**
 * auth.js - Agente de Autenticación y Permisos
 */

const AuthManager = {
    init() {
        this.checkSession();
        this.setupEventListeners();
    },

    checkSession() {
        const user = StateManager.getCurrentUser();
        if (!user) {
            this.showLogin();
        } else {
            this.hideLogin();
            this.applyPermissions(user.role);
        }
    },

    setupEventListeners() {
        const form = document.getElementById('login-form');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const user = document.getElementById('login-username').value;
                const pass = document.getElementById('login-password').value;
                const btn = form.querySelector('button[type="submit"]');
                const originalText = btn.innerHTML;
                
                try {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando...';
                    
                    const loggedInUser = await StateManager.login(user, pass);
                    this.hideLogin();
                    this.applyPermissions(loggedInUser.role);
                    UIManager.showToast(`Bienvenido, ${loggedInUser.name}`, 'success');
                    UIManager.refreshView(UIManager.currentView);
                } catch (err) {
                    const errEl = document.getElementById('login-error');
                    errEl.textContent = err.message;
                    errEl.style.display = 'block';
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }
            };
        }

        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.onclick = () => {
                StateManager.logout();
                location.reload();
            };
        }
    },

    showLogin() {
        const overlay = document.getElementById('login-overlay');
        if (overlay) overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    hideLogin() {
        const overlay = document.getElementById('login-overlay');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = 'auto';
    },

    applyPermissions(role) {
        const isAdmin = role === 'admin';
        document.body.classList.toggle('is-guest', !isAdmin);
        document.body.classList.toggle('is-admin', isAdmin);
        
        // Actualizar UI del perfil
        const user = StateManager.getCurrentUser();
        if (user) {
            document.querySelector('.user-name').textContent = user.name;
            document.querySelector('.user-role').textContent = isAdmin ? 'Administrador' : 'Invitado';
            document.querySelector('.avatar').textContent = user.name.substring(0, 2).toUpperCase();
        }
    },

    checkPermission(action) {
        const user = StateManager.getCurrentUser();
        if (!user) return false;
        if (user.role === 'admin') return true;
        
        UIManager.showToast('No tienes permisos para realizar esta acción.', 'error');
        return false;
    }
};

window.AuthManager = AuthManager;
