// auth-ui.js
import { Personaggio } from "../logic/logic.js";
import { party, aggiornaInterfaccia, showLobbyScreen } from "./ui.js";
import { getPendingDeadIds,apiUrl, buildAuthHeaders,avviaSincronizzazioneCompleta } from "../logic/logic.js";

async function caricaPartyMaster() {
    try {
        const response = await fetch(apiUrl('/api/party'), {
            headers: buildAuthHeaders()
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const partyData = data.party || [];

        // Svuota il party corrente
        party.length = 0;

        const deadIds = getPendingDeadIds();

        partyData.forEach(pData => {
            // Salta i personaggi che sono in attesa di morte
            if (deadIds.includes(pData.id)) return;

            let stats = {};
            if (pData.data && typeof pData.data === 'object') {
                stats = pData.data;
            } else {
                stats = pData;
            }

            const nome = stats.nome || pData.nome || 'Sconosciuto';
            const giornoInizio = stats.giornoInizio || 0;
            const personaggio = new Personaggio(nome, giornoInizio);

            Object.assign(personaggio, stats);
            personaggio.id = pData.id;
            personaggio.user_id = pData.user_id;
            personaggio.ownerUsername = pData.owner_username || null;

            party.push(personaggio);
        });

        aggiornaInterfaccia();
        console.log(`Party master caricato: ${party.length} personaggi`);
    } catch (err) {
        console.error('Errore caricamento party per master:', err);
    }
}

let currentRole = null;
window.currentRole = currentRole;
let authMode = 'player';
window.guestMode = false;

// --- Funzioni di utilità ---
function getCurrentUser() {
    try { return JSON.parse(localStorage.getItem('utente')); } catch { return null; }
}
window.getCurrentUser = getCurrentUser;

function isGuestUser() {
    const user = getCurrentUser();
    return user && user.username === 'ospite' && user.role === 'ospite';
}

function updateRoleIndicator(role) {
    const roleLabel = document.getElementById('display-role');
    if (roleLabel) roleLabel.textContent = role;
}
window.updateRoleIndicator = updateRoleIndicator;

function showAuthMessage(msg) {
    const el = document.getElementById('auth-message');
    if (el) el.textContent = msg;
}

// --- Caricamento party per Master -- //
let partyPollIntervalId = null;
let partyPollDelay = 3000;
let partyPollVisibilityHandler = null;

function avviaPollingPartyMaster() {
    fermaPollingPartyMaster();
    const user = getCurrentUser();
    if (!user || !user.role) return;

    function startPartyPoll() {
        if (partyPollIntervalId) clearInterval(partyPollIntervalId);
        partyPollIntervalId = setInterval(async () => {
            const currentUser = getCurrentUser();
            if (currentUser && currentUser.role) {
                await caricaPartyMaster();
            } else {
                fermaPollingPartyMaster();
            }
        }, partyPollDelay);
    }

    startPartyPoll();

    // Listener per visibilitychange
    const handler = () => {
        if (document.hidden) {
            partyPollDelay = 8000;
        } else {
            partyPollDelay = 3000;
        }
        startPartyPoll();
    };
    document.addEventListener('visibilitychange', handler);
    partyPollVisibilityHandler = handler;
}

function fermaPollingPartyMaster() {
    if (partyPollIntervalId) {
        clearInterval(partyPollIntervalId);
        partyPollIntervalId = null;
    }
    if (partyPollVisibilityHandler) {
        document.removeEventListener('visibilitychange', partyPollVisibilityHandler);
        partyPollVisibilityHandler = null;
    }
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
        if (typeof window.showLobbyScreen === 'function') {
            window.showLobbyScreen(user);
        } else {
            console.error('showLobbyScreen non definita');
        }
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
        if (typeof window.showLobbyScreen === 'function') {
            window.showLobbyScreen(user);
        } else {
            console.error('showLobbyScreen non definita');
        }
    } catch (err) {
        showAuthMessage(err.message || 'Errore accesso');
    }
}

async function continueAsGuest() {
    try {
        const res = await fetch(apiUrl('/api/auth/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'ospite', password: 'ospite' })
        });
        if (!res.ok) {
            console.warn('Login ospite fallito, uso modalità offline');
            const guest = { id: 1, username: 'ospite', role: 'ospite' };
            localStorage.setItem('utente', JSON.stringify(guest));
            window.guestMode = true;
            // Carica il party anche offline? Possiamo provare a caricare da localStorage.
            // Tuttavia, il server non risponde, meglio usare dati fittizi o mostrare un messaggio.
            // Per ora, mostriamo la schermata di gioco con party vuoto.
            showGameScreen('Ospite');
            return;
        }
        const data = await res.json();
        const user = { ...data.user, token: data.token };
        localStorage.setItem('utente', JSON.stringify(user));
        window.guestMode = true;

        // Carica il party per l'ospite
        await caricaPartyOspite();

        // Ora mostra la schermata di gioco
        showGameScreen('Ospite');
    } catch (error) {
        console.error('Errore durante login ospite:', error);
        const guest = { id: 1, username: 'ospite', role: 'ospite' };
        localStorage.setItem('utente', JSON.stringify(guest));
        window.guestMode = true;
        showGameScreen('Ospite');
    }
}

// --- Schermate ---
function showLandingScreen() {
    window.guestMode = false;
    document.body.classList.remove('guest-mode');
    const landing = document.getElementById('landing-screen');
    const game = document.getElementById('game-screen');
    if (landing) landing.classList.remove('hidden');
    if (game) game.classList.add('hidden');
    const auth = document.querySelector('.landing-auth');
    if (auth) auth.classList.add('hidden');
    updateRoleIndicator('Nessuno');
}

export function showPlayerAuth() {
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

export function showMasterAuth() {
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

async function loadCharactersFromServerForUser(userId) {
    try {
        const characters = await fetchUserCharacters(userId);
        return characters.map(c => c.nome);
    } catch {
        return [];
    }
}

function saveCharacterForUser(nome) {
    const user = getCurrentUser();
    if (!user) return;
    const key = `user_chars_${user.username}`;
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    if (!arr.includes(nome)) arr.push(nome);
    localStorage.setItem(key, JSON.stringify(arr));
}
window.saveCharacterForUser = saveCharacterForUser;

function checkBackend() {
    const statusText = document.getElementById('backend-status-text');
    if (statusText) {
        statusText.textContent = navigator.onLine ? 'online' : 'offline';
        statusText.style.color = navigator.onLine ? '#2ecc71' : '#e74c3c';
    }
}

async function loadCharacterNamesForUser() {
    const user = getCurrentUser();
    if (!user) return [];
    if (navigator.onLine) {
        const names = await loadCharactersFromServerForUser(user.id);
        if (names.length) return names;
    }
    const key = `user_chars_${user.username}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
}

async function caricaPartyOspite() {
    try {
        const response = await fetch(apiUrl('/api/party'), {
            headers: buildAuthHeaders()
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const partyData = data.party || [];

        // Svuota il party corrente
        party.length = 0;

        partyData.forEach(pData => {
            let stats = {};
            if (pData.data && typeof pData.data === 'object') {
                stats = pData.data;
            } else {
                stats = pData;
            }

            const nome = stats.nome || pData.nome || 'Sconosciuto';
            const giornoInizio = stats.giornoInizio || 0;
            const personaggio = new Personaggio(nome, giornoInizio);
            Object.assign(personaggio, stats);
            personaggio.id = pData.id;
            personaggio.user_id = pData.user_id;
            personaggio.ownerUsername = pData.owner_username || null;
            // potrebbe essere undefined per gli ospiti, ma non serve per il controllo di proprietà

            party.push(personaggio);
        });

        aggiornaInterfaccia();
        console.log(`Party ospite caricato: ${party.length} personaggi`);
    } catch (err) {
        console.error('Errore caricamento party per ospite:', err);
        // In caso di errore, possiamo mostrare un messaggio all'utente
        if (typeof mostraNotificaInAlto === 'function') {
            mostraNotificaInAlto('Impossibile caricare i personaggi. Verifica la connessione.', 'errore');
        }
    }
}

window.masterEliminaPersonaggio = async function(idx) {
    const p = party[idx];
    if (!p) return;
    if (!p.id) {
        alert('Questo personaggio non ha un ID valido. Impossibile eliminarlo.');
        return;
    }
    if (!confirm(`Eliminare definitivamente "${p.nome}"? L'azione è irreversibile e cancellerà tutti i suoi dati.`)) return;

    // FIX: guardia difensiva, non crasha più se per qualche motivo non è ancora definita
    if (typeof window.annullaCollaborazioniPersonaggio === 'function') {
        window.annullaCollaborazioniPersonaggio(p);
    } else {
        console.warn('annullaCollaborazioniPersonaggio non disponibile al momento dell\'eliminazione — possibile problema di cache/ordine di caricamento.');
    }

    try {
        const res = await fetch(apiUrl(`/api/personaggi/${p.id}`), {
            method: 'DELETE',
            headers: buildAuthHeaders()
        });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(`HTTP ${res.status}: ${errBody.error || 'errore sconosciuto'}`);
        }
        localStorage.removeItem(`personaggio_${encodeURIComponent(p.nome)}`);
        if (p.ownerUsername) {
            const key = `user_chars_${p.ownerUsername}`;
            const arr = JSON.parse(localStorage.getItem(key) || '[]').filter(n => n !== p.nome);
            localStorage.setItem(key, JSON.stringify(arr));
        }
        party.splice(idx, 1);
        if (typeof chiudiScheda === 'function') chiudiScheda();
        mostraNotificaInAlto(`${p.nome} eliminato definitivamente.`, 'successo');
        aggiornaInterfaccia();
        if (typeof renderCimitero === 'function') renderCimitero();
    } catch (e) {
        console.error('Errore eliminazione personaggio:', e);
        alert(`Errore durante l'eliminazione: ${e.message}`);
    }
};

function showGameScreen(role) {
    const attendiBtn = document.getElementById('btn-attendi');
    if (attendiBtn) attendiBtn.style.display = (role === 'Master') ? '' : 'none';
    currentRole = role;
    window.currentRole = role;
    window.guestMode = role === 'Ospite' || isGuestUser();
    document.body.classList.toggle('guest-mode', window.guestMode);
    const landing = document.getElementById('landing-screen');
    const game = document.getElementById('game-screen');
    const lobby = document.getElementById('lobby-screen');
    if (landing) landing.classList.add('hidden');
    if (lobby) lobby.classList.add('hidden');
    if (game) game.classList.remove('hidden');
    updateRoleIndicator(role);

    // Attiviamo il polling per tutti i ruoli così da vedere gli aggiornamenti degli altri giocatori
      avviaSincronizzazioneCompleta();
    if (typeof window.renderProposte === 'function') window.renderProposte();

    // RECLUTA ora è identico per Master e Giocatore: crea sempre un personaggio
    const reclutaBtn = document.getElementById('btn-recluta');
    if (reclutaBtn) {
        reclutaBtn.innerHTML = '➕ RECLUTA';
        reclutaBtn.onclick = () => window.avviaCreazione(true); // PASSIAMO directAdd = true
    }

// Pannello Master: visibile solo per il master, sostituisce "Proposte"
    const masterPanelBtn = document.getElementById('btn-master-panel');
    if (masterPanelBtn) {
        if (role === 'Master') {
            masterPanelBtn.classList.remove('hidden');
            masterPanelBtn.innerHTML = '👑 PANNELLO MASTER';
            masterPanelBtn.onclick = () => window.apriPannelloMaster();
        } else {
            masterPanelBtn.classList.add('hidden');
        }
    }
    }

function hasDependencies(personaggio) {
    return party.some(p =>
        (p.azioneCorrente && (p.azioneCorrente.collaboratoreNome === personaggio.nome || p.azioneCorrente.teacherName === personaggio.nome)) ||
        (p.codaAzioni && p.codaAzioni.some(a => a.collaboratoreNome === personaggio.nome || a.teacherName === personaggio.nome))
    );
}

function isLikelyMobileDevice() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const uaMobile = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua);
    const narrowScreen = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    return uaMobile || narrowScreen;
}

function applyMobileMode(enabled) {
    document.body.classList.toggle('mobile-mode', enabled);
    localStorage.setItem('mobileModePreference', enabled ? '1' : '0');
    const statusEl = document.getElementById('mobile-mode-status');
    if (statusEl) statusEl.textContent = enabled ? 'ON' : 'OFF';
}

function initMobileModeToggle() {
    const stored = localStorage.getItem('mobileModePreference');
    const enabled = stored !== null ? stored === '1' : isLikelyMobileDevice();
    applyMobileMode(enabled);

    const btn = document.getElementById('btn-toggle-mobile');
    if (btn) {
        btn.addEventListener('click', () => {
            applyMobileMode(!document.body.classList.contains('mobile-mode'));
        });
    }
}

window.initMobileModeToggle = initMobileModeToggle;
window.applyMobileMode = applyMobileMode;

// --- Export ---
export {
    getCurrentUser,
    isGuestUser,
    continueAsGuest,
    showLandingScreen,
    showGameScreen,
    loginUser,
    registerUser,
    caricaPartyMaster,
    avviaPollingPartyMaster,
    fermaPollingPartyMaster,
    buildAuthHeaders
};

// Esposizioni globali per compatibilità inline
window.showLandingScreen = showLandingScreen;
window.showPlayerAuth = showPlayerAuth;
window.showMasterAuth = showMasterAuth;
window.showGameScreen = showGameScreen;
window.loginUser = loginUser;
window.registerUser = registerUser;
window.continueAsGuest = continueAsGuest;
window.getCurrentUser = getCurrentUser;
window.caricaPartyMaster = caricaPartyMaster;
window.avviaPollingPartyMaster = avviaPollingPartyMaster;
window.fermaPollingPartyMaster = fermaPollingPartyMaster;
window.apiUrl = apiUrl;
window.updateRoleIndicator = updateRoleIndicator;
window.checkBackend = checkBackend;
window.isGuestUser = isGuestUser;
window.hasDependencies = hasDependencies;
