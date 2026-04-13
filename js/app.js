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
        console.error("Fallo crítico en el inicio:", error);
        alert("Hubo un problema al conectar con la base de datos. Por favor revisa tu conexión.");
    }
});
