document.addEventListener('DOMContentLoaded', async () => {
    console.log('VacacionesApp: Iniciando sistema en la nube...');
    
    const mainView = document.getElementById('main-view');
    mainView.style.opacity = '0';

    try {
        // Inicializar el estado (Sync Cloud)
        await StateManager.init();
        
        // Inicializar el resto después de tener datos
        if (typeof AuthManager !== 'undefined') AuthManager.init();
        if (typeof UIManager !== 'undefined') UIManager.init();
        if (typeof Visualizer !== 'undefined') Visualizer.init();
        
        setTimeout(() => {
            if (mainView) {
                mainView.style.opacity = '1';
                mainView.style.transition = 'opacity 0.5s ease-in-out';
            }
        }, 100);

    } catch (error) {
        console.warn("Aviso: Inicialización con errores parciales.", error);
        
        // Inicializar Managers de forma segura incluso con error parcial
        try {
            if (typeof AuthManager !== 'undefined') AuthManager.init();
            if (typeof UIManager !== 'undefined') UIManager.init();
            if (typeof Visualizer !== 'undefined') Visualizer.init();
        } catch (e) {
            console.error("Fallo crítico en sub-init:", e);
        }
        
        setTimeout(() => {
            if (mainView) mainView.style.opacity = '1';
        }, 100);
    }
});
