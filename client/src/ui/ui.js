import { magazzino, party as stateParty } from "../state.js";
import { Personaggio, salvaPersonaggioCloud, avviaAscoltoDatiCloud, fetchUserCharacters, apiUrl, buildAuthHeaders, refreshPartyListeners } from "../logic/logic.js";

const party = stateParty;

// Esposizioni Globali per compatibilità con HTML inline e altri script non-modulari
window.showLobbyScreen = showLobbyScreen;
window.apriScheda = apriScheda;
window.chiudiModal = chiudiModal;
window.mostraNotificaInAlto = mostraNotificaInAlto;

function chiudiModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

function showLobbyScreen(user) {
    if (user && user.role === 'master') {
        showGameScreen('Master');
        apriPannelloMaster();
        return;
    }
    window.guestMode = false;
    document.body.classList.remove('guest-mode');
    window.currentRole = 'Lobby';
    const landing = document.getElementById('landing-screen');
    const game = document.getElementById('game-screen');
    const lobby = document.getElementById('lobby-screen');
    if (landing) landing.classList.add('hidden');
    if (game) game.classList.add('hidden');
    if (lobby) lobby.classList.remove('hidden');
    updateRoleIndicator(user && user.role ? (user.role === 'master' ? 'Master' : 'Giocatore') : 'Giocatore');
    const userEl = document.getElementById('lobby-user');
    if (userEl) userEl.textContent = user ? `Utente: ${user.username}` : '';
    
    const masterBtn = document.getElementById('btn-master-panel');
    if (masterBtn) {
        if (user && user.role === 'master') {
            masterBtn.classList.remove('hidden');
        } else {
            masterBtn.classList.add('hidden');
        }
    }
    
    renderCharacterList();
}

function getCurrentUser() {
    try { return JSON.parse(localStorage.getItem('utente')); } catch { return null; }
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

async function renderCharacterList() {
    const container = document.getElementById('lobby-characters');
    if (!container) return;
    container.innerHTML = '<div style="color:#ccc;">Caricamento personaggi...</div>';
    const names = await loadCharacterNamesForUser();
    container.innerHTML = '';
    if (!names.length) {
        container.innerHTML = '<div style="color:#ccc;">Nessun personaggio creato. Crea il primo con "Crea Personaggio".</div>';
        return;
    }
    names.forEach(nome => {
        const inParty = party.some(p => p.nome === nome);
        const div = document.createElement('div');
        div.className = 'lobby-char';
        div.style.background = '#0f0f0f'; div.style.padding = '8px'; div.style.border = '1px solid #222'; div.style.display = 'flex'; div.style.justifyContent = 'space-between'; div.style.alignItems = 'center';
        
        div.innerHTML = `<div><strong>${nome}</strong><div style="font-size:0.85rem;color:#aaa">${inParty? 'In gioco (Approvato)' : 'In attesa di approvazione Master'}</div></div>`;
        
        const actions = document.createElement('div');
        
        // --- 1. BOTTONE PROPONI (Ora invia i dati al SERVER e non in locale) ---
        const proposeBtn = document.createElement('button');
        proposeBtn.className = 'btn-hero'; 
        proposeBtn.textContent = 'Proponi al Master';
        proposeBtn.onclick = async () => {
            const user = getCurrentUser();
            if (!user) return alert('Devi essere loggato per inviare una proposta!');
            
            try {
                const localCharacter = window.caricaDatiDaLocalStorage ? window.caricaDatiDaLocalStorage(nome) : null;
                const characterData = localCharacter || { nome };
                const response = await fetch(apiUrl('/api/proposals'), {
                    method: 'POST',
                    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        nome,
                        descrizione: `Proposta personaggio: ${nome}`,
                        characterData,
                    })
                });
                
                if (response.ok) {
                    alert('Proposta inviata con successo! Attendi che il Master la approvi dal terminale principale.');
                } else {
                    const errData = await response.json();
                    alert(`Errore: ${errData.error || 'Impossibile inviare la proposta'}`);
                }
            } catch (e) {
                alert('Errore di rete: il server del Master non è raggiungibile in questo momento.');
            }
        };
        
        // --- 2. BOTTONE ENTRA (Ora si attiva SOLO se il Master ha già approvato il personaggio) ---
        const enterBtn = document.createElement('button');
        enterBtn.className = 'btn-hero'; 
        enterBtn.textContent = 'Entra';
        
        // Se non è ancora in gioco (perché il Master non l'ha ancora inserito nel party generale), il giocatore non può premere Entra
        if (!inParty) {
            enterBtn.disabled = true;
            enterBtn.style.opacity = '0.4';
            enterBtn.style.cursor = 'not-allowed';
            enterBtn.title = 'Questo personaggio deve prima essere accettato dal Master.';
        }
        
        enterBtn.onclick = async () => {
            let pData = window.caricaDatiDaLocalStorage ? window.caricaDatiDaLocalStorage(nome) : null;
            if (!pData) {
                const user = getCurrentUser();
                if (user) {
                    const fromServer = await fetchCharacterDataFromServer(nome, user.id);
                    if (fromServer) {
                        pData = typeof fromServer.data === 'string' ? JSON.parse(fromServer.data || '{}') : fromServer.data;
                        localStorage.setItem(`personaggio_${encodeURIComponent(nome)}`, JSON.stringify({ ...pData, updated_at: fromServer.updated_at }));
                    }
                }
            }
            if (pData) {
                const p = Object.assign(new Personaggio(pData.nome, pData.giornoInizio || 0), pData);
                // Evitiamo duplicati nel party locale del giocatore
                if (!party.some(x => x.nome === p.nome)) {
                    party.push(p);
                }
                showGameScreen('Giocatore');
            } else {
                alert('Impossibile caricare il personaggio. Verifica che sia stato creato o che il server sia raggiungibile.');
            }
        };
        
        // Se il personaggio è già dentro al party, non serve ri-proporlo
        if (inParty) {
            proposeBtn.style.display = 'none';
        }
        
        actions.appendChild(proposeBtn);
        actions.appendChild(enterBtn);
        div.appendChild(actions);
        container.appendChild(div);
    });
}

async function fetchCharacterDataFromServer(nome, userId) {
    if (!navigator.onLine || !userId) return null;
    try {
        const response = await fetch(apiUrl(`/api/personaggi/${encodeURIComponent(nome)}`), {
            headers: buildAuthHeaders()
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.personaggio || null;
    } catch (error) {
        console.warn('Errore caricamento personaggio dal server:', error.message || error);
        return null;
    }
}

/**
 * Aggancia i bottoni dell'HTML alle funzioni JavaScript corrispondenti
 */
export function inizializzaBottoniUI() {
    
    // Controlli Generali della Dashboard
    document.getElementById("btn-recluta")?.addEventListener("click", () => {
        document.getElementById("modal-creazione").style.display = "flex";
    });

    document.getElementById("btn-attendi")?.addEventListener("click", () => {
        console.log("Tempo avanzato globale");
        // Inserisci qui la tua funzione passaTempoGlobale()
    });

    document.getElementById("btn-biblioteca")?.addEventListener("click", () => {
        document.getElementById("modal-biblioteca").style.display = "flex";
    });

    document.getElementById("btn-caduti")?.addEventListener("click", () => {
        const cimitero = document.getElementById("side-cimitero");
        cimitero.style.transform = cimitero.style.transform === "translateX(0px)" ? "translateX(100%)" : "translateX(0px)";
    });

    document.getElementById("btn-chiudi-cimitero")?.addEventListener("click", () => {
        document.getElementById("side-cimitero").style.transform = "translateX(100%)";
    });

    // Gestione Chiusura Finestre di Creazione
    document.getElementById("btn-annulla-creazione")?.addEventListener("click", () => {
        document.getElementById("modal-creazione").style.display = "none";
    });

    // Conferma Salvataggio Nuovo Sopravvissuto
    document.getElementById('id-conferma-creazione')?.addEventListener('click', async () => {
        const nomeInput = document.getElementById('crea-nome').value.trim();
        if (!nomeInput) return alert("Inserisci un nome valido!");

        const nuovoEroe = new Personaggio(nomeInput, 0);
        // Robot choice
        try {
            const wantRobot = document.getElementById('crea-robot')?.checked;
            if (wantRobot) {
                if (typeof nuovoEroe.becomeRobot === 'function') nuovoEroe.becomeRobot();
            }
        } catch (e) {}
        party.push(nuovoEroe);
        
        // Salva in locale / sul server e chiudi la finestra
        try {
            await salvaPersonaggioCloud(nuovoEroe);
        } catch (e) {
            console.warn('Errore salvataggio cloud, uso copia locale:', e?.message || e);
        }
        try { saveCharacterForUser && saveCharacterForUser(nuovoEroe.nome); } catch (e) {}
        document.getElementById("modal-creazione").style.display = "none";
        refreshPartyListeners && refreshPartyListeners();
        aggiornaInterfaccia();
        renderCharacterList && renderCharacterList();
    });
}

// Inizializza la UI (usiamo init che viene chiamato anche se il modulo è caricato dopo il DOM)
function initUI() {
    if (typeof inizializzaBottoniUI === 'function') {
        inizializzaBottoniUI();
    }
    const playerBtn = document.getElementById('btn-player');
    const masterBtn = document.getElementById('btn-master');
    playerBtn?.addEventListener('click', () => showPlayerAuth());
    masterBtn?.addEventListener('click', () => showMasterAuth());
    // Auth buttons in landing
    document.getElementById('btn-login')?.addEventListener('click', () => loginUser());
    document.getElementById('btn-register')?.addEventListener('click', () => registerUser());
    document.getElementById('btn-guest')?.addEventListener('click', () => continueAsGuest());
    // Lobby buttons
    document.getElementById('lobby-btn-recluta')?.addEventListener('click', () => { 
        if (typeof window.avviaCreazione === 'function') {
            window.avviaCreazione();
        } else {
            document.getElementById('modal-creazione').style.display = 'block';
        }
    });
    document.getElementById('lobby-enter-play')?.addEventListener('click', async () => {
        if (!selectedLobbyCharacter) return alert('Seleziona un personaggio dalla lista');
        const nome = selectedLobbyCharacter;
        const pData = caricaDatiDaLocalStorage(nome);
        if (pData) {
            const p = Object.assign(new Personaggio(pData.nome, pData.giornoInizio || 0), pData);
            party.push(p);
            if (typeof window.showGameScreen === 'function') {
                window.showGameScreen('Giocatore');
            } else {
                console.error('showGameScreen non definita');
            }
            return;
        }
        const user = getCurrentUser();
        if (user) {
            const fromServer = await fetchCharacterDataFromServer(nome, user.id);
            if (fromServer) {
                const pdata = typeof fromServer.data === 'string' ? JSON.parse(fromServer.data || '{}') : fromServer.data;
                const p = Object.assign(new Personaggio(pdata.nome, pdata.giornoInizio || 0), pdata);
                party.push(p);
                if (typeof window.showGameScreen === 'function') {
                    window.showGameScreen('Giocatore');
                } else {
                    console.error('showGameScreen non definita');
                }
                return;
            }
        }
        alert('Impossibile caricare il personaggio.');
    });
    if (typeof window.showLandingScreen === 'function') {
        window.showLandingScreen();
    } else {
        console.warn('showLandingScreen non definita in initUI');
    }
    if (typeof avviaAscoltoDatiCloud === 'function') {
        avviaAscoltoDatiCloud();
    }
    if (typeof refreshPartyListeners === 'function') {
        refreshPartyListeners();
    }
    // Controllo backend e aggiorno badge; ripeto ogni 10s
    checkBackend();
    setInterval(checkBackend, 10000);
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initUI);
} else {
    initUI();
}

// Esponi funzioni usate da attributi inline onclick
window.avviaCreazione = window.avviaCreazione || (typeof avviaCreazione === 'function' ? avviaCreazione : undefined);
window.passaTempoGlobale = window.passaTempoGlobale || (typeof passaTempoGlobale === 'function' ? passaTempoGlobale : undefined);
window.mandaTuttiInSpedizione = window.mandaTuttiInSpedizione || (typeof mandaTuttiInSpedizione === 'function' ? mandaTuttiInSpedizione : undefined);
window.apriBiblioteca = window.apriBiblioteca || (typeof apriBiblioteca === 'function' ? apriBiblioteca : undefined);
window.toggleCimitero = window.toggleCimitero || (typeof toggleCimitero === 'function' ? toggleCimitero : undefined);
// Espongo anche login/register per fallback inline o debugging
window.registerUser = window.registerUser || (typeof registerUser === 'function' ? registerUser : undefined);
window.loginUser = window.loginUser || (typeof loginUser === 'function' ? loginUser : undefined);
// Esponi funzioni della landing/globali per compatibilità con eventuali onclick inline
window.showPlayerAuth = window.showPlayerAuth || (typeof showPlayerAuth === 'function' ? showPlayerAuth : undefined);
window.showMasterAuth = window.showMasterAuth || (typeof showMasterAuth === 'function' ? showMasterAuth : undefined);
window.showLandingScreen = window.showLandingScreen || (typeof showLandingScreen === 'function' ? showLandingScreen : undefined);
window.continueAsGuest = window.continueAsGuest || (typeof continueAsGuest === 'function' ? continueAsGuest : undefined);

let oreTotali = 0;
window.oreTotali = 0;
let cimitero = [];
// let magazzino = ... // Rimosso perché importato da state.js
window.magazzino = magazzino;

function mostraNotificaInAlto(msg, tipo = 'info') {
    const el = document.getElementById('toast-notify');
    if (el) {
        el.textContent = msg;
        el.dataset.tipo = tipo;
        el.classList.add('show');
        clearTimeout(mostraNotificaInAlto._timer);
        mostraNotificaInAlto._timer = setTimeout(() => el.classList.remove('show'), 2400);
        return;
    }
    console.log(`[${tipo}] ${msg}`);
}

function mostraCongegniBase() {
    let testo = "=== STRUTTURE FISSE ===\n";
    
    if (magazzino.congegniFissi.length === 0) {
        testo += "Nessun congegno installato nella base.\n";
    } else {
        magazzino.congegniFissi.forEach(c => {
            testo += `• ${c.nome} ${c.dettagli}\n`;
        });
    }

    testo += "\n=== DISPOSITIVI A CONTEGGIO ===\n";
    for (let [nomeItem, quantita] of Object.entries(magazzino.congegniConteggio)) {
        if (quantita > 0) {
            testo += `• ${nomeItem}: x${quantita}\n`;
        }
    }

    alert(testo);
}

import { masterInviaDocumento, masterApplicaStato } from '../logic/master_action.js';

window.apriDocumentiPersonaggio = function(idx) {
    const p = party[idx];
    if (!p) return;
    
    let modal = document.getElementById('modal-documenti-personaggio');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-documenti-personaggio';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2 style="color:#8e44ad; letter-spacing: 2px; margin-bottom:15px;">📜 DOCUMENTI</h2>
                <div id="documenti-personaggio-content" style="text-align:left; max-height:400px; overflow-y:auto; background:#111; padding:10px; border:1px solid #333;"></div>
                <div class="modal-footer">
                    <button class="btn-big btn-cancel" onclick="chiudiModal('modal-documenti-personaggio')">CHIUDI</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }
    
    const content = document.getElementById('documenti-personaggio-content');
    const docs = p.documenti || [];
    
    if (docs.length === 0) {
        content.innerHTML = '<p style="color:#aaa;">Nessun documento trovato per questo personaggio.</p>';
    } else {
        content.innerHTML = docs.map((d, i) => `
            <div style="background:#222; padding:10px; border:1px solid #444; margin-bottom:8px; border-radius:4px;">
                <div style="font-weight:bold; color:#f1c40f; margin-bottom:4px;">${d.titolo}</div>
                <div style="font-size:0.85rem; color:#ccc; margin-bottom:6px; font-style:italic;">Lingua: ${d.lingua}</div>
                <div style="font-size:0.9rem; color:#eee; white-space:pre-wrap;">${d.testo}</div>
            </div>
        `).join('');
    }
    
    modal.style.display = 'block';
};

window.apriStatiPersonaggio = function(idx) {
    const p = party[idx];
    if (!p) return;
    
    let modal = document.getElementById('modal-stati-personaggio');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-stati-personaggio';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2 style="color:#2980b9; letter-spacing: 2px; margin-bottom:15px;">✨ STATI E BUFF</h2>
                <div id="stati-personaggio-content" style="text-align:left; max-height:400px; overflow-y:auto; background:#111; padding:10px; border:1px solid #333;"></div>
                <div class="modal-footer">
                    <button class="btn-big btn-cancel" onclick="chiudiModal('modal-stati-personaggio')">CHIUDI</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }
    
    const content = document.getElementById('stati-personaggio-content');
    const stati = p.statiAlterati || [];
    
    if (stati.length === 0) {
        content.innerHTML = '<p style="color:#aaa;">Nessuno stato alterato attivo.</p>';
    } else {
        content.innerHTML = stati.map((s, i) => `
            <div style="background:#222; padding:10px; border:1px solid ${s.tipo === 'buff' ? '#27ae60' : '#c0392b'}; margin-bottom:8px; border-radius:4px;">
                <div style="font-weight:bold; color:${s.tipo === 'buff' ? '#2ecc71' : '#e74c3c'}; margin-bottom:4px;">${s.nome.toUpperCase()} (${s.tipo})</div>
                <div style="font-size:0.9rem; color:#eee; margin-bottom:4px;">${s.descrizione || s.desc || ''}</div>
                <div style="font-size:0.8rem; color:#aaa;">Durata residua: ${s.durata} min</div>
            </div>
        `).join('');
    }
    
    modal.style.display = 'block';
};

window.apriPropostePersonaggi = function() {
    if (typeof apriPannelloMaster === 'function') {
        apriPannelloMaster();
        // Potremmo voler scorrere fino alla sezione dei personaggi
        setTimeout(() => {
            const el = document.getElementById('master-all-chars');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 300);
    }
};

window.apriPannelloMaster = async function apriPannelloMaster() {
    const modal = document.getElementById('modal-master-panel');
    const content = document.getElementById('master-panel-content');
    if (!modal || !content) return;
    modal.style.display = 'block';
    
    // Carica personaggi per select
    let options = party.map((p, i) => `<option value="${p.id || p.nome}">${p.nome}</option>`).join('');
    
    content.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div style="border-right: 1px solid #333; padding-right: 20px;">
                <h3 style="color:#f1c40f;">📜 Invia Documento</h3>
                <div style="margin-bottom:10px;">
                    <label>Destinatario:</label><br>
                    <select id="master-doc-target" style="width:100%; background:#222; color:white; border:1px solid #444; padding:5px;">
                        ${options}
                    </select>
                </div>
                <div style="margin-bottom:10px;">
                    <label>Titolo:</label><br>
                    <input type="text" id="master-doc-titolo" style="width:100%; background:#222; color:white; border:1px solid #444; padding:5px;">
                </div>
                <div style="margin-bottom:10px;">
                    <label>Lingua:</label><br>
                    <select id="master-doc-lingua" style="width:100%; background:#222; color:white; border:1px solid #444; padding:5px;">
                        <option value="Comune">Comune</option>
                        <option value="Arcano">Arcano</option>
                        <option value="Antico">Antico</option>
                    </select>
                </div>
                <div style="margin-bottom:10px;">
                    <label>Testo:</label><br>
                    <textarea id="master-doc-testo" rows="4" style="width:100%; background:#222; color:white; border:1px solid #444; padding:5px;"></textarea>
                </div>
                <button class="btn-hero" onclick="masterActionInvia()">INVIA DOCUMENTO</button>
                <div style="margin-top:10px;">
                     <button class="btn-hero" style="background:#8e44ad;" onclick="window.creaDocumentoMaster()">CREA DOCUMENTO</button>
                </div>
            </div>
            
            <div>
                <h3 style="color:#f1c40f;">⚙️ Applica Stato</h3>
                <div style="margin-bottom:10px;">
                    <label>Vittima:</label><br>
                    <select id="master-state-target" style="width:100%; background:#222; color:white; border:1px solid #444; padding:5px;">
                        ${options}
                    </select>
                </div>
                <div style="margin-bottom:10px;">
                    <label>Tipo:</label><br>
                    <select id="master-state-nome" style="width:100%; background:#222; color:white; border:1px solid #444; padding:5px;">
                        <option value="Forza">Forza</option>
                        <option value="Destrezza">Destrezza</option>
                        <option value="Costituzione">Costituzione</option>
                        <option value="Intelligenza">Intelligenza</option>
                        <option value="Saggezza">Saggezza</option>
                        <option value="Carisma">Carisma</option>
                        <option value="Fame">Fame</option>
                        <option value="Sete">Sete</option>
                        <option value="Sonno">Sonno</option>
                        <option value="Fatica">Fatica</option>
                    </select>
                </div>
                <div style="margin-bottom:10px;">
                    <label>Positivo o negativo:</label><br>
                    <select id="master-state-polarita" style="width:100%; background:#222; color:white; border:1px solid #444; padding:5px;">
                        <option value="1">Positivo (+)</option>
                        <option value="-1">Negativo (-)</option>
                    </select>
                </div>
                <div style="margin-bottom:10px; display:none;">
                    <!-- Campi legacy nascosti ma mantenuti per compatibilità masterActionStato -->
                    <select id="master-state-tipo"><option value="buff">buff</option></select>
                    <input type="number" id="master-state-durata" value="1440">
                    <textarea id="master-state-desc"></textarea>
                </div>
                <button class="btn-hero" onclick="masterActionStato()">APPLICA</button>
            </div>
        </div>
        <div style="margin-top:20px; border-top:1px solid #333; padding-top:10px;">
             <h3 style="color:#f1c40f;">👥 Tutti i Personaggi</h3>
             <div id="master-all-chars" style="font-size:0.9rem;">Caricamento...</div>
        </div>
    `;
    
    // Carica tutti i personaggi (master view)
    try {
        const data = await fetch(apiUrl('/api/characters?all=true'), {
            headers: buildAuthHeaders()
        }).then(r => r.json());
        if (data.characters) {
            const list = data.characters.map(c => `
                <div style="padding:5px; border-bottom:1px solid #222;">
                    <strong>${c.nome}</strong> (${c.classe}) - User ID: ${c.user_id} - Stamina: ${c.stamina}
                </div>
            `).join('');
            document.getElementById('master-all-chars').innerHTML = list;
        }
    } catch (e) {
        document.getElementById('master-all-chars').innerText = "Errore caricamento personaggi.";
    }
};

window.masterActionInvia = async function() {
    const target = document.getElementById('master-doc-target').value;
    const titolo = document.getElementById('master-doc-titolo').value;
    const lingua = document.getElementById('master-doc-lingua').value;
    const testo = document.getElementById('master-doc-testo').value;
    if (!titolo || !testo) return alert("Titolo e testo obbligatori");
    await masterInviaDocumento(titolo, lingua, testo, target);
};

window.creaDocumentoMaster = function() {
    const titolo = prompt("Inserisci il titolo del documento:");
    if (!titolo) return;
    const testo = prompt("Inserisci il testo del documento:");
    if (!testo) return;
    const lingua = prompt("Inserisci la lingua del documento:", "Comune");
    
    // Invia senza destinatario specifico (id null) per crearlo nel database globale
    masterInviaDocumento(titolo, lingua, testo, null);
};

window.masterActionStato = async function() {
    const target = document.getElementById('master-state-target').value;
    const nome = document.getElementById('master-state-nome').value;
    const tipo = document.getElementById('master-state-tipo').value;
    const durata = parseInt(document.getElementById('master-state-durata').value);
    const desc = document.getElementById('master-state-desc').value;
    const polarita = parseInt(document.getElementById('master-state-polarita').value || "1");
    
    if (!nome) return alert("Nome stato obbligatorio");
    
    // Usiamo il campo 'valore' per passare la polarità/entità del buff
    await masterApplicaStato(target, nome, tipo, desc, durata, polarita);
};

let selectedLobbyCharacter = null;
// Funzioni rimosse perché ridondanti o non più usate
// chiudiCimitero() è ora gestita direttamente o tramite toggle in cimitero-ui.js
// La gestione del magazzino è centralizzata in state.js e logic.js
window.showLobbyScreen = showLobbyScreen;

window.hasPerk = function hasPerk(personaggio, perk) {
    if (!personaggio) return false;
    if (typeof personaggio.hasPerk === 'function') return personaggio.hasPerk(perk);
    if (Array.isArray(personaggio.perks)) {
        return personaggio.perks.some(p => (typeof p === 'string' ? p : p?.nome) === perk);
    }
    return false;
};

let lastPartyAutoSave = 0;
async function autoSaveParty() {
    const now = Date.now();
    if (now - lastPartyAutoSave < 10000) return;
    lastPartyAutoSave = now;
    if (!navigator.onLine || !party.length) return;
    for (const personaggio of party) {
        try {
            await salvaPersonaggioCloud(personaggio);
        } catch (err) {
            console.warn('Auto-save fallito per', personaggio.nome, err?.message || err);
        }
    }
}

function rollDiceNotation(notation) {
    const match = notation.match(/(\d+)d(\d+)/);
    if (!match) return 0;
    return rollDice(parseInt(match[1], 10), parseInt(match[2], 10));
}

function normalizePerkName(nomePerk) {
    if (nomePerk === undefined || nomePerk === null) return "";
    return String(nomePerk).trim();
}

function getPerkBaseName(nomePerk) {
    const clean = normalizePerkName(nomePerk);
    return clean.startsWith("Anziana_") ? "Anziana" : clean;
}

function perkObjectName(perk) {
    if (!perk) return "";
    if (typeof perk === 'string') return normalizePerkName(perk);
    if (typeof perk === 'object' && perk && perk.nome) return normalizePerkName(perk.nome);
    return "";
}

function getPerkCount(personaggio, nomePerk) {
    if (!personaggio || !Array.isArray(personaggio.perks)) return 0;
    const target = getPerkBaseName(nomePerk);
    return personaggio.perks.filter(perk => getPerkBaseName(perkObjectName(perk)) === target).length;
}

function hasPerk(personaggio, nomePerk) {
    return getPerkCount(personaggio, nomePerk) > 0;
}

function getFoodEfficiency(p) {
    let scale = 1;
    if (hasPerk(p, 'Digiuno')) scale *= 1.2;
    if (hasPerk(p, 'Insaziabile')) scale *= 0.8;
    return scale;
}

function getWaterEfficiency(p) {
    let scale = 1;
    if (hasPerk(p, 'Dromedario')) scale *= 1.2;
    if (hasPerk(p, 'Bocca asciutta')) scale *= 0.8;
    return scale;
}

function recordResourceConsumption(p, amount, tipo = 'cibo') {
    if (!p.resourceConsumption) p.resourceConsumption = { cibo: 0, acqua: 0 };
    if (tipo === 'acqua') {
        p.resourceConsumption.acqua += amount;
    } else {
        p.resourceConsumption.cibo += amount;
    }
}

function randomStudyHours() {
    const r = Math.random();
    if (r < 0.04) return 24;
    const distribution = [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23];
    const midpoint = 13.5;
    const weights = distribution.map(v => 1 / (1 + Math.abs(v - midpoint)));
    let total = weights.reduce((sum, w) => sum + w, 0);
    let pick = Math.random() * total;
    for (let i = 0; i < distribution.length; i++) {
        pick -= weights[i];
        if (pick <= 0) return distribution[i];
    }
    return 23;
}

let tempP = null;
let assistenzaSelezionata = null; // { tipo: 'studio'|'medicina'|'alchimia', idx: number }
let alchimiaPersonaggioSelezionata = null;

const MEDICINA_LIVELLI = [
    { livello: 0, effetto: "Nessuna conoscenza specifica; usi base con medicine improvvisate.", costo: 0 },
    { livello: 1, effetto: "Preparazione semplice e medicazioni di base.", costo: 0 },
    { livello: 2, effetto: "Interventi di primo soccorso più efficaci.", costo: 1 },
    { livello: 3, effetto: "Trattamenti avanzati per ferite moderate.", costo: 2 },
    { livello: 4, effetto: "Cura efficiente delle malattie e medicazioni complesse.", costo: 3 },
    { livello: 5, effetto: "Padronanza totale della medicina da campo.", costo: 4 }
];

const TABELLA_ARMI = [
    { nome: 'Lame leggere', descrizione: 'Colpo veloce, critici più frequenti, richiede livello precedente.', livelloBase: 1 },
    { nome: 'Mazze e armi contundenti', descrizione: 'Infligge danno robusto e stordisce, richiede livello precedente.', livelloBase: 1 },
    { nome: 'Archi', descrizione: 'Attacchi a distanza; capacità di tiro e penetranza.', livelloBase: 1 },
    { nome: 'Balestre', descrizione: 'Colpi potenti a distanza, lentezza compensata da danno maggiore.', livelloBase: 1 },
    { nome: 'Armi con l\'asta', descrizione: 'Portata extra e controllo della creatura in mischia.', livelloBase: 1 },
    { nome: 'Armi da fuoco', descrizione: 'Danno esplosivo, richiede rinculo e mira stabilizzata.', livelloBase: 1 },
    { nome: 'Rampini e fruste', descrizione: 'Controllo del campo e disarmo; utile sui bersagli mobili.', livelloBase: 1 }
];

// --- UTILITY: COLORI BARRE ---
function getColoreBarra(percentuale) {
    if (percentuale > 80) return "#2ecc71"; // Verde
    if (percentuale > 50) return "#f1c40f"; // Giallo
    if (percentuale > 25) return "#e67e22"; // Arancione
    if (percentuale > 5)  return "#e74c3c"; // Rosso
    return "#000000";                       // Nero
}

function getBarra(val, max, color) {
    const percent = max > 0 ? Math.max(0, Math.min(100, (val / max) * 100)) : 0;
    return `
        <div class="stat-bar" style="background:#111; margin:6px 0; border:1px solid #333;">
            <div class="bar-fill" style="width:${percent}%; background:${color};"></div>
        </div>`;
}

// --- NUOVA LOGICA: PASSA TEMPO GLOBALE (L'unico modo per far scorrere il tempo) ---
function passaTempoGlobale() {
    let oreInput = prompt("Quante ore vuoi far passare nel mondo?", "1");
    let ore = parseInt(oreInput);
    if (isNaN(ore) || ore <= 0) return;

    // Avanza il tempo globale di 'ore' ore in blocco
    const giornoPrecedente = Math.floor(oreTotali / 24);
    oreTotali += ore;
    window.oreTotali = oreTotali;
    const giornoAttuale = Math.floor(oreTotali / 24);

    // Degrado del cibo: 25% di probabilità per ogni giorno che passa
    for (let giorno = giornoPrecedente + 1; giorno <= giornoAttuale; giorno++) {
    if (magazzino.cibo > 0 && Math.random() < 0.25) {
        const perduto = rollDice(1, 6);
        const effettivo = Math.min(magazzino.cibo, perduto);
        
        let ciboPersoDefinitivo = effettivo;

        if (magazzino.conserve > 0) {
            const ridotto = effettivo / 2;
            magazzino.conserve = Math.max(0, magazzino.conserve - 1);
            magazzino.cibo = Math.max(0, magazzino.cibo - ridotto);
            ciboPersoDefinitivo = ridotto;
            alert(`Una conserva ha ridotto il degrado: perso solo ${ridotto.toFixed(1)} cibo, consumata 1 conserva.`);
        } else {
            magazzino.cibo = Math.max(0, magazzino.cibo - effettivo);
            alert(`Attenzione: il cibo è andato a male o è stato mangiato da animali! Perduti ${effettivo.toFixed(1)} unità di cibo.`);
        }

        // Il 50% del cibo perso si trasforma in cibo avariato
        const generatoAvariato = ciboPersoDefinitivo * 0.5;
        magazzino.ciboaviarto += generatoAvariato;
        alert(`Il 50% del cibo andato a male (${generatoAvariato.toFixed(1)} unità) è stato recuperato come Cibo Avariato.`);
    }
    
    if (magazzino.piattiDeliziosi > 0 && Math.random() < 0.40) {
        const perduti = Math.min(magazzino.piattiDeliziosi, rollDice(1, 4));
        magazzino.piattiDeliziosi = Math.max(0, magazzino.piattiDeliziosi - perduti);
        if (perduti > 0) {
            alert(`Attenzione: ${perduti} piatto/i delizioso/i si sono degradati durante il giorno ${giorno}.`);
        }
    }
    }

    for (let i = party.length - 1; i >= 0; i--) {
        const p = party[i];
        if (typeof p.resetDailyStudy === 'function') p.resetDailyStudy(oreTotali);
        const causaMorte = (typeof p.tickOre === 'function') ? p.tickOre(ore) : null;
        
        if (causaMorte) {
            alert(`CONDOGLIANZE: ${p.nome} è morto per ${causaMorte}.`);
            
            // Calcolo giorni di sopravvivenza con fallback di sicurezza se giornoInizio è undefined
            const giornoInizioEffettivo = typeof p.giornoInizio === 'number' ? p.giornoInizio : 0;
            const giorniSopravvissuto = giornoAttuale - giornoInizioEffettivo;

            // Inserimento sicuro nel cimitero
            cimitero.push({
                nome: p.nome,
                causa: causaMorte,
                giorni: giorniSopravvissuto,
                data: `${giornoAttuale}° Giorno`
            });
            window.cimitero = cimitero;
            
            party.splice(i, 1);
            if (typeof chiudiScheda === 'function') chiudiScheda();
        } else {
            processAutomaticActions(p);
        }
    }
    aggiornaInterfaccia();
}

// --- AGGIORNAMENTO INTERFACCIA PRINCIPALE ---
window.aggiornaInterfaccia = function aggiornaInterfaccia() {
    if (window._isUpdatingUI) return;
    window._isUpdatingUI = true;
    try {
        const giornoAttuale = Math.floor(oreTotali / 24);
    const oraAttuale = oreTotali % 24;
    
    document.getElementById('display-giorno').innerText = giornoAttuale;
    document.getElementById('display-ora').innerText = `${oraAttuale < 10 ? '0' : ''}${oraAttuale}:00`;
    document.getElementById('display-cibo').innerText = (magazzino.cibo || 0).toFixed(1);
    const conserveDisplay = document.getElementById('display-conserve');
    if (conserveDisplay) conserveDisplay.innerText = magazzino.conserve || 0;
    const deliziosiDisplay = document.getElementById('display-piatti-deliziosi');
    if (deliziosiDisplay) deliziosiDisplay.innerText = magazzino.piattiDeliziosi || 0;
    const ciboAvariatoDisplay = document.getElementById('display-cibo-avariato');
    if (ciboAvariatoDisplay) ciboAvariatoDisplay.innerText = (magazzino.ciboaviarto || 0).toFixed(1);
    document.getElementById('display-acqua').innerText = (magazzino.acqua || 0).toFixed(1);
    document.getElementById('display-alchemici').innerText = magazzino.materialiAlchemici || 0;
    document.getElementById('display-ingranaggi').innerText = magazzino.ingranaggi || 0;
    document.getElementById('display-medici-base').innerText = (magazzino.materialiMedici || {}).base || 0;
    document.getElementById('display-medici-avanzati').innerText = (magazzino.materialiMedici || {}).avanzati || 0;
    document.getElementById('display-medici-critici').innerText = (magazzino.materialiMedici || {}).critici || 0;

    const container = document.getElementById('party-container');
    container.innerHTML = "";

    const assistStatus = assistenzaSelezionata ?
        `<div style="margin-bottom:12px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <button class="btn-hero" onclick="apriAiutoModal()">🤝 Aiuta qualcuno</button>
            <div style="flex:1; min-width:220px; color:#f1c40f;">Assistente selezionato: <strong>${party[assistenzaSelezionata.idx]?.nome || 'Nessuno'}</strong> per <strong>${assistenzaSelezionata.tipo}</strong></div>
            <button class="btn-big" style="background:#c0392b;" onclick="annullaAssistente()">Annulla assistenza</button>
        </div>` :
        `<div style="margin-bottom:12px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <button class="btn-hero" onclick="apriAiutoModal()">🤝 Aiuta qualcuno</button>
        </div>`;
    container.innerHTML = assistStatus;

    // Applica effetti dei perk (retroattivo/continuo)
    party.forEach(papply => { if (typeof applyPerkEffects === 'function') applyPerkEffects(papply); });

    party.forEach((p, idx) => {
        const giornoAttuale = Math.floor(oreTotali / 24);
        // Calcolo Barre con Decimali
        const risorse = [
            { label: "Fame", attuale: p.fame, max: 14 },
            { label: "Sete", attuale: p.sete, max: 4 },
            { label: "Sonno", attuale: p.sonno, max: 8 }
        ];

        let barsHtml = "";
        risorse.forEach(r => {
            let taccheHtml = "";
            const colore = getColoreBarra((r.attuale / r.max) * 100);
            for (let i = 0; i < r.max; i++) {
                let opacita = 0.2;
                if (i < Math.floor(r.attuale)) opacita = 1;
                else if (i === Math.floor(r.attuale)) opacita = 0.2 + (r.attuale % 1) * 0.8;
                taccheHtml += `<div class="tacca" style="background-color: ${colore}; opacity: ${opacita}; flex: 1; height: 8px; margin: 1px; border-radius: 1px;"></div>`;
            }
            barsHtml += `
                <div style="display: flex; justify-content: space-between; font-size: 0.65em; margin-top: 4px;">
                    <span>${r.label.toUpperCase()}</span>
                    <span>${r.attuale.toFixed(2)} / ${r.max}</span>
                </div>
                <div style="display: flex; background: #111; padding: 1px; border: 1px solid #333;">${taccheHtml}</div>
            `;
        });

        // Stato del Thread
        let statoAzione = "In attesa";
        if (p.inSpedizione) statoAzione = "<span style='color:#3498db'>🚚 IN SPEDIZIONE</span>";
        else if (p.azioneCorrente) statoAzione = `<span style='color:#f1c40f'>🔨 ${p.azioneCorrente.tipo.toUpperCase()} (${p.azioneCorrente.oreRimanenti}h)</span>`;

        let card = document.createElement('div');
        card.className = `card-personaggio ${p.inSpedizione ? 'spedizione-active' : ''}`;

        // Determina se l'utente corrente può vedere/comandare questo personaggio
        const user = getCurrentUser();
        const isMaster = user && user.role === 'master';
        const isOwner = user && p.user_id === user.id;
        const canManage = isMaster || isOwner;
        const isGuest = window.guestMode;

        // Se è un giocatore e non è il proprietario, nascondi statistiche e azioni
        let detailsHtml = '';
        if (canManage) {
            detailsHtml = `
                <div style="font-size:0.8em; margin-bottom:4px;">
                    <strong>PF Reali:</strong> ${p.puntiFeritaReali} / ${p.puntiFeritaRealiMax} - ${p.woundState}
                </div>
                <div style="font-size:0.8em; margin-bottom:6px; color:#ddd;">
                    <strong>PCA in corso:</strong> ${Object.entries(p.pca || {}).filter(([, v]) => v > 0).map(([cat, val]) => `${cat}: ${val.toFixed(1)}`).join(' • ') || 'Nessuno'}
                </div>
                <div style="font-size:0.8em; margin-bottom:6px; color:#ddd;">
                    <strong>Piatti deliziosi:</strong> ${magazzino.piattiDeliziosi}
                </div>
                ${getBarra(p.puntiFeritaReali, p.puntiFeritaRealiMax, '#c0392b')}
                <div style="font-size:0.75em; margin-bottom:10px; color:#aaa;">${p.woundEffectText}</div>
                <div style="font-size:0.7em; margin-bottom:10px;">Stato: <b>${statoAzione}</b></div>
            
                <div style="display:flex; gap:4px; margin-bottom:10px;">
                    <button class="btn-big" style="flex:1; background:#8e44ad;" onclick="apriDocumentiPersonaggio(${idx})">📜 Doc</button>
                    <button class="btn-big" style="flex:1; background:#2980b9;" onclick="apriStatiPersonaggio(${idx})">✨ Stati</button>
                </div>
            
                <div class="mini-bars-container">${barsHtml}</div>

                <button onclick="apriScheda(${idx})" style="width:100%; margin-bottom:10px;">Visualizza Scheda</button>
                <div class="action-dropdowns" style="margin-top: 12px; display:grid; gap:6px;">
                    <details class="action-dropdown">
                        <summary>SOPRAVVIVI</summary>
                        <div class="dropdown-buttons">
                            <button onclick="openRisorsaModal(${idx}, 'fame')">Nutri</button>
                            <button onclick="openRisorsaModal(${idx}, 'sete')">Bevi</button>
                            <button onclick="openRisorsaModal(${idx}, 'sonno')">Dormi</button>
                            <button onclick="apriMedica(${idx})">Medica</button>
                        </div>
                    </details>
                    <details class="action-dropdown">
                        <summary>CREA</summary>
                        <div class="dropdown-buttons">
                            <button onclick="openCucinaModal(${idx})">Cucina</button>
                            <button onclick="alchimiaPersonaggio(${idx})">Alchimia</button>
                            <button onclick="artificeriaPersonaggio(${idx})">Artificeria</button>
                        </div>
                    </details>
                    <details class="action-dropdown">
                        <summary>MIGLIORA</summary>
                        <div class="dropdown-buttons">
                            <button onclick="allenamento(${idx})">Allenamento</button>
                            <button onclick="studio(${idx})">Studio</button>
                        </div>
                    </details>
                    <details class="action-dropdown">
                        <summary>ESPLORA</summary>
                        <div class="dropdown-buttons">
                            <button onclick="spedisciPersonaggio(${idx})">Spedisci</button>
                            <button onclick="esplora(${idx})">🔎 Esplora</button>
                        </div>
                    </details>
                </div>
            `;
        } else {
            // Se non è il proprietario, vede solo il nome e lo stato di azione (opzionale, ma non vede stat vitali)
            detailsHtml = `
                <div style="padding: 20px; text-align: center; color: #666; font-style: italic;">
                    Statistiche e azioni riservate al proprietario
                </div>
                <div style="font-size:0.7em; margin-top:10px; text-align:center;">Stato: <b>${p.inSpedizione ? 'In Spedizione' : 'In Rifugio'}</b></div>
            `;
        }

        card.innerHTML = `
            <div class="card-header">
                <h3 style="margin:0">${p.nome}</h3>
                ${canManage ? `<span class="fatica-badge">Fatic. ${p.faticaTotale}</span>` : ''}
            </div>
            ${detailsHtml}
        `;
        container.appendChild(card);
    });
    renderCimitero();
    autoSaveParty();
    } finally {
        window._isUpdatingUI = false;
    }
}

// --- LOGICA DELLE AZIONI (Thread e Code) ---
function toggleSpedizione(idx) {
    party[idx].inSpedizione = !party[idx].inSpedizione;
    aggiornaInterfaccia();
}

function apriAiutoModal() {
    renderAiutoModal();
    const modal = document.getElementById('modal-aiuto');
    if (modal) modal.style.display = 'block';
}

function annullaAssistente() {
    assistenzaSelezionata = null;
    aggiornaInterfaccia();
    if (typeof mostraNotificaInAlto === 'function') mostraNotificaInAlto('Assistenza annullata.', 'avviso');
}

function selezionaAssistente(idx, tipo) {
    const p = party[idx];
    if (!p) return;
    assistenzaSelezionata = { idx, tipo };
    if (typeof mostraNotificaInAlto === 'function') mostraNotificaInAlto(`${p.nome} è pronto ad aiutare con ${tipo}.`, 'successo');
    renderAiutoModal();
    aggiornaInterfaccia();
}

function getCurrentActionText(p) {
    if (p.inSpedizione) return '🚚 In spedizione';
    if (p.azioneCorrente) {
        const subject = p.azioneCorrente.subject ? ` ${p.azioneCorrente.subject}` : '';
        return `🔨 ${p.azioneCorrente.tipo.toUpperCase()}${subject} (${p.azioneCorrente.oreRimanenti}h)`;
    }
    return 'In attesa';
}

function hasNaturaSupport(p) {
    return p.hasCompetenza && p.hasCompetenza('Natura');
}

function renderAiutoModal() {
    const content = document.getElementById('aiuto-content');
    if (!content) return;

    let html = `<div style="margin-bottom:14px; color:#ddd; font-size:0.9rem;">
        <p>Seleziona un personaggio disponibile e scegli che tipo di aiuto può offrire.</p>
        <p>Studiare: serve competenza nella materia studiata.</p>
        <p>Curare: serve almeno Medicina Livello 1.</p>
        <p>Alchimia: serve competenza in Natura.</p>
    </div>`;

    html += '<div style="display:grid; gap:10px;">';
    party.forEach((p, idx) => {
        const canHelpStudy = p.azioneCorrente && p.azioneCorrente.tipo === 'studio-libro' && p.hasCompetenza && p.hasCompetenza(p.azioneCorrente.subject);
        const hasStudyCandidate = party.some(target => target !== p && target.azioneCorrente && target.azioneCorrente.tipo === 'studio-libro');
        const canHelpMedicine = p.livelloMedicina >= 1;
        const canHelpAlchemy = hasNaturaSupport(p);
        html += `<div style="background:#111; padding:12px; border:1px solid #333; border-radius:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong>${p.nome}</strong>
                <span style="font-size:0.85em; color:#aaa;">${getCurrentActionText(p)}</span>
            </div>
            <div style="font-size:0.85em; color:#ccc; margin-bottom:10px;">
                ${canHelpStudy ? 'Può assistere uno studente nella materia corrente.' : 'Assist. studio: ' + (hasStudyCandidate ? 'richiede la materia giusta' : 'nessuna azione di studio attiva')}<br>
                ${canHelpMedicine ? 'Può aiutare in un intervento medico.' : 'Non può assistere in medicina'}<br>
                ${canHelpAlchemy ? 'Può assistere in Alchimia.' : 'Non può assistere in alchimia'}
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button class="btn-big" style="flex:1;" onclick="selezionaAssistente(${idx}, 'studio')" ${hasStudyCandidate ? '' : 'disabled'}>Assisti Studio</button>
                <button class="btn-big" style="flex:1;" onclick="selezionaAssistente(${idx}, 'medicina')" ${canHelpMedicine ? '' : 'disabled'}>Assisti Medicina</button>
                <button class="btn-big" style="flex:1;" onclick="selezionaAssistente(${idx}, 'alchimia')" ${canHelpAlchemy ? '' : 'disabled'}>Assisti Alchimia</button>
            </div>
        </div>`;
    });
    html += '</div>';
    content.innerHTML = html;
}

function renderAlchemyModal() {
    if (typeof alchimiaPersonaggio === 'function') {
        alchimiaPersonaggio(alchimiaPersonaggioSelezionata);
    }
}

function puoIniziareAzione(p, tipo) {
    if (!p) return false;
    const azioniConsentite = ['dormi', 'nutri', 'disseta'];
    if (p.staminaAttuale <= 0 && !azioniConsentite.includes(tipo)) {
        alert(`${p.nome} è troppo esausto per farlo. Deve riposare, bere o mangiare prima.`);
        return false;
    }
    return true;
}

function allenamento(idx) {
    const modal = document.getElementById('modal-allenamento');
    const content = document.getElementById('allenamento-content');
    const p = party[idx];
    if (!puoIniziareAzione(p, 'allenamento')) return;

    const categorie = ['Archi', 'Balestre', 'Armi con l\'asta', 'Lame leggere', 'Armi da fuoco', 'Rampini e fruste', 'Mazze e armi contundenti'];
    const giornoAttuale = Math.floor(oreTotali / 24);
    const gratuite = p.calcolaOreAllenamentoGratuite(giornoAttuale);
    const rimanenti = Math.max(0, gratuite - p.oreAllenamento);
    
    let html = `<div style="margin-bottom:12px; color:#ddd;">
        <p><strong>${p.nome}</strong></p>
        <p>Ore allenamento gratuite oggi: <span style="color:#2ecc71">${rimanenti}/${gratuite}</span></p>
        <p>Stamina attuale: ${p.staminaAttuale}/${p.staminaMax}</p>
    </div>
    <p style="font-weight:bold; color:#f1c40f; margin-bottom:10px;">Seleziona categoria arma e ore da programmare:</p>
    <div style="display:grid; gap:10px;">`;
    
    categorie.forEach(cat => {
        const pca = p.pca[cat] || 0;
        html += `<div style="background:#222; padding:8px; border:1px solid #333; border-radius:4px;">
            <div style="margin-bottom:6px;"><strong>${cat}</strong> - PCA: ${pca.toFixed(1)}</div>
            <div style="display:flex; gap:4px; align-items:center; margin-bottom:4px;">
                <input type="number" id="ore-${cat}" min="1" value="1" style="width:60px; padding:4px;">
                <button class="btn-big" style="flex:1;" onclick="scheduleAllenamento(${idx}, '${cat}')">Programma</button>
            </div>
        </div>`;
    });
    
    html += `</div>`;
    content.innerHTML = html;
    modal.style.display = 'block';
}

function scheduleAllenamento(idx, categoria) {
    const p = party[idx];
    if (!puoIniziareAzione(p, 'allenamento')) return;
    const oraElement = document.getElementById(`ore-${categoria}`);
    if (!oraElement) return;
    const ore = parseInt(oraElement.value);
    if (isNaN(ore) || ore <= 0) { alert('Inserisci un numero valido di ore.'); return; }

    const nuovaAzione = {
        tipo: 'allenamento',
        categoria: categoria,
        oreTotali: ore,
        oreRimanenti: ore,
        onComplete: () => completeAllenamento(p, categoria, ore)
    };

    if (p.azioneCorrente) {
        if (confirm(`${p.nome} sta già facendo un'altra azione. Vuoi mettere questo allenamento in coda?`)) {
            p.codaAzioni.push(nuovaAzione);
            alert(`${p.nome} inizierà l'allenamento quando avrà finito l'azione corrente.`);
        }
    } else {
        p.azioneCorrente = nuovaAzione;
        alert(`${p.nome} inizia l'allenamento per ${ore} ore su ${categoria}.`);
    }

    aggiornaInterfaccia();
}

function completeAllenamento(p, categoria, ore) {
    const giornoAttuale = Math.floor(oreTotali / 24);
    const result = p.addestraArma(categoria, ore, giornoAttuale);
    alert(`${p.nome} ha completato l'allenamento di ${ore} ore su ${categoria}!\n\nOre gratuite usate: ${result.oreGratuite}\nOre a pagamento: ${result.oreAGagoPagato}\nStamina consumata: ${result.staminaUsata}\nPCA guadagnato: +${result.pcaGuadagnato}`);
    aggiornaInterfaccia();
}

function registraAttaccoModal(idx) {
    const modal = document.getElementById('modal-regista-attacco');
    const content = document.getElementById('regista-attacco-content');
    const p = party[idx];
    
    const categorie = ['Archi', 'Balestre', 'Armi con l\'asta', 'Lame leggere', 'Armi da fuoco', 'Rampini e fruste', 'Mazze e armi contundenti'];
    
    let html = `<div style="margin-bottom:12px; color:#ddd;">
        <p><strong>${p.nome}</strong></p>
        <p style="font-size:0.9rem; color:#aaa;">Registra i tuoi colpi per guadagnare PCA!</p>
    </div>
    <p style="font-weight:bold; color:#f1c40f; margin-bottom:10px;">Seleziona arma e risultato:</p>
    <div style="display:grid; gap:10px;">`;
    
    categorie.forEach(cat => {
        const pca = p.pca[cat] || 0;
        html += `<div style="background:#222; padding:10px; border:1px solid #333; border-radius:4px;">
            <div style="margin-bottom:8px;"><strong>${cat}</strong> - PCA: ${pca.toFixed(1)}</div>
            <div style="display:flex; gap:4px; flex-wrap:wrap;">
                <button class="btn-big" style="flex:1; min-width:80px; background:#2ecc71;" onclick="registraColpo(${idx}, '${cat}', 'success')">✓ Colpo (+1)</button>
                <button class="btn-big" style="flex:1; min-width:80px; background:#f39c12;" onclick="registraColpo(${idx}, '${cat}', 'critical')">⚡ Critico (+2)</button>
                <button class="btn-big" style="flex:1; min-width:80px; background:#e74c3c;" onclick="registraColpo(${idx}, '${cat}', 'fail')">✗ Mancato (+0.5)</button>
            </div>
        </div>`;
    });
    
    html += `</div>`;
    content.innerHTML = html;
    modal.style.display = 'block';
}

function registraColpo(idx, categoria, risultato) {
    const p = party[idx];
    p.registraColpoCombattimento(categoria, risultato);
    
    const labels = { success: 'Colpo riuscito', critical: 'Colpo critico', fail: 'Colpo fallito' };
    const gains = { success: 1, critical: 2, fail: 0.5 };
    
    alert(`${p.nome} ha registrato un ${labels[risultato]} con ${categoria}!\n+${gains[risultato]} PCA`);
    registraAttaccoModal(idx); // Refresh
    aggiornaInterfaccia();
}

function visualizzaPerk(idx) {
    const modal = document.getElementById('modal-perk-viewer');
    const content = document.getElementById('perk-viewer-content');
    const p = party[idx];
    const allSkills = Object.keys(SKILL_SYSTEM.semantics);
    const competenzeEffettive = allSkills.filter(s => p.getSkillRating && p.getSkillRating(s) === 1);
    const maestrieEffettive = allSkills.filter(s => p.getSkillRating && p.getSkillRating(s) === 2);

    let html = `<div style="margin-bottom:12px; color:#ddd;">
        <p><strong>Competenze e Tratti di ${p.nome}</strong></p>
    </div>`;
    
    // 1. Box Competenze (Solo livello 1)
    if (competenzeEffettive.length > 0) {
        html += `<div style="margin-bottom:14px; background:#1a1a1a; padding:10px; border:1px solid #333; border-radius:6px;">
            <p style="color:#f1c40f; font-weight:bold; margin-bottom:8px;">COMPETENZE AGGIUNTIVE (${competenzeEffettive.length})</p>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                ${competenzeEffettive.map(c => `<span style="background:#111; color:#2ecc71; padding:4px 8px; border:1px solid #2ecc71; border-radius:4px; font-size:0.85rem;">✓ ${c}</span>`).join('')}
            </div>
        </div>`;
    }
    
    // 2. Box Maestrie Dinamiche (Livello 2 con descrizione dei poteri sbloccati)
    if (maestrieEffettive.length > 0) {
        html += `<div style="margin-bottom:14px; background:#1a1a1a; padding:10px; border:1px solid #333; border-radius:6px;">
            <p style="color:#ff9800; font-weight:bold; margin-bottom:8px;">MAESTRIE SBLOCCATE (${maestrieEffettive.length})</p>`;
        maestrieEffettive.forEach(m => {
            const descrizioneTratto = SKILL_SYSTEM.masteryDescriptions[m] || "Nessun effetto speciale registrato.";
            html += `<div style="background:#111; padding:8px; margin-bottom:6px; border-left:3px solid #ff9800; border-radius:3px; text-align:left;">
                <div style="color:#ff9800; font-weight:bold; margin-bottom:2px;">⭐ ${m} (Livello 2)</div>
                <div style="color:#ccc; font-size:0.85rem; font-style:italic;">${descrizioneTratto}</div>
            </div>`;
        });
        html += `</div>`;
    } else {
        html += `<div style="margin-bottom:14px; background:#1a1a1a; padding:10px; border:1px solid #333; border-radius:6px;">
            <p style="color:#ff9800; font-weight:bold; margin-bottom:8px;">MAESTRIE SBLOCCATE</p>
            <p style="color:#888; font-size:0.85rem; margin:0;">Nessuna maestria di livello 2 sbloccata.</p>
        </div>`;
    }
    
    // 3. Gestione Perk di Medicina ed Altri Perk
    if (p.perks && p.perks.length > 0) {
        const medicinePerks = p.perks.filter(perk => {
            if (typeof perk === 'string') return false;
            return perk && perk.nome && perk.nome.toLowerCase().includes('medicina');
        });
        
        if (medicinePerks.length > 0) {
            html += `<div style="margin-bottom:14px; background:#1a1a1a; padding:10px; border:1px solid #333; border-radius:6px;">
                <p style="color:#f1c40f; font-weight:bold; margin-bottom:8px;">MEDICINA ACQUISITA (${medicinePerks.length})</p>`;
            medicinePerks.forEach(perk => {
                html += `<div style="background:#111; padding:6px; margin-bottom:6px; border-left:3px solid #16a085; border-radius:3px; text-align:left;">
                    <div style="color:#16a085; font-weight:bold; margin-bottom:2px;">${perk.nome}</div>
                    <div style="color:#aaa; font-size:0.9rem;">${perk.desc}</div>
                    <div style="color:#888; font-size:0.85rem; margin-top:2px;"><em>Costo: ${perk.costo}</em></div>
                </div>`;
            });
            html += `</div>`;
        }
        
        const otherPerks = p.perks.filter(perk => {
            if (typeof perk === 'string') return true;
            return !perk || !perk.nome || !perk.nome.toLowerCase().includes('medicina');
        });
        
        if (otherPerks.length > 0) {
            html += `<div style="margin-bottom:14px; background:#1a1a1a; padding:10px; border:1px solid #333; border-radius:6px;">
                <p style="color:#f1c40f; font-weight:bold; margin-bottom:8px;">PERK ATTIVI (${otherPerks.length})</p>`;
            otherPerks.forEach(perk => {
                if (typeof perk !== 'string') {
                    html += `<div style="background:#111; padding:6px; margin-bottom:6px; border-left:3px solid #3498db; border-radius:3px; text-align:left;">
                        <div style="color:#3498db; font-weight:bold; margin-bottom:2px;">${perk.nome}</div>
                        <div style="color:#aaa; font-size:0.9rem;">${perk.desc}</div>
                        <div style="color:#888; font-size:0.85rem; margin-top:2px;"><em>Costo: ${perk.costo}</em></div>
                    </div>`;
                }
            });
            html += `</div>`;
        }
    } else {
        html += `<div style="margin-bottom:14px; background:#1a1a1a; padding:10px; border:1px solid #333; border-radius:6px;">
            <p style="color:#f1c40f; font-weight:bold; margin-bottom:8px;">PERK</p>
            <p style="color:#aaa;">Nessun perk acquisito.</p>
        </div>`;
    }

    // 4. Tabella Armi
    html += `<div style="margin-bottom:14px; background:#1a1a1a; padding:10px; border:1px solid #333; border-radius:6px;">
        <div style="color:#f1c40f; font-weight:bold; margin-bottom:8px;">ARMATURE E ARMI</div>
        <div style="color:#aaa; font-size:0.9rem; margin-bottom:8px;">Ogni arma ha livello e descrizione. Per salire al livello successivo serve aver già ottenuto il livello precedente.</div>`;
    TABELLA_ARMI.forEach(arma => {
        const livello = p.armiLivello ? (p.armiLivello[arma.nome] || 0) : 0;
        html += `<div style="background:#111; padding:8px; margin-bottom:6px; border-left:3px solid #9b59b6; border-radius:3px; text-align:left;">
            <div style="color:#9b59b6; font-weight:bold;">${arma.nome} - Livello ${livello}</div>
            <div style="color:#ccc; font-size:0.9rem;">${arma.descrizione}</div>
        </div>`;
    });
    html += `</div>`;

    // 5. Tabella Trattamenti Medicina
    html += `<div style="margin-bottom:14px; background:#1a1a1a; padding:10px; border:1px solid #333; border-radius:6px;">
        <div style="color:#f1c40f; font-weight:bold; margin-bottom:8px;">MEDICINA</div>
        <div style="color:#aaa; font-size:0.9rem; margin-bottom:8px;">La tabella Medicina mostra i progressi di trattamento curativo.</div>`;
    MEDICINA_LIVELLI.forEach(entry => {
        html += `<div style="background:#111; padding:8px; margin-bottom:6px; border-left:3px solid #16a085; border-radius:3px; text-align:left;">
            <div style="color:#16a085; font-weight:bold;">Livello ${entry.livello}</div>
            <div style="color:#ccc; font-size:0.9rem;">${entry.effetto}</div>
        </div>`;
    });
    html += `</div>`;

    content.innerHTML = html;
    modal.style.display = 'block';
}

function pianificaAzione(idx, tipo, bookId = null, subject = null, bookTitle = null, ore = null, teacherName = null) {
    const p = party[idx];
    if (!puoIniziareAzione(p, tipo)) return;
    let plannedHours;
    if (tipo === 'studio-libro') {
        if (!bookId || !ore) return;
        plannedHours = ore;
    } else {
        const defaultHours = tipo === 'dormi' ? '8' : '1';
        plannedHours = prompt(`Quante ore vuoi dedicare a: ${tipo.toUpperCase()}?`, defaultHours);
        plannedHours = parseFloat(plannedHours);
        if (isNaN(plannedHours) || plannedHours <= 0) return;
        if (tipo === 'dormi') {
            const maxRiposo = p.maxOreRiposo || 24;
            if (plannedHours > maxRiposo) {
                if (!confirm(`Con la tua fame/sete puoi riposare al massimo ${maxRiposo} ore. Ridurre a ${maxRiposo}?`)) return;
                plannedHours = maxRiposo;
            }
        }
    }

    const nuovaAzione = { tipo: tipo, oreTotali: plannedHours, oreRimanenti: plannedHours };
    if (tipo === 'studio-libro') {
        nuovaAzione.bookId = bookId;
        nuovaAzione.subject = subject;
        nuovaAzione.bookTitle = bookTitle;
        nuovaAzione.teacherName = teacherName;
        nuovaAzione.onComplete = () => completaStudioBookAction(p, nuovaAzione);
    } else if (tipo === 'studio') {
        nuovaAzione.onComplete = () => {
            const guadagno = awardStudyPM(p, plannedHours);
            if (guadagno > 0) {
                alert(`${p.nome} impara Medicina: +${guadagno} PM (massimo ${getStudyPMCap(p)} totali per il livello corrente).`);
            } else {
                alert(`${p.nome} studia Medicina ma non ottiene PM aggiuntivi oltre il limite attuale.`);
            }
        };
    }

    if (p.azioneCorrente) {
        if (confirm(`${p.nome} sta già facendo altro. Vuoi metterlo in coda?`)) {
            p.codaAzioni.push(nuovaAzione);
        }
    } else {
        p.azioneCorrente = nuovaAzione;
    }
    aggiornaInterfaccia();
}

function toggleFinoAllUltimo(idx) {
    const p = party[idx];
    p.finoAllUltimoActive = !p.finoAllUltimoActive;
    renderSpedizioneModal();
    aggiornaInterfaccia();
}

function rollD20() {
    return Math.floor(Math.random() * 20) + 1;
}

function rollD20WithAdv(advantage, disadvantage) {
    if (advantage && !disadvantage) {
        const a = rollD20();
        const b = rollD20();
        return Math.max(a, b);
    }
    if (disadvantage && !advantage) {
        const a = rollD20();
        const b = rollD20();
        return Math.min(a, b);
    }
    return rollD20();
}

function rollDice(count, faces) {
    let total = 0;
    for (let i = 0; i < count; i++) {
        total += Math.floor(Math.random() * faces) + 1;
    }
    return total;
}

function getExplorationBonus(p) {
    const skill = p.getSkillModifierForCheck ? p.getSkillModifierForCheck('Sopravvivenza') : { modifier: 0, advantage: false, disadvantage: false };
    return skill.modifier || 0;
}


function apriBiblioteca() {
    const modal = document.getElementById('modal-biblioteca');
    const content = document.getElementById('biblioteca-content');
    if (!modal || !content) return;
    let html = '<h3>Libri nella biblioteca</h3>';
    if (!magazzino.libri.length) {
        html += '<p>No books available at the moment.</p>';
    } else {
        html += '<div style="display:grid; grid-template-columns: 1fr 140px 120px 120px; gap:6px; align-items:center; font-weight:bold; margin-bottom:8px;">';
        html += '<div>Titolo</div><div>Materia</div><div>Ore restanti</div><div>Ore libro</div>';
        html += '</div>';
        magazzino.libri.forEach(book => {
            html += `<div style="padding:6px; background:#0f0f0f; border:1px solid #222;">${book.title}</div>`;
            html += `<div style="padding:6px; background:#0f0f0f; border:1px solid #222;">${book.subject}</div>`;
            html += `<div style="padding:6px; background:#0f0f0f; border:1px solid #222; text-align:right;">${Math.max(0, book.maxStudyHours - book.usedHours)}h</div>`;
            html += `<div style="padding:6px; background:#0f0f0f; border:1px solid #222; text-align:right;">${book.hours}h</div>`;
        });
    }
    content.innerHTML = html;
    modal.style.display = 'block';
}

function applyPerkEffects(p) {
    if (!p) return;
    p.perkFlags = p.perkFlags || {};
    // Guerriero: PF fortuna max 20
    if (hasPerk(p, 'Guerriero')) {
        p.puntiFortunaMax = 20;
        p.perkFlags.guerriero = true;
    } else {
        // default base
        p.puntiFortunaMax = p.puntiFortunaMax || 15;
    }
    // Se il personaggio è al max, mantieni pieno
    if (!p.inSpedizione) p.puntiFortuna = Math.min(p.puntiFortuna, p.puntiFortunaMax);
}

window.renderSetupStats = renderSetupStats;
window.renderSetupPerks = renderSetupPerks;
window.renderSetupMagic = renderSetupMagic;
window.DATABASE_PERK = DATABASE_PERK;

function renderSetupStats() {
    const stats = ["Forza", "Destrezza", "Costituzione", "Intelligenza", "Saggezza", "Carisma"];
    const container = document.getElementById('stats-setup-container');
    if (!container) return;
    
    const p = window.tempP;
    if (!p) return;

    container.innerHTML = ""; 
    stats.forEach(s => {
        // Interroghiamo il getter dinamico per avere il valore influenzato dai perk
        const dettagli = p.getStatDettagliata ? p.getStatDettagliata(s) : { valore: p[s.toLowerCase()], mod: 0 };
        const val = dettagli.valore;
        const modSign = dettagli.mod >= 0 ? `+${dettagli.mod}` : dettagli.mod;

        container.innerHTML += `
            <div class="stat-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; background:#222; padding:5px; border-radius:3px;">
                <span style="font-weight:bold; color:#f1c40f">${s.toUpperCase()} <small style="color:#aaa">(${modSign})</small></span>
                <div class="stat-controls">
                    <button onclick="modificaStat('${s}', -1)">-</button>
                    <span class="stat-value" style="display:inline-block; width:25px; text-align:center; font-weight:bold;">${val}</span>
                    <button onclick="modificaStat('${s}', 1)">+</button>
                </div>
            </div>`;
    });
    
    const displayPunti = document.getElementById('punti-residui');
    if (displayPunti) {
        displayPunti.innerHTML = `Punti Disponibili: <b style="color:${p.puntiCreazione < 0 ? '#e74c3c' : '#2ecc71'}">${p.puntiCreazione}</b>`;
    }

    renderSetupMagic();
}

function renderSetupMagic() {
    const container = document.getElementById('magia-setup-container');
    if (!container) return;
    
    const p = window.tempP;
    if (!p) return;

    const livello = p.livelloMagia || 0;
    const manaMax = p.getManaMaxFromLevel ? p.getManaMaxFromLevel(livello) : 0;
    const attMagia = p.getCastingAttribute ? p.getCastingAttribute() : 'Intelligenza';
    const modMagia = p.getCastingModifier ? p.getCastingModifier() : 0;
    const arcanoBonus = p.hasArcanoMastery ? p.hasArcanoMastery() : false;

    container.innerHTML = `
        <div class="stat-row" style="display:grid; grid-template-columns: 1fr auto; gap:8px; background:#111; padding:10px; border-radius:6px; margin-top:10px;">
            <div>
                <div style="font-weight:bold; color:#f1c40f; margin-bottom:4px;">MAGIA E MANA</div>
                <div style="font-size:0.9rem; color:#ddd; margin-bottom:6px;">Usa la caratteristica più alta tra Intelligenza, Saggezza e Carisma per il lancio degli incantesimi.</div>
                <div style="font-size:0.85rem; color:#eee;">Caratteristica incantatore: <b>${attMagia}</b> (<span style="color:${modMagia >= 0 ? '#2ecc71' : '#e74c3c'}">${modMagia >= 0 ? '+' : ''}${modMagia}</span>)</div>
                <div style="font-size:0.85rem; color:#eee; margin-top:4px;">Mana massima: <b>${manaMax}</b></div>
                <div style="font-size:0.8rem; color:#aaa; margin-top:4px;">Riposo breve: +${livello} mana ogni 4 ore; riposo lungo: +${livello * 3} mana.</div>
                ${arcanoBonus ? `<div style="font-size:0.8rem; color:#7df9ff; margin-top:4px;">Arcano: +2 mana max e +1d4 rigenerati a riposo breve.</div>` : ''}
            </div>
            <div style="display:flex; flex-direction:column; gap:4px; justify-content:center; align-items:flex-end;">
                <button onclick="modificaMagicLevel(-1)" style="padding:6px 10px;">-</button>
                <div style="font-weight:bold; font-size:1.25rem;">LM ${livello}</div>
                <button onclick="modificaMagicLevel(1)" style="padding:6px 10px;">+</button>
            </div>
        </div>
        <div style="margin-top:10px; display:grid; gap:8px;">
            ${[0,1,2,3,4].map(lv => {
                const maxKnow = p.getMaxKnownSpells ? p.getMaxKnownSpells(lv) : 0;
                const current = p.spellsKnown && p.spellsKnown[lv] != null ? p.spellsKnown[lv] : 0;
                const levelName = lv === 0 ? 'Trucchetti' : `Incantesimi Lv${lv}`;
                return `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:8px 10px; border-radius:6px;">
                        <div>
                            <div style="font-weight:bold; color:#f1c40f;">${levelName}</div>
                            <div style="font-size:0.8rem; color:#aaa;">Massimo ${maxKnow} ${lv === 0 ? 'trucchetti' : 'incantesimi'}${maxKnow === 1 ? '' : ''}</div>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <button onclick="modificaIncantesimiConosciuti(${lv}, -1)" style="padding:4px 8px;">-</button>
                            <span style="width:26px; text-align:center; font-weight:bold;">${current}</span>
                            <button onclick="modificaIncantesimiConosciuti(${lv}, 1)" style="padding:4px 8px;">+</button>
                        </div>
                    </div>`;
            }).join('')}
        </div>
    `;
}

function getMagicLevelCost(livello) {
    const costi = [0, 1, 2, 3, 3, 4, 4, 5, 5, 6];
    return costi[Math.min(Math.max(0, livello), costi.length - 1)] || 0;
}

function modificaStat(stat, ammontare) {
    const p = window.tempP;
    if (!p) return;
    const chiave = stat.toLowerCase();
    const dettagliAttuali = p.getStatDettagliata ? p.getStatDettagliata(stat) : { valore: p[chiave], eccedenza: 0 };

    if (ammontare === 1) {
        const costo = p.calcolaCostoStat(p[chiave]);
        if (p.puntiCreazione >= costo && dettagliAttuali.valore < 20 && p[chiave] < 20) {
            p.puntiCreazione -= costo;
            p[chiave]++;
        }
    } else {
        // Se la statistica reale è superiore a 6 e quella base è maggiore di 1
        if (dettagliAttuali.valore > 6 && p[chiave] > 1) {
            
            // CONTROLLO ECCEDENZA:
            // Se c'è eccedenza (es. il totale teorico era 22), abbassiamo la statistica base
            // MA NON restituiamo punti creazione al giocatore (perché lo schermo mostrava già 20)
            if (dettagliAttuali.eccedenza > 0) {
                p[chiave]--; 
                // Nessun rimborso di punti creazione!
            } else {
                // Se non c'è eccedenza, scaliamo normalmente e rimborsiamo i punti
                p[chiave]--;
                p.puntiCreazione += p.calcolaCostoStat(p[chiave]);
            }
        }
    }
    renderSetupStats();
}

function generaHtmlStamina(p, idx) {
    let tacche = "";
    for(let i=0; i<p.staminaMax; i++) {
        const color = i < p.staminaAttuale ? "#3498db" : "#222";
        tacche += `<div style="flex:1; height:8px; background:${color}; border:1px solid #444; margin:1px;"></div>`;
    }
    return `
        <div style="margin-top:5px;">
            <div style="display:flex; justify-content:space-between; font-size:0.6em;">
                <span>STAMINA</span>
                <button onclick="riduciStaminaManual(${idx})" style="padding:0 4px; font-size:10px; background:none; color:red; border:1px solid red; cursor:pointer;">-1</button>
            </div>
            <div style="display:flex;">${tacche}</div>
        </div>
    `;
}

function riduciStaminaManual(idx) {
    if (party[idx].staminaAttuale > 0) {
        party[idx].staminaAttuale--;
        aggiornaInterfaccia();
    }
}


let categoriaCorrente = "competenze base";
let perkSearchQuery = "";
let perkFilterAffordableOnly = false;

// Questa viene chiamata ad ogni carattere inserito, ma NON rinfresca tutti i perk. Rinfresca solo i suggerimenti.
function gestisciDigitazionePerk(valore) {
    const query = valore.toLowerCase().trim();
    const boxSuggerimenti = document.getElementById('perk-suggestions-list');
    if (!boxSuggerimenti) return;

    if (query.length < 1) {
        boxSuggerimenti.innerHTML = "";
        return;
    }

    // Cerchiamo nel database i perk che iniziano o contengono le lettere digitate
    let trovati = [];
    for (let cat in DATABASE_PERK) {
        DATABASE_PERK[cat].forEach(p => {
            if (p.nome.toLowerCase().includes(query) && !trovati.includes(p.nome)) {
                trovati.push(p.nome);
            }
        });
    }

    // Generiamo i tag cliccabili di suggerimento
    if (trovati.length > 0) {
        boxSuggerimenti.innerHTML = `<div style="margin-top:5px; font-size:0.8rem; color:#aaa;">Forse cercavi: ` + 
            trovati.slice(0, 5).map(nome => 
                `<span onclick="cliccaSuggerimentoPerk('${nome}')" style="background:#333; color:#f1c40f; padding:2px 6px; margin-right:5px; border-radius:4px; cursor:pointer; display:inline-block; margin-bottom:4px;">${nome}</span>`
            ).join('') + `</div>`;
    } else {
        boxSuggerimenti.innerHTML = `<div style="margin-top:5px; font-size:0.8rem; color:#e74c3c;">Nessun perk corrispondente.</div>`;
    }
}

// Questa si attiva quando clicchi su un suggerimento giallo
function cliccaSuggerimentoPerk(nome) {
    perkSearchQuery = nome.toLowerCase().trim();
    const input = document.getElementById('perk-search-input');
    if (input) input.value = nome;
    document.getElementById('perk-suggestions-list').innerHTML = "";
    renderSetupPerks();
}

// Espone le funzioni chiamate dai pulsanti inline in index.html
window.passaTempoGlobale = passaTempoGlobale;
window.apriBiblioteca = apriBiblioteca;
window.ritiraTutti = ritiraTutti;
window.chiudiScheda = chiudiScheda;
window.gestisciDigitazionePerk = gestisciDigitazionePerk;
window.cliccaSuggerimentoPerk = cliccaSuggerimentoPerk;
window.eseguiRicercaPerkSuInvio = eseguiRicercaPerkSuInvio;
window.togglePerkAffordableOnly = togglePerkAffordableOnly;

// Questa viene chiamata SOLO quando l'utente preme il tasto INVIO
function eseguiRicercaPerkSuInvio(evento, valore) {
    if (evento.key === "Enter") {
        perkSearchQuery = valore.toLowerCase().trim();
        // Puliamo i suggerimenti visto che abbiamo avviato la ricerca ufficiale
        const boxSuggerimenti = document.getElementById('perk-suggestions-list');
        if (boxSuggerimenti) boxSuggerimenti.innerHTML = "";
        renderSetupPerks();
    }
}

function togglePerkAffordableOnly() {
    perkFilterAffordableOnly = !perkFilterAffordableOnly;
    renderSetupPerks();
}

function renderSetupPerks() {
    const container = document.getElementById('perks-setup-container');
    if (!container) return;

    const categoryOrder = [
        'background', 'competenze base', 'carisma e sociale', 'combattimento',
        'fisico e salute', 'Personalità e Fobie', 'magici', 'razziali', 'sopravvivenza', 'studio', 'medicina'
    ];

    const labelMap = {
        background: 'BACKGROUND',
        'competenze base': 'COMPETENZE BASE',
        'carisma e sociale': 'CARISMA E SOCIALE',
        combattimento: 'COMBATTIMENTO',
        'fisico e salute': 'FISICO E SALUTE',
        'Personalità e Fobie': 'PERSONALITÀ E FOBIE',
        magici: 'MAGICI',
        razziali: 'RAZZIALI',
        sopravvivenza: 'SOPRAVVIVENZA',
        studio: 'STUDIO',
        medicina: 'MEDICINA'
    };

    const searchQuery = perkSearchQuery;
    const scrollPos = container.scrollTop;

    const filterLabel = perkFilterAffordableOnly ? 'Mostra tutto' : 'Solo acquistabili';
    const filterStyle = perkFilterAffordableOnly ? 'background:#27ae60; color:#111;' : 'background:#222; color:#fff;';

    let html = `<div style="display:grid; gap:10px; max-height:70vh; overflow-y:auto; text-align:left; padding-right:6px;">
        <div style="margin-bottom:8px;">
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                <input id="perk-search-input" type="text" placeholder="Scrivi e premi INVIO per cercare..." value="${perkSearchQuery.replace(/"/g,'&quot;')}" 
                    oninput="gestisciDigitazionePerk(this.value)"
                    onkeydown="eseguiRicercaPerkSuInvio(event, this.value)"
                    style="flex:1; min-width:220px; padding:10px; background:#111; color:#fff; border:1px solid #333; border-radius:8px;">
                <button class="btn-big" style="padding:10px 12px; ${filterStyle} border:1px solid #333;" onclick="togglePerkAffordableOnly()">${filterLabel}</button>
            </div>
            <!-- Questo è il box dove compariranno i suggerimenti in tempo reale (Arrampicatore, Artigiano, ecc.) -->
            <div id="perk-suggestions-list"></div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">`

    // Pulsanti di navigazione categoria
    categoryOrder.forEach(cat => {
        if (!DATABASE_PERK[cat] || DATABASE_PERK[cat].length === 0) return;
        const active = cat === categoriaCorrente && !searchQuery ? 'background:#27ae60; color:#111;' : 'background:#222; color:#fff;';
        html += `<button class="btn-big" style="padding:8px 10px; font-size:0.8rem; ${active} border:1px solid #333;" onclick="cambiaCategoriaPerk('${cat}')">${labelMap[cat]}</button>`;
    });
    
    html += `</div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; color:#aaa; font-size:0.9rem; margin-bottom:10px;">
            <div>Categoria: <strong>${labelMap[categoriaCorrente] || categoriaCorrente}</strong></div>
            <div>Filtro: <strong>${perkFilterAffordableOnly ? 'Solo acquistabili' : 'Tutti'}</strong></div>
            ${searchQuery ? `<div>Ricerca: <strong>${searchQuery}</strong></div>` : ''}
        </div>`;

    const categoriesToRender = categoryOrder.filter(cat => {
        if (!DATABASE_PERK[cat] || DATABASE_PERK[cat].length === 0) return false;
        if (!searchQuery) return cat === categoriaCorrente;
        return DATABASE_PERK[cat].some(p => p.nome.toLowerCase().includes(searchQuery) || p.desc.toLowerCase().includes(searchQuery));
    });

    if (categoriesToRender.length === 0) {
        html += `<div style="padding:14px; background:#111; border:1px solid #333; border-radius:8px; color:#ddd;">Nessun perk trovato per questa ricerca o categoria.</div>`;
    }

    categoriesToRender.forEach(cat => {
        const categoryTitle = labelMap[cat] || cat.toUpperCase();
        const perks = DATABASE_PERK[cat].filter(p => {
            if (!searchQuery) return true;
            return p.nome.toLowerCase().includes(searchQuery) || p.desc.toLowerCase().includes(searchQuery);
        }).sort((a, b) => a.nome.localeCompare(b.nome));

        const filteredPerks = perks.filter(p => {
            if (!perkFilterAffordableOnly) return true;
            const costo = p.costo || 0;
            return costo <= tempP.puntiCreazione || costo <= 0;
        });

        if (!filteredPerks.length) return;

        html += `<div style="background:#111; border:1px solid #333; border-radius:8px; padding:12px;">
            <div style="font-size:0.95rem; margin-bottom:12px; color:#f1c40f; font-weight:bold;">${categoryTitle}</div>
            <div style="display:grid; gap:10px;">`;

        filteredPerks.forEach(p => {
            const selectedCount = getPerkCount(tempP, p.nome);
            const giaPreso = selectedCount > 0;
            const canAfford = p.costo <= 0 || tempP.puntiCreazione >= p.costo;
            const actionAddAllowed = canAfford;
            const actionRemoveAllowed = giaPreso && p.repeats;
            const costoHtml = `<span style="font-size:0.8rem; color:#aaa;">(${p.costo} PT)</span>`;
            const countBadge = p.repeats && selectedCount > 0 ? `<span style="margin-left:8px; font-size:0.75rem; color:#9b59b6;">x${selectedCount}</span>` : '';
            html += `<div class="stat-row" style="font-size:0.82rem; padding:12px; background:#161616; border:1px solid #222; border-radius:6px; display:flex; gap:12px; align-items:flex-start; justify-content:space-between;">
                    <div style="flex:1; text-align:left;">
                        <div style="font-weight:bold; color:#f1c40f; margin-bottom:6px;">${p.nome} ${costoHtml}${countBadge}</div>
                        <div style="color:#bbb; font-size:0.85rem; line-height:1.4;">${p.desc}</div>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <button onclick="togglePerk('${p.nome}')" 
                                style="padding:10px 14px !important; min-width:100px; background:#27ae60; color:#fff !important; border:none !important; border-radius:6px; opacity:${actionAddAllowed ? '1' : '0.45'}; cursor:${actionAddAllowed ? 'pointer' : 'not-allowed'};"
                                ${actionAddAllowed ? '' : 'disabled'}>
                            PRENDI
                        </button>
                        ${p.repeats ? `<button onclick="togglePerk('${p.nome}', true)" style="padding:10px 14px !important; min-width:100px; background:#c0392b; color:#fff !important; border:none !important; border-radius:6px; opacity:${actionRemoveAllowed ? '1' : '0.45'}; cursor:${actionRemoveAllowed ? 'pointer' : 'not-allowed'};" ${actionRemoveAllowed ? '' : 'disabled'}>RIMUOVI</button>` : `${giaPreso ? `<button onclick="togglePerk('${p.nome}')" style="padding:10px 14px !important; min-width:100px; background:#c0392b; color:#fff !important; border:none !important; border-radius:6px;">RIMUOVI</button>` : ''}`}
                    </div>
                </div>`;
        });

        html += `</div></div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
    container.scrollTop = scrollPos;
}

function lootOggettiMagici() {
    const trovati = { comuni: 0, nonComuni: 0, rari: 0, superRari: 0 };
    const roll = () => Math.random() * 100;

    if (roll() <= 32)   trovati.comuni = 1;
    if (roll() <= 16)   trovati.nonComuni = 1;
    if (roll() <= 8)    trovati.rari = 1;
    if (roll() <= 2.5)  trovati.superRari = 1;

    return trovati;
}

function cambiaCategoriaPerk(nuovaCat) {
    categoriaCorrente = nuovaCat;
    perkSearchQuery = "";  // Reset ricerca quando cambi categoria
    renderSetupPerks();
}

function findPerkData(nomePerk) {
    const targetName = getPerkBaseName(nomePerk);
    for (let cat in DATABASE_PERK) {
        const found = DATABASE_PERK[cat].find(p => getPerkBaseName(p.nome) === targetName);
        if (found) return found;
    }
    return null;
}

function togglePerk(nomePerk, forceRemove = false) {
    const perkDati = findPerkData(nomePerk);
    if (!perkDati) return;

    const selectedCount = getPerkCount(tempP, perkDati.nome);
    const isSelected = selectedCount > 0;
    const canAfford = perkDati.costo <= 0 || tempP.puntiCreazione >= perkDati.costo;
    const isRepeatable = Boolean(perkDati.repeats);
    const shouldRemove = forceRemove || (!isRepeatable && isSelected);

    if (shouldRemove && isSelected) {
        const index = tempP.perks.findIndex(pp => getPerkBaseName(perkObjectName(pp)) === getPerkBaseName(perkDati.nome));
        if (index === -1) return;
        tempP.perks.splice(index, 1);
        tempP.puntiCreazione += perkDati.costo;
    } else {
        if (perkDati.requires && !hasPerk(tempP, perkDati.requires)) {
            alert(`Devi scegliere prima ${perkDati.requires} per poter prendere ${perkDati.nome}.`);
            return;
        }

        if (perkDati.nome === 'Arti marziali') {
            const hasManiNude = tempP.perks.some(pp => getPerkBaseName(perkObjectName(pp)).startsWith('Mani nude'));
            if (!hasManiNude) {
                alert('Devi selezionare almeno Mani nude 1 prima di poter acquistare Arti marziali.');
                return;
            }
        }

        if (!canAfford) {
            alert('Punti insufficienti!');
            return;
        }

        if (nomePerk === 'Anziana') {
            const scelta = prompt("Sei un'Anziana! Scegli il tuo bonus di esperienza:\n1. +1 Saggezza e +1 Carisma\n2. +2 a Saggezza\n3. +2 a Carisma", "1");
            let nomeSpecifico = 'Anziana_Bilanciata';
            if (scelta === '2') nomeSpecifico = 'Anziana_Saggezza';
            if (scelta === '3') nomeSpecifico = 'Anziana_Carisma';
            tempP.perks.push({ ...perkDati, nome: nomeSpecifico });
        } else {
            tempP.perks.push({ ...perkDati });
        }

        tempP.puntiCreazione -= perkDati.costo;
    }

    const existingNames = tempP.perks.map(pp => getPerkBaseName(perkObjectName(pp)));
    let removedSomething = false;
    tempP.perks = tempP.perks.filter(pp => {
        const nomePulito = getPerkBaseName(perkObjectName(pp));
        if (pp.requires && !existingNames.includes(getPerkBaseName(pp.requires))) {
            removedSomething = true;
            return false;
        }

        if (nomePulito === 'Arti marziali') {
            const hasMani = existingNames.some(n => n.startsWith('Mani nude'));
            if (!hasMani) {
                removedSomething = true;
                return false;
            }
        }

        return true;
    });

    if (removedSomething) alert('Alcuni perk dipendenti sono stati rimossi perché mancava il prerequisito.');

    renderSetupStats();
    renderSetupPerks();
}

function apriScheda(idx) {
    const p = party[idx];
    const modal = document.getElementById('modal-scheda');
    const modalContent = modal.querySelector('.modal-content');
    
    modalContent.classList.add('scheda-dettagliata');

    // 1. Generazione 6 Quadratini Stats
    let statsHtml = `<div class="stats-grid-scheda">`;
    ["Forza", "Destrezza", "Costituzione", "Intelligenza", "Saggezza", "Carisma"].forEach(s => {
        const d = p.getStatDettagliata(s);
        const statusClass = d.mod >= 0 ? 'pos' : 'neg';
        
        statsHtml += `
            <div class="stat-card-mini">
                <div class="label">${d.nome}</div>
                <div class="mod-grande ${statusClass}">${d.mod >= 0 ? '+' : ''}${d.mod}</div>
                <div class="spiegazione-mod">
                    Base ${d.modBase >= 0 ? '+' : ''}${d.modBase}${d.info.length > 0 ? '<br>' + d.info.join('<br>') : ''}
                </div>
            </div>`;
    });
    statsHtml += `</div>`;

    const lingueHtml = `
        <div style="margin-top:14px; background:#111; padding:12px; border:1px solid #333; border-radius:6px; text-align:left;">
            <div style="font-weight:bold; color:#f1c40f; margin-bottom:6px;">LINGUE CONOSCIUTE</div>
            <div style="color:#eee; font-size:0.9rem;">${p.lingue.join(' • ')}</div>
        </div>`;

    statsHtml += lingueHtml;

    // 2. Generazione Colonna Effetti Attivi
    let effettiHtml = `
        <div class="timer-column" style="text-align:left; font-size:0.85rem; background:#111; padding:12px; border-left:2px solid #ff0000;">
            <h4 style="color:#ff0000; margin-top:0; border-bottom:1px solid #333; padding-bottom:5px;">EFFETTI ATTIVI</h4>`;
    
    const displayTimer = (icon, label, time, color) => {
        if (time > 0) effettiHtml += `<p style="margin:8px 0; color:${color};">${icon} <b>${label}</b><br><small style="color:#888;">Residuo: ${time.toFixed(1)}h</small></p>`;
    };

    displayTimer("🍖", "Ben Nutrito", p.timers.buffFame, "#2ecc71");
    displayTimer("💧", "Ben Idratato", p.timers.buffSete, "#2ecc71");
    displayTimer("🧠", "Ben Riposato", p.timers.buffSonno, "#2ecc71");
    displayTimer("🍞", "Appena Mangiato", p.timers.fameSoddisfatta, "#f1c40f");
    displayTimer("🥤", "Appena Idratato", p.timers.seteSoddisfatta, "#f1c40f");
    displayTimer("🛌", "Appena Svegliato", p.timers.sonnoSoddisfatto, "#f1c40f");

    if (Object.values(p.timers).every(v => v <= 0)) effettiHtml += `<p style="color:#555;">Nessun effetto</p>`;
    
    // Mostra stati alterati ricevuti dal server
    if (p.statiAlterati && p.statiAlterati.length > 0) {
        effettiHtml += `<h4 style="color:#f1c40f; margin-top:15px; border-bottom:1px solid #333; padding-bottom:5px;">STATI ALTERATI</h4>`;
        p.statiAlterati.forEach(s => {
            effettiHtml += `<div style="margin-bottom:8px; padding:5px; background:#222; border-left:2px solid #f1c40f;">
                <div style="font-weight:bold; color:#eee;">${s.nome || s.tipo}</div>
                <div style="font-size:0.75rem; color:#aaa;">${s.descrizione || ''}</div>
                <div style="font-size:0.7rem; color:#888;">${s.durata_minuti > 0 ? `Scadenza tra ${s.durata_minuti}m` : 'Permanente'}</div>
            </div>`;
        });
    }

    effettiHtml += `</div>`;

    // 3. Render Finale Layout a 3 Colonne
    modalContent.innerHTML = `
        <h2 style="color:#ff0000; border-bottom:2px solid #ff0000; padding-bottom:10px;">${p.nome.toUpperCase()}</h2>
        <div class="scheda-grid" style="display: grid; grid-template-columns: 320px 1fr 220px; gap: 20px;">
            ${statsHtml}
            <div class="bio-column" style="text-align:left;">
                ${p.isRobot ? `
                    <p>🤖 <b>PF Robotici:</b> ${p.robotPF} / ${p.robotPFMax} - <span style="color:${p.robotPF <= (p.robotPFMax*0.2) ? '#e74c3c' : '#f1c40f'}">${p.woundState}</span></p>
                    ${getBarra(p.robotPF, p.robotPFMax, '#c0392b')}
                    <p>🔋 <b>Batteria Arcana:</b> ${p.batteryHours.toFixed(1)}h / ${p.batteryHoursMax}h</p>
                ` : `
                    <p>❤️ <b>PF Reali:</b> ${p.puntiFeritaReali} / ${p.puntiFeritaRealiMax} - <span style="color:${p.puntiFeritaReali <= 2 ? '#e74c3c' : '#f1c40f'}">${p.woundState}</span></p>
                    ${getBarra(p.puntiFeritaReali, p.puntiFeritaRealiMax, '#c0392b')}
                    
                    ${p.woundState !== "Illeso" && p.puntiFeritaReali > 0 ? `
                        <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; margin-top: 5px; font-size: 0.8rem; border-left: 3px solid #e74c3c;">
                            
                            <div style="margin-bottom: 4px;">
                                <span style="color: #ffaa00;">⚠️ Peggioramento:</span> 
                                ${p.woundTreated ? 
                                    '<span style="color: #2ecc71;">Trattata (Timer sospeso)</span>' : 
                                    `<b>${p.woundTimer.toFixed(1)}h</b> alla forma più grave`}
                            </div>

                            <div>
                                <span style="color: #3498db;">🌱 Recupero Passivo:</span> 
                                ${(!p.inSpedizione && (!p.azioneCorrente || p.azioneCorrente.tipo !== 'esplora')) ? 
                                    `<b>${p.oreRiposoAccumulate.toFixed(1)}</b> / ${p.getOreNecessarieGuarigione()}h` : 
                                    '<span style="color: #888;">In pausa (In movimento)</span>'}
                            </div>
                            
                            <div style="font-size: 0.7rem; color: #888; margin-top: 4px; font-style: italic;">
                                ${p.woundState === "Ferita lieve" ? "Possibile autoguarigione (70%)" : "Richiede cure per non peggiorare."}
                            </div>
                        </div>
                    ` : ''}
                `}

                ${p.isRobot ? `
                    <p>🏅 <b>COMPETENZA:</b> <span style="color:#f1c40f">+${p.getBonusCompetenza()}</span></p>
                    <p>🔮 <b>MANA:</b> <span style="color:#9b59b6">${p.manaAttuale} / ${p.manaMax}</span> ${p.manaAttuale < 0 ? `<span style="color:#e74c3c;">(Overload -${Math.abs(p.manaAttuale)})</span>` : ''}</p>
                ` : `
                    <p>✨ <b>PF Fortuna:</b> ${p.puntiFortuna} / ${p.puntiFortunaMax}</p>
                    ${getBarra(p.puntiFortuna, p.puntiFortunaMax, '#f1c40f')}
                    <p style="font-size:0.85em; color:#aaa;">${p.woundEffectText}</p>
                    <p>🏅 <b>COMPETENZA:</b> <span style="color:#f1c40f">+${p.getBonusCompetenza()}</span></p>
                    <p>⚡ <b>STAMINA:</b> <span style="color:#3498db">${p.staminaAttuale} / ${p.staminaMax}</span></p>
                    <p>🔮 <b>MANA:</b> <span style="color:#9b59b6">${p.manaAttuale} / ${p.manaMax}</span> ${p.manaAttuale < 0 ? `<span style="color:#e74c3c;">(Overload -${Math.abs(p.manaAttuale)})</span>` : ''}</p>
                    <p style="font-size:0.85em; color:#aaa;">Caratteristica incantatore: <b>${p.getCastingAttribute ? p.getCastingAttribute() : 'N/A'}</b> (${p.getCastingModifier ? (p.getCastingModifier() >= 0 ? '+' : '') + p.getCastingModifier() : '0'})</p>
                    ${p.livelloMagia > 0 ? `<p style="font-size:0.85em; color:#eee;">Incantesimi conosciuti: ${Object.entries(p.spellsKnown || {}).filter(([lv, count]) => count > 0).map(([lv, count]) => lv === '0' ? `${count} trucchetti` : `${count} lv${lv}`).join(' • ') || 'Nessuno'}</p>` : ''}
                    <p>🏃 <b>FATICA TOTALE:</b> <span style="color:#e74c3c">${p.faticaTotale}</span></p>
                    <p style="font-size:0.75em; color:#888;">${p.malusFaticaDettagliati.join(" • ")}</p>
                `}
                ${(() => {
                    const pcaEntry = Object.entries(p.pca || {}).filter(([, v]) => v > 0);
                    if (!pcaEntry.length) return '';
                    return `<p style="margin-top:10px; font-size:0.85em; color:#aaa;"><b>PCA ARMI:</b></p>
                        <div style="font-size:0.85em; color:#2ecc71; background:#111; padding:8px; border-radius:4px;">
                            ${pcaEntry.map(([cat, val]) => `<div>${cat}: ${val.toFixed(1)}</div>`).join('')}
                        </div>`;
                })()}
                <hr style="border:0; border-top:1px solid #444; margin:15px 0;">
                
                <p style="font-size:0.85em; color:#aaa;"><b>COMPETENZE (LIVELLO 1):</b></p>
                <div style="font-size:0.85em; color:#eee; background:#111; padding:8px; border-radius:4px; margin-bottom:12px;">
                    ${(() => {
                        const allSkills = Object.keys(SKILL_SYSTEM.semantics);
                        const level1Skills = allSkills.filter(s => p.getSkillRating && p.getSkillRating(s) === 1);
                        return level1Skills.length > 0 ? level1Skills.join(' • ') : 'Nessuna';
                    })()}
                </div>
                
                <p style="font-size:0.85em; color:#aaa;"><b>LIVELLO MEDICINA:</b> ${p.livelloMedicina} • <b>PM MEDICINA:</b> ${p.pmMedicina}</p>
                ${(() => {
                    const entries = Object.entries(p.apprendimento || {}).filter(([, punti]) => punti > 0);
                    if (!entries.length) return '';
                    return `<div style="margin-top:12px; background:#111; padding:10px; border:1px solid #333; border-radius:6px;">
                        <div style="font-weight:bold; color:#f1c40f; margin-bottom:6px;">PROGRESSO STUDIO</div>
                        ${entries.map(([materia, punti]) => `<div style="font-size:0.85rem; margin-bottom:4px;"><strong>${materia}:</strong> ${punti}/210 punti</div>`).join('')}
                    </div>`;
                })()}
                
                <div style="margin-top:12px; display:flex; gap:8px; margin-bottom:12px;">
                    <div style="flex:1;">
                        <p style="font-size:0.85em; color:#aaa; margin-bottom:4px;"><b>SVANTAGGI (-1)</b></p>
                        <div style="background:#111; padding:8px; color:#ffaa00; min-height:40px; border-radius:4px; border: 1px solid #332200; font-size:0.85em;">
                            ${(() => {
                                const allSkills = Object.keys(SKILL_SYSTEM.semantics);
                                const neg = allSkills.filter(s => p.getSkillRating && p.getSkillRating(s) === -1);
                                return neg.length ? neg.join(' • ') : 'Nessuno';
                            })()}
                        </div>
                    </div>
                    <div style="flex:1;">
                        <p style="font-size:0.85em; color:#aaa; margin-bottom:4px;"><b>DISASTRI (-2)</b></p>
                        <div style="background:#111; padding:8px; color:#ff4444; min-height:40px; border-radius:4px; border: 1px solid #331111; font-size:0.85em;">
                            ${(() => {
                                const allSkills = Object.keys(SKILL_SYSTEM.semantics);
                                const neg2 = allSkills.filter(s => p.getSkillRating && p.getSkillRating(s) === -2);
                                return neg2.length ? neg2.join(' • ') : 'Nessuno';
                            })()}
                        </div>
                    </div>
                </div>
                
                <p style="font-size:0.85em; color:#aaa; margin-top:12px; margin-bottom:4px;"><b>MAESTRIE (LIVELLO 2):</b></p>
                <div style="font-size:0.85em; color:#eee; background:#111; padding:8px; text-align:left; border-radius:4px;">
                    ${(() => {
                        const allSkills = Object.keys(SKILL_SYSTEM.semantics);
                        const masters = allSkills.filter(s => p.getSkillRating && p.getSkillRating(s) === 2);
                        return masters.length ? masters.map(skill => {
                            const desc = SKILL_SYSTEM.masteryDescriptions[skill] || "Maestria acquisita (Nessuna descrizione presente).";
                            return `<div style="margin-bottom: 6px; border-bottom: 1px solid #222; padding-bottom: 4px;"><strong style="color:#ff9800;">⭐ ${skill}:</strong> <span style="color:#ccc;">${desc}</span></div>`;
                        }).join('') : 'Nessuna maestria di livello 2 acquisita.';
                    })()}
                </div>
            </div>
            ${effettiHtml}
        </div>
        <div class="modal-footer" style="margin-top:20px; display:flex; gap:10px;">
            <button class="btn-hero" style="flex:1;" onclick="visualizzaPerk(${party.indexOf(p)})">COMPETENZE/PERK</button>
            <button class="btn-hero" onclick="chiudiScheda()">CHIUDI</button>
        </div>
    `;

    modal.style.display = 'block';
}

function chiudiScheda() { document.getElementById('modal-scheda').style.display = 'none'; }

async function renderProposteMaster() {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.username !== 'Apocalix1') return;

    let panel = document.getElementById('master-proposte-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'master-proposte-panel';
        panel.style = "background:#2c3e50; padding:15px; margin:15px 0; border-radius:8px; border:2px solid #f1c40f;";
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen) gameScreen.insertBefore(panel, gameScreen.firstChild);
    }

    try {
        const response = await fetch(apiUrl('/api/proposals'), {
            headers: buildAuthHeaders()
        });
        const data = await response.json();
        const proposte = Array.isArray(data.proposals) ? data.proposals : [];

        if (!proposte.length) {
            panel.innerHTML = `<h3>👑 Pannello Master: Proposte</h3><p style="color:#eee;">Nessuna proposta di personaggio in attesa.</p>`;
            return;
        }

        let html = `<h3>👑 Pannello Master: Nuovi Sopravvissuti in Attesa (${proposte.length})</h3>`;
        proposte.forEach(prop => {
            const nome = prop.nome || prop.nomePersonaggio || 'Sconosciuto';
            const propostaDa = prop.propostoDa || prop.user_name || 'Sconosciuto';
            html += `
                <div style="background:#1a252f; padding:10px; margin-top:8px; display:flex; justify-content:space-between; align-items:center; border-radius:4px;">
                    <div>
                        <strong>${nome}</strong> proposto da <em>${propostaDa}</em>
                    </div>
                    <div>
                        <button class="btn-hero" style="background:#2ecc71;" onclick="approvaPersonaggio('${prop.id}', '${nome}')">APPROVA</button>
                        <button class="btn-hero" style="background:#e74c3c;" onclick="rifiutaPersonaggio('${prop.id}')">RIFIUTA</button>
                    </div>
                </div>`;
        });
        panel.innerHTML = html;
    } catch (e) {
        panel.innerHTML = `<p style="color:#e74c3c;">Errore nel caricamento delle proposte dal server.</p>`;
    }
}

async function approvaPersonaggio(id, nome) {
    try {
        const response = await fetch(apiUrl(`/api/proposals/${id}/decision`), {
            method: 'POST',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ decision: 'approved' })
        });
        if (response.ok) {
            alert(`${nome} è entrato ufficialmente nel gioco!`);
            renderProposteMaster();
            aggiornaInterfaccia();
        } else {
            const err = await response.json().catch(() => null);
            alert(err?.error || 'Errore durante l\'approvazione.');
        }
    } catch (e) {
        alert('Errore durante l\'approvazione.');
    }
}

async function rifiutaPersonaggio(id) {
    try {
        const response = await fetch(apiUrl(`/api/proposals/${id}/decision`), {
            method: 'POST',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ decision: 'rejected' })
        });
        if (response.ok) {
            alert('Proposta rifiutata.');
            renderProposteMaster();
        } else {
            const err = await response.json().catch(() => null);
            alert(err?.error || 'Errore durante il rifiuto.');
        }
    } catch (e) {
        alert('Errore durante il rifiuto.');
    }
}

document.addEventListener('click', (ev) => {
    const btn = ev.target.closest ? ev.target.closest('button') : null;
    if (!btn) return;
    if (btn.id === 'btn-player') return showPlayerAuth();
    if (btn.id === 'btn-master') return showMasterAuth();
    if (btn.id === 'btn-login') return loginUser();
    if (btn.id === 'btn-register') return registerUser();
    if (btn.id === 'btn-guest') return continueAsGuest();
});

window.onclick = function(event) {
    if (event.target.className === 'modal') {
        event.target.style.display = "none";
    }
}

window.renderProposteMaster = renderProposteMaster;
window.approvaPersonaggio = approvaPersonaggio;
window.rifiutaPersonaggio = rifiutaPersonaggio;
window.mostraNotificaInAlto = mostraNotificaInAlto;
window.apriScheda = apriScheda;
window.chiudiScheda = chiudiScheda;
window.apriAiutoModal = apriAiutoModal;
window.openRisorsaModal = openRisorsaModal;
window.apriMedica = apriMedica;
window.openCucinaModal = openCucinaModal;
window.annullaAssistente = annullaAssistente;
window.visualizzaPerk = visualizzaPerk;
window.openMagazzino = openMagazzino;
window.annullaCreazione = typeof annullaCreazione === 'function' ? annullaCreazione : (window.annullaCreazione || undefined);
window.avviaCreazione = typeof avviaCreazione === 'function' ? avviaCreazione : (window.avviaCreazione || undefined);
window.passaTempoGlobale = typeof passaTempoGlobale === 'function' ? passaTempoGlobale : (window.passaTempoGlobale || undefined);
window.apriBiblioteca = typeof apriBiblioteca === 'function' ? apriBiblioteca : (window.apriBiblioteca || undefined);
window.chiudiModal = chiudiModal;
window.renderCharacterList = renderCharacterList;
window.showLobbyScreen = showLobbyScreen;
window.aggiornaInterfaccia = aggiornaInterfaccia;
window.initUI = initUI;
window.modificaMagicLevel = typeof modificaMagicLevel === 'function' ? modificaMagicLevel : (window.modificaMagicLevel || undefined);
window.modificaIncantesimiConosciuti = typeof modificaIncantesimiConosciuti === 'function' ? modificaIncantesimiConosciuti : (window.modificaIncantesimiConosciuti || undefined);
window.confermaCreazione = typeof confermaCreazione === 'function' ? confermaCreazione : (window.confermaCreazione || undefined);

