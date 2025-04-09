document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        
        if (username) {
            // Store username in sessionStorage
            sessionStorage.setItem('username', username);
            
            // Redirect to chat page
            window.location.href = 'chat.html';
        }
    });
    
    // If user is already logged in, redirect to chat
    if (sessionStorage.getItem('username') && window.location.pathname.endsWith('index.html')) {
        window.location.href = 'chat.html';
    }
});