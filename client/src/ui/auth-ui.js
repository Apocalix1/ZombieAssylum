const apiBaseUrl = (() => {
    if (typeof window === 'undefined') return '';
    if (window.API_BASE) return window.API_BASE;
    if (location.port && location.port !== '4000') {
        return `${location.protocol}//${location.hostname}:4000`;
    }
    return '';
})();


function apiUrl(path) {
    return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
}

function updateBackendStatus(online) {
    const el = document.getElementById('backend-status-text');
    const badge = document.getElementById('backend-status');
    if (!el || !badge) return;
    if (online) {
        el.textContent = 'online';
        badge.style.color = '#2ecc71';
    } else {
        el.textContent = 'offline';
        badge.style.color = '#f39c12';
    }
}

async function checkBackend() {
    try {
        const res = await fetch(apiUrl('/api/ping'), { cache: 'no-store' });
        if (res && res.ok) {
            updateBackendStatus(true);
            return true;
        }
    } catch (e) {}
    updateBackendStatus(false);
    return false;
}

let currentRole = null;
let authMode = 'player'; // 'player' | 'master'
window.guestMode = false;

function isGuestUser() {
    const user = getCurrentUser();
    return user && user.username === 'ospite' && user.role === 'giocatore';
}

function updateRoleIndicator(role) {
    const roleLabel = document.getElementById('display-role');
    if (roleLabel) {
        roleLabel.textContent = role;
    }
}

function showLandingScreen() {
    window.guestMode = false;
    document.body.classList.remove('guest-mode');
    const landing = document.getElementById('landing-screen');
    const game = document.getElementById('game-screen');
    if (landing) landing.classList.remove('hidden');
    if (game) game.classList.add('hidden');
    // Hide auth area until a role is selected
    const auth = document.querySelector('.landing-auth');
    if (auth) auth.classList.add('hidden');
    updateRoleIndicator('Nessuno');
}

function showPlayerAuth() {
    authMode = 'player';
    const auth = document.querySelector('.landing-auth');
    if (!auth) return;
    auth.classList.remove('hidden');
    const userInput = document.getElementById('login-username');
    const registerBtn = document.getElementById('btn-register');
    const loginBtn = document.getElementById('btn-login');
    if (userInput) { userInput.style.display = ''; userInput.value = ''; }
    if (registerBtn) registerBtn.style.display = '';
    if (loginBtn) loginBtn.textContent = 'Accedi';
    showAuthMessage('');
}

function showMasterAuth() {
    authMode = 'master';
    const auth = document.querySelector('.landing-auth');
    if (!auth) return;
    auth.classList.remove('hidden');
    const userInput = document.getElementById('login-username');
    const registerBtn = document.getElementById('btn-register');
    const loginBtn = document.getElementById('btn-login');
    if (userInput) { userInput.style.display = 'none'; userInput.value = 'Apocalix1'; }
    if (registerBtn) registerBtn.style.display = 'none';
    if (loginBtn) loginBtn.textContent = 'Accedi Master';
    const pwd = document.getElementById('login-password');
    if (pwd) pwd.value = '';
    showAuthMessage('Inserisci la password del Master');
    if (pwd) pwd.focus();
}

function showGameScreen(role) {
    currentRole = role;
    window.guestMode = role === 'Ospite' || isGuestUser();
    document.body.classList.toggle('guest-mode', window.guestMode);
    const landing = document.getElementById('landing-screen');
    const game = document.getElementById('game-screen');
    if (landing) landing.classList.add('hidden');
    if (game) game.classList.remove('hidden');
    updateRoleIndicator(role);
}

async function registerUser() {
    const username = document.getElementById('login-username')?.value?.trim();
    const password = document.getElementById('login-password')?.value;
    if (!username || !password) return showAuthMessage('Inserisci username e password');
    showAuthMessage('Registrazione in corso...');
    try {
        const res = await fetch(apiUrl('/api/auth/register'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Errore registrazione');
        const user = { ...data.user, token: data.token };
        localStorage.setItem('utente', JSON.stringify(user));
        showAuthMessage('Registrazione avvenuta. Benvenuto!');
        showLobbyScreen(user);
    } catch (err) {
        showAuthMessage(err.message || 'Errore registrazione');
    }
}

async function loginUser() {
    const username = document.getElementById('login-username')?.value?.trim();
    const password = document.getElementById('login-password')?.value;
    if (!username || !password) return showAuthMessage('Inserisci username e password');
    showAuthMessage('Accesso in corso...');
    try {
        const res = await fetch(apiUrl('/api/auth/login'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Credenziali non valide');
        const user = { ...data.user, token: data.token };
        localStorage.setItem('utente', JSON.stringify(user));
        showAuthMessage('Accesso effettuato.');
        showLobbyScreen(user);
    } catch (err) {
        showAuthMessage(err.message || 'Errore accesso');
    }
}

function continueAsGuest() {
    const guest = { id: 1, username: 'ospite', role: 'giocatore' };
    localStorage.setItem('utente', JSON.stringify(guest));
    window.guestMode = true;
    showGameScreen('Ospite');
}

function showAuthMessage(msg) {
    const el = document.getElementById('auth-message');
    if (el) el.textContent = msg;
}

window.showPlayerAuth = showPlayerAuth;
window.showMasterAuth = showMasterAuth;
window.loginUser = loginUser;
window.registerUser = registerUser;
window.continueAsGuest = continueAsGuest;
window.showAuthMessage = showAuthMessage;
window.showLandingScreen = showLandingScreen;