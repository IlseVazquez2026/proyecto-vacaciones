document.addEventListener('DOMContentLoaded', async () => {
    console.log('VacacionesApp: Iniciando sistema en la nube...');
    
    const mainView = document.getElementById('main-view');
    mainView.style.opacity = '0';

    try {
        // Inicializar el estado (Sync Cloud)
        await StateManager.init();
        
        // Inicializar el resto después de tener datos
        AuthManager.init();
        UIManager.init();
        Visualizer.init();
        
        setTimeout(() => {
            mainView.style.opacity = '1';
            mainView.style.transition = 'opacity 0.5s ease-in-out';
        }, 100);

    } catch (error) {
        console.warn("Aviso: Sincronización inicial limitada (posiblemente requiere inicio de sesión).", error);
        
        // Inicializar Managers de forma segura incluso con error parcial de sync
        AuthManager.init();
        UIManager.init();
        Visualizer.init();
        
        setTimeout(() => {
            if (mainView) mainView.style.opacity = '1';
        }, 100);
    }
});
