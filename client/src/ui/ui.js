export { party };
import { magazzino, party as stateParty } from "../state.js";
import "../logic/studio.js";
import { Personaggio, salvaPersonaggioCloud, avviaAscoltoDatiCloud, fetchUserCharacters, apiUrl, buildAuthHeaders, refreshPartyListeners } from "../logic/logic.js";
import { processAutomaticActions} from "./cibo_e_acqua-ui.js";
import "../ui/magazzino-ui.js";
const party = stateParty;

// Esposizioni Globali per compatibilità con HTML inline e altri script non-modulari
window.showLobbyScreen = showLobbyScreen;
window.apriScheda = apriScheda;
window.chiudiModal = chiudiModal;
window.assistenzaSelezionata = null;
window.mostraNotificaInAlto = mostraNotificaInAlto;

const STATI_PREDEFINITI = {
    'Impaurito':   [{stat:'Intelligenza', valore:-2}, {stat:'Forza', valore:1}],
    'Indebolito':  [{stat:'Forza', valore:-2}, {stat:'Costituzione',valore:-1}],
    'Rallentato':  [{stat:'Destrezza', valore:-2}],
    'Confuso':     [{stat:'Intelligenza', valore:-1}, {stat:'Saggezza', valore:-2}],
    'Rinvigorito': [{stat:'Forza', valore:1}, {stat:'Costituzione', valore:1}],
    'Ispirato':    [{stat:'Carisma', valore:2}],
}

let tempP = null;

function chiudiModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

document.getElementById('overlay')?.addEventListener('click', function() {
    chiudiCimitero();
    chiudiSpedizione();
});

export async function showLobbyScreen(user) {
    if (user && user.role === 'master') {
        showGameScreen('Master');
        await caricaPartyMaster();
        apriPannelloMaster();
        avviaPollingPartyMaster();
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
    // Mostra subito le proposte in sospeso per questo utente
    renderProposte();
    // Polling per nuove proposte (opzionale)
    if (!window._propostePolling) {
        window._propostePolling = setInterval(() => {
            renderProposte();
        }, 500);
    }
}

// Nuove funzioni helper per la lobby
window.mandaInGiocoDaLobby = async function(nome) {
    const user = getCurrentUser();
    if (!user) return alert('Devi essere loggato.');

    // Controllo limite 2 personaggi per giocatore (non master)
    if (user.role !== 'master') {
        const viviUser = party.filter(p => p.user_id === user.id);
        if (viviUser.length >= 2) {
            return alert('Puoi avere massimo 2 personaggi in gioco alla volta.');
        }
    }

    const localDataRaw = localStorage.getItem(`personaggio_${encodeURIComponent(nome)}`);
    if (!localDataRaw) return alert('Dati locali non trovati.');
    try {
        const stats = JSON.parse(localDataRaw);
        const p = Object.assign(new Personaggio(stats.nome, stats.giornoInizio || 0), stats);
        
        // Se ha già un ID, proviamo PUT per evitare il limite di 2
        if (p.id) {
             const res = await fetch(apiUrl(`/api/personaggi/${p.id}`), {
                method: 'PUT',
                headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ data: JSON.stringify(p), status: 'vivo' })
            });
            if (res.ok) {
                alert(`✅ ${nome} è stato riattivato con successo!`);
                renderCharacterList();
                return;
            }
        }

        await salvaPersonaggioCloud(p);
        alert(`✅ ${nome} è stato mandato in gioco con successo!`);
        renderCharacterList();
    } catch (e) {
        alert('Errore: ' + e.message);
    }
};

window.depositaInStazioneMobile = function(idx, chiave, quantita) {
    const p = party[idx];
    if (!p || !hasPerk(p, 'Stazione mobile')) return alert('Non hai il perk Stazione mobile.');
    p.initStazioneMobile();
    if (p.stazioneMobileTotale + quantita > p.stazioneMobileCapacita) {
        return alert(`Capacità della stazione superata (max ${p.stazioneMobileCapacita}).`);
    }
    const disponibile = p.inventario[chiave] || 0;
    if (disponibile < quantita) return alert('Non hai abbastanza risorse nell\'inventario.');
    p.inventario[chiave] -= quantita;
    p.stazioneMobile[chiave] = (p.stazioneMobile[chiave] || 0) + quantita;
    salvaPersonaggioCloud(p);
    aggiornaInterfaccia();
};

window.ritiraDaStazioneMobile = function(idx, chiave, quantita) {
    const p = party[idx];
    if (!p) return;
    p.initStazioneMobile();
    const disponibile = p.stazioneMobile[chiave] || 0;
    if (disponibile < quantita) return alert('Non hai abbastanza risorse nella stazione mobile.');
    p.stazioneMobile[chiave] -= quantita;
    p.inventario[chiave] = (p.inventario[chiave] || 0) + quantita;
    salvaPersonaggioCloud(p);
    aggiornaInterfaccia();
};

window.entraInGiocoDaLobby = async function(nome, id) {
    const user = getCurrentUser();
    if (!user) return alert('Devi essere loggato.');

    // Controllo limite 2 personaggi per giocatore (non master)
    if (user.role !== 'master') {
        const viviUser = party.filter(p => p.user_id === user.id);
        if (viviUser.length >= 2) {
            return alert('Puoi avere massimo 2 personaggi in gioco alla volta.');
        }
    }

    try {
        const response = await fetch(apiUrl(`/api/personaggi/${id}`), { headers: buildAuthHeaders() });
        if (!response.ok) throw new Error('Personaggio non trovato');
        const data = await response.json();
        const pData = data.personaggio;
        if (!pData || pData.status === 'morto') {
            alert('Questo personaggio è morto e non può essere giocato.');
            return;
        }
        let stats = {};
        if (pData.data && typeof pData.data === 'object') stats = pData.data;
        else if (typeof pData.data === 'string') try { stats = JSON.parse(pData.data); } catch(e) {}
        const p = Object.assign(new Personaggio(stats.nome || pData.nome, stats.giornoInizio || 0), stats);
        p.id = pData.id;
        p.user_id = pData.user_id;
        p.ownerUsername = pData.owner_username || null;
        if (!party.some(x => x.nome === p.nome)) party.push(p);
        showGameScreen('Giocatore');
    } catch (e) {
        alert('Errore: ' + e.message);
    }
};

window.eliminaPersonaggioLobby = async function(nome, id, isActive) {
    if (!confirm(`Eliminare definitivamente "${nome}"? Azione irreversibile.`)) return;
    try {
        // Elimina dal server solo se l'ID è valido
        if (id && id !== 'null' && id !== 'undefined' && !isNaN(id)) {
            const res = await fetch(apiUrl(`/api/personaggi/${id}`), {
                method: 'DELETE',
                headers: buildAuthHeaders()
            });
            if (!res.ok) throw new Error('Errore eliminazione');
        }
        // Rimuovi da localStorage
        localStorage.removeItem(`personaggio_${encodeURIComponent(nome)}`);
        const user = getCurrentUser();
        if (user) {
            const key = `user_chars_${user.username}`;
            const arr = JSON.parse(localStorage.getItem(key) || '[]').filter(n => n !== nome);
            localStorage.setItem(key, JSON.stringify(arr));
        }
        // Rimuovi dal party (se presente)
        const idx = party.findIndex(p => p.nome === nome);
        if (idx !== -1) party.splice(idx, 1);
        mostraNotificaInAlto(`${nome} eliminato.`, 'successo');
        renderCharacterList();
        aggiornaInterfaccia();
    } catch (e) {
        alert('Errore: ' + e.message);
    }
};

function annullaCollaborazioniPersonaggio(personaggio) {
    const eraCollaboratore = (a) => a && (a.collaboratoreNome === personaggio.nome || a.teacherName === personaggio.nome);
    party.forEach(p => {
        if (p === personaggio) return;
        if (eraCollaboratore(p.azioneCorrente)) {
            mostraNotificaInAlto(`${p.nome}: azione annullata, il collaboratore ${personaggio.nome} è stato eliminato.`, 'avviso');
            p.azioneCorrente = (p.codaAzioni || []).shift() || null;
        }
        p.codaAzioni = (p.codaAzioni || []).filter(a => !eraCollaboratore(a));
    });

    // Rimborso risorse per l'azione che il personaggio eliminato stava svolgendo
    const az = personaggio.azioneCorrente;
    if (az?.tipo === 'alchimia' && az.costoMateriali) {
        magazzino.materialiAlchemici += az.costoMateriali;
        mostraNotificaInAlto(`Rimborsati ${az.costoMateriali} materiali alchemici (azione interrotta di ${personaggio.nome}).`, 'successo');
        window.updateMagazzinoFields?.({ materialiAlchemici: magazzino.materialiAlchemici });
    } else if (az?.tipo === 'cucina') {
        // NUOVO: rimborso cucina interrotta
        let cambiati = false;
        if (az.costoCibo) { magazzino.cibo += az.costoCibo; cambiati = true; }
        if (az.costoAcqua) { magazzino.acqua += az.costoAcqua; cambiati = true; }
        if (cambiati) {
            mostraNotificaInAlto(`Rimborsate risorse di cucina (azione interrotta di ${personaggio.nome}).`, 'successo');
            window.updateMagazzinoFields?.({ cibo: magazzino.cibo, acqua: magazzino.acqua });
        }
    } else if (az?.tipo === 'conserva' && az.costoMateriali) {
        // NUOVO: rimborso conserva interrotta
        magazzino.materialiAlchemici += az.costoMateriali;
        mostraNotificaInAlto(`Rimborsati ${az.costoMateriali} materiali alchemici (conserva interrotta di ${personaggio.nome}).`, 'successo');
        window.updateMagazzinoFields?.({ materialiAlchemici: magazzino.materialiAlchemici });
    }
}

export function inizializzaBottoniUI() {

    document.getElementById('lobby-btn-entra')?.addEventListener('click', () => {
        if (typeof window.entraInGioco === 'function') window.entraInGioco();
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

    document.getElementById("btn-annulla-creazione")?.addEventListener("click", () => {
        document.getElementById("modal-creazione").style.display = "none";
    });
}

// ⚠️ NIENT'ALTRO qui fuori. Nessuna chiamata a inizializzaBottoniUI() o initMobileModeToggle()
// a livello di modulo: devono girare UNA sola volta, dentro initUI(), quando il DOM è pronto.

let _uiInitialized = false;

function initUI() {
    if (_uiInitialized) return;
    _uiInitialized = true;

    if (typeof inizializzaBottoniUI === 'function') {
        inizializzaBottoniUI();
    }
    if (typeof window.initMobileModeToggle === 'function') {
        window.initMobileModeToggle();
    }

    document.getElementById('overlay')?.addEventListener('click', function() {
        if (typeof chiudiCimitero === 'function') chiudiCimitero();
        if (typeof chiudiSpedizione === 'function') chiudiSpedizione();
    });

    document.getElementById('btn-player')?.addEventListener('click', () => {
        if (typeof window.showPlayerAuth === 'function') window.showPlayerAuth();
    });
    document.getElementById('btn-master')?.addEventListener('click', () => {
        if (typeof window.showMasterAuth === 'function') window.showMasterAuth();
    });
    document.getElementById('btn-login')?.addEventListener('click', () => {
        if (typeof window.loginUser === 'function') window.loginUser();
    });
    document.getElementById('btn-register')?.addEventListener('click', () => {
        if (typeof window.registerUser === 'function') window.registerUser();
    });
    document.getElementById('btn-guest')?.addEventListener('click', () => {
        if (typeof window.continueAsGuest === 'function') window.continueAsGuest();
    });

    document.getElementById('lobby-btn-recluta')?.addEventListener('click', () => {
        if (typeof window.avviaCreazione === 'function') {
            window.avviaCreazione();
        } else {
            const modal = document.getElementById('modal-creazione');
            if (modal) modal.style.display = 'block';
        }
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

    if (typeof checkBackend === 'function') {
        checkBackend();
        setInterval(checkBackend, 10000);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
} else {
    initUI();
}
caricaProposte();
renderProposte();
window.passaTempoGlobale = window.passaTempoGlobale || (typeof passaTempoGlobale === 'function' ? passaTempoGlobale : undefined);

let oreTotali = 0;
window.oreTotali = 0;
let cimitero = [];
window.magazzino = magazzino;

function mostraNotificaInAlto(msg, tipo = 'info', targetUserId = null) {
    const user = getCurrentUser ? getCurrentUser() : window.currentUser;
    
    // Filtro notifiche: il master vede tutto, il giocatore vede solo le sue (o quelle globali se targetUserId è null)
    if (user && user.role !== 'master') {
        if (targetUserId !== null && user.id !== targetUserId) {
            return; // Notifica non destinata a questo utente
        }
    }

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

window.modificatoriCorrenti = [];

window.apriPannelloMaster = async function apriPannelloMaster() {
    const modal = document.getElementById('modal-master-panel');
    const content = document.getElementById('master-panel-content');
    if (!modal || !content) return;
    modal.style.display = 'block';

    const validCharacters = party.filter(p => p.id && !isNaN(p.id));
    const options = validCharacters.length > 0
        ? validCharacters.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')
        : '<option value="">Nessun personaggio valido disponibile</option>';
    const opzioniStatiPredefiniti = Object.keys(STATI_PREDEFINITI)
        .map(nome => `<option value="${nome}">${nome}</option>`).join('');

    content.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div style="border-right: 1px solid #333; padding-right: 20px;">
                <h3 style="color:#f1c40f;">📜 Invia Documento</h3>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 4px; color: #ccc;">Destinatario:</label>
                    <select id="master-doc-target" style="width:100%; background:#222; color:white; border:1px solid #444; padding:6px;">
                        <option value="" disabled selected>Seleziona destinatario...</option>
                        ${options}
                    </select>
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 4px; color: #ccc;">Titolo:</label>
                    <input type="text" id="master-doc-titolo" placeholder="Inserisci titolo" style="width: 100%; background: #222; color: white; border: 1px solid #444; padding: 6px;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 4px; color: #ccc;">Lingua:</label>
                    <select id="master-doc-lingua" style="width: 100%; background: #222; color: white; border: 1px solid #444; padding: 6px;">
                        <option value="Verbum">Verbum (Lingua comune)</option>
                        <option value="Yazyk">Yazyk (Lingua di Diefrost)</option>
                        <option value="Engenity">Engenity (Lingua di Engenia)</option>
                        <option value="Chrimil">Chrimil (Lingua di Chrimata)</option>
                        <option value="Ridulphi">Ridulphi (Lingua di Rodulphia)</option>
                        <option value="Antali">Antali (Lingua di Talassio)</option>
                        <option value="Puleun">Puleun (Lingua di Britannia/Greenhill)</option>
                        <option value="Eklesti">Eklesti (Lingua della Terra dei cieli)</option>
                        <option value="Meer">Meer (Lingua del Grande Blu)</option>
                    </select>
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 4px; color: #ccc;">Testo:</label>
                    <textarea id="master-doc-testo" rows="4" placeholder="Contenuto del documento..." style="width: 100%; background: #222; color: white; border: 1px solid #444; padding: 6px;"></textarea>
                </div>
                <button class="btn-hero" onclick="masterActionInvia()" style="width: 100%;">Invia Documento</button>
            </div>

            <div>
                <h3 style="color:#f1c40f;">⚙️ Applica Stato</h3>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 4px; color: #ccc;">Personaggio target:</label>
                    <select id="master-state-target" style="width: 100%; background: #222; color: white; border: 1px solid #444; padding: 6px;">
                        <option value="">Seleziona...</option>
                        ${options}
                    </select>
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 4px; color: #ccc;">Stato preimpostato:</label>
                    <select id="master-state-preset" style="width: 100%; background: #222; color: white; border: 1px solid #444; padding: 6px;" onchange="applicaPresetStato()">
                        ${opzioniStatiPredefiniti}
                    </select>
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 4px; color: #ccc;">Nome stato:</label>
                    <input type="text" id="master-state-nome" placeholder="Es. Impaurito" value="Impaurito" style="width: 100%; background: #222; color: white; border: 1px solid #444; padding: 6px;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 4px; color: #ccc;">Tipo:</label>
                    <select id="master-state-tipo" style="width: 100%; background: #222; color: white; border: 1px solid #444; padding: 6px;">
                        <option value="debuff">Debuff</option>
                        <option value="buff">Buff</option>
                        <option value="stato">Stato</option>
                    </select>
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 4px; color: #ccc;">Durata (minuti):</label>
                    <input type="number" id="master-state-durata" placeholder="0 = permanente" value="60" style="width: 100%; background: #222; color: white; border: 1px solid #444; padding: 6px;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 4px; color: #ccc;">Descrizione:</label>
                    <input type="text" id="master-state-desc" placeholder="Effetto dello stato..." style="width: 100%; background: #222; color: white; border: 1px solid #444; padding: 6px;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 6px; color: #ccc;">Modificatori alle statistiche:</label>
                    <div id="master-modificatori-list" style="display:grid; gap:6px; margin-bottom:8px;"></div>
                    <button class="btn-hero" style="width:100%; font-size:0.8rem; background:#2c3e50;" onclick="aggiungiModificatoreCustom()">+ Aggiungi modificatore</button>
                </div>
                <button class="btn-hero" onclick="masterActionStato()" style="width: 100%; margin-top:6px;">Applica Stato</button>
            </div>
        </div>

        <div style="margin-top:20px; border-top:1px solid #333; padding-top:10px;">
            <h3 style="color:#f1c40f;">🏚️ Magazzino</h3>
            <div id="master-magazzino-editor" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap:10px;"></div>
        </div>

        <div style="margin-top:20px; border-top:1px solid #333; padding-top:10px;">
            <h3 style="color:#f1c40f;">👥 Tutti i Personaggi</h3>
            <div id="master-all-chars" style="max-height:200px; overflow-y:auto; background:#111; padding:8px; border:1px solid #333; font-size:0.85rem;"></div>
        </div>

        <div style="margin-top:20px; border-top:1px solid #333; padding-top:10px;">
            <h3 style="color:#f1c40f;">🪦 Cimitero (gestione Master)</h3>
            <div id="master-cimitero-list" style="max-height:220px; overflow-y:auto; background:#111; padding:8px; border:1px solid #333; font-size:0.85rem;"></div>
        </div>

        <div style="margin-top:20px; border-top:1px solid #333; padding-top:10px;">
            <h3 style="color:#f1c40f;">🕐 Debug: Gestione Tempo (Giorno attuale: <span id="master-giorno-attuale">${Math.floor(oreTotali/24)}</span>)</h3>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <input type="number" id="master-set-giorno" min="0" placeholder="Vai al giorno..." style="width:140px; background:#222; color:white; border:1px solid #444; padding:6px;">
                <button class="btn-hero" onclick="masterImpostaGiorno()">Imposta Giorno</button>
                <button class="btn-hero" style="background:#c0392b;" onclick="masterRiduciGiorni(10)">-10 Giorni</button>
                <button class="btn-hero" style="background:#c0392b;" onclick="masterRiduciGiorni(50)">-50 Giorni</button>
                <button class="btn-hero" style="background:#c0392b;" onclick="masterRiduciGiorni(100)">-100 Giorni</button>
            </div>
        </div>
    `;

    // Cimitero: ora è vero codice JS eseguito DOPO l'assegnazione di innerHTML
    try {
        const dataCim = await fetch(apiUrl('/api/cimitero'), { headers: buildAuthHeaders() }).then(r => r.json());
        const listEl = document.getElementById('master-cimitero-list');
        if (listEl) {
            listEl.innerHTML = (dataCim.cimitero || []).map(c => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid #222;">
                    <span>💀 ${c.nome} ${c.data?.causaMorte ? `(${c.data.causaMorte})` : ''}</span>
                    <button onclick="eliminaDefinitivamenteCaduto(${c.id}, '${(c.nome || '').replace(/'/g, "\\'")}')" style="background:#c0392b !important; padding:3px 8px; font-size:0.75rem;">🗑️</button>
                </div>
            `).join('') || '<div style="color:#888;">Cimitero vuoto.</div>';
        }
    } catch (e) { console.warn('Errore caricamento cimitero master:', e); }

    window.modificatoriCorrenti = STATI_PREDEFINITI['Impaurito'].map(m => ({ ...m }));
    disegnaModificatori();
    renderMasterMagazzino();

    try {
        const data = await fetch(apiUrl('/api/characters?all=true'), { headers: buildAuthHeaders() }).then(r => r.json());
        if (data.characters) {
            document.getElementById('master-all-chars').innerHTML = data.characters.map(c => `
                <div style="padding:5px; border-bottom:1px solid #222;">
                    <strong>${c.nome}</strong> (${c.classe}) - User ID: ${c.user_id} - Stamina: ${c.stamina}
                </div>
            `).join('');
        }
    } catch (e) {
        document.getElementById('master-all-chars').innerText = "Errore caricamento personaggi.";
    }
};

window.apriRiorganizzaAzioni = function(idx) {
    let modal = document.getElementById('modal-riorganizza');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-riorganizza';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    renderRiorganizzaModal(idx);
    modal.style.display = 'block';
};

function renderRiorganizzaModal(idx) {
    const p = party[idx];
    const modal = document.getElementById('modal-riorganizza');
    const azioni = [];
    if (p.azioneCorrente) azioni.push({ ...p.azioneCorrente, corrente: true });
    (p.codaAzioni || []).forEach(a => azioni.push(a));

    let html = `<div class="modal-content" style="max-width:520px;">
        <h2 style="color:#f1c40f;">🔀 Riorganizza Azioni — ${p.nome}</h2>
        <div style="display:grid; gap:8px; text-align:left; margin:12px 0;">`;
    azioni.forEach((a, i) => {
        html += `<div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:8px; border:1px solid #333;">
            <span>${i === 0 ? '▶️ ' : ''}${a.tipo.toUpperCase()}${a.subject ? ' ' + a.subject : ''} (${a.oreRimanenti}h)${a.corrente ? ' <small style="color:#888;">(in corso)</small>' : ''}</span>
            <div style="display:flex; gap:4px;">
                <button ${i <= 1 ? 'disabled' : ''} onclick="window.spostaAzione(${idx}, ${i}, -1)">▲</button>
                <button ${i === 0 || i === azioni.length - 1 ? 'disabled' : ''} onclick="window.spostaAzione(${idx}, ${i}, 1)">▼</button>
            </div>
        </div>`;
    });
    html += `</div><div class="modal-footer"><button class="btn-big btn-cancel" onclick="chiudiModal('modal-riorganizza')">CHIUDI</button></div></div>`;
    modal.innerHTML = html;
}

window.spostaAzione = function(idx, posizione, direzione) {
    const p = party[idx];
    if (posizione === 0) return; // l'azione in corso resta fissa
    const codaIdx = posizione - 1;
    const nuovoIdx = codaIdx + direzione;
    if (nuovoIdx < 0 || nuovoIdx >= p.codaAzioni.length) return;
    [p.codaAzioni[codaIdx], p.codaAzioni[nuovoIdx]] = [p.codaAzioni[nuovoIdx], p.codaAzioni[codaIdx]];
    salvaPersonaggio(p);
    renderRiorganizzaModal(idx);
};

// --- Gestione preset + editor modificatori ---

const STATS_DISPONIBILI = ['Forza', 'Destrezza', 'Costituzione', 'Intelligenza', 'Saggezza', 'Carisma'];

window.applicaPresetStato = function() {
    const preset = document.getElementById('master-state-preset').value;
    const nomeInput = document.getElementById('master-state-nome');

    if (preset !== 'Personalizzato...' && nomeInput) {
        nomeInput.value = preset;
    }

    window.modificatoriCorrenti = (STATI_PREDEFINITI[preset] || []).map(m => ({ ...m }));
    disegnaModificatori();
};

window.aggiungiModificatoreCustom = function() {
    window.modificatoriCorrenti.push({ stat: 'Forza', valore: 0 });
    disegnaModificatori();
};

window.rimuoviModificatoreCustom = function(index) {
    window.modificatoriCorrenti.splice(index, 1);
    disegnaModificatori();
};

window.aggiornaModificatoreStat = function(index, nuovoStat) {
    if (window.modificatoriCorrenti[index]) {
        window.modificatoriCorrenti[index].stat = nuovoStat;
    }
};

window.aggiornaModificatoreValore = function(index, nuovoValore) {
    if (window.modificatoriCorrenti[index]) {
        window.modificatoriCorrenti[index].valore = parseInt(nuovoValore) || 0;
    }
};

function disegnaModificatori() {
    const cont = document.getElementById('master-modificatori-list');
    if (!cont) return;

    if (window.modificatoriCorrenti.length === 0) {
        cont.innerHTML = `<div style="color:#888; font-size:0.85rem; font-style:italic;">Nessun modificatore. Aggiungine uno per definire l'effetto dello stato.</div>`;
        return;
    }

    cont.innerHTML = window.modificatoriCorrenti.map((m, i) => `
        <div style="display:flex; gap:6px; align-items:center; background:#111; padding:6px; border:1px solid #333; border-radius:4px;">
            <select style="flex:1; background:#222; color:white; border:1px solid #444; padding:4px;"
                    onchange="aggiornaModificatoreStat(${i}, this.value)">
                ${STATS_DISPONIBILI.map(s => `<option value="${s}" ${s === m.stat ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
            <input type="number" value="${m.valore}" style="width:60px; background:#222; color:white; border:1px solid #444; padding:4px;"
                   onchange="aggiornaModificatoreValore(${i}, this.value)">
            <button onclick="rimuoviModificatoreCustom(${i})" style="padding:4px 8px; background:#c0392b !important; border:none !important;">✕</button>
        </div>
    `).join('');
}

window.disegnaModificatori = disegnaModificatori;

function hasPerk(personaggio, perk) {
    if (!personaggio) return false;
    if (Array.isArray(personaggio.perks)) {
        return personaggio.perks.some(p => (typeof p === 'string' ? p : p?.nome) === perk);
    }
    return false;
}
window.hasPerk = hasPerk;

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
    if (clean.startsWith("Anziana_")) return "Anziana";
    if (clean.startsWith("Lingue (")) return "Lingue";
    if (clean.startsWith("Ignorante (")) return "Ignorante";
    return clean;
}

function renderMasterMagazzino() {
    const container = document.getElementById('master-magazzino-editor');
    if (!container) return;

    const risorse = [
        { key: 'cibo', label: 'Cibo', step: 0.5 },
        { key: 'acqua', label: 'Acqua', step: 0.5 },
        { key: 'conserve', label: 'Conserve', step: 1 },
        { key: 'piattiDeliziosi', label: 'Piatti Deliziosi', step: 1 },
        { key: 'materialiAlchemici', label: 'Mat. Alchemici', step: 1 },
        { key: 'ingranaggi', label: 'Ingranaggi', step: 1 },
        { key: 'medici_base', label: 'Mat. Medici (Base)', step: 1 },
        { key: 'medici_avanzati', label: 'Mat. Medici (Avanzati)', step: 1 },
        { key: 'medici_critici', label: 'Mat. Medici (Critici)', step: 1 },
    ];

    // Blocco Postazione Alchemista: una sola volta, FUORI dal ciclo
    let html = `
        <div style="background:#111; padding:8px; border-radius:4px; display:flex; align-items:center; gap:8px; grid-column: 1 / -1;">
            <label style="flex:1; font-size:0.9rem; color:#ddd;">⚗️ Postazione da Alchimista</label>
            <span style="color:${magazzino.postazioneAlchemica ? '#2ecc71' : '#e74c3c'};">
                ${magazzino.postazioneAlchemica ? 'Presente' : 'Assente'}
            </span>
            <button class="btn-hero" onclick="masterTogglePostazioneAlchemica()" style="padding:4px 8px; font-size:0.8rem;">
                ${magazzino.postazioneAlchemica ? 'Rimuovi' : 'Aggiungi'}
            </button>
        </div>`;

    risorse.forEach(r => {
        let val = 0;
        if (r.key.startsWith('medici_')) {
            const tipo = r.key.replace('medici_', '');
            val = magazzino.materialiMedici?.[tipo] || 0;
        } else {
            val = magazzino[r.key] || 0;
        }
        html += `
            <div style="background:#111; padding:8px; border-radius:4px; display:flex; align-items:center; gap:8px;">
                <label style="flex:1; font-size:0.9rem; color:#ddd;">${r.label}</label>
                <input type="number" id="master-mag-${r.key}" value="${val}" step="${r.step}" style="width:70px; background:#222; color:white; border:1px solid #444; padding:4px;">
                <button class="btn-hero" onclick="masterSetMagazzino('${r.key}')" style="padding:4px 8px; font-size:0.8rem;">Imposta</button>
            </div>
        `;
    });
    container.innerHTML = html;
}

window.masterTogglePostazioneAlchemica = async function() {
    const nuovoStato = !magazzino.postazioneAlchemica;
    if (typeof window.updateMagazzinoFields === 'function') {
        await window.updateMagazzinoFields({ postazioneAlchemica: nuovoStato });
        magazzino.postazioneAlchemica = nuovoStato;
        renderMasterMagazzino();
        if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
    }
};

window.masterSetMagazzino = async function(key) {
    const input = document.getElementById(`master-mag-${key}`);
    if (!input) return;
    const val = parseFloat(input.value);
    if (isNaN(val) || val < 0) return;

    const fields = {};
    if (key.startsWith('medici_')) {
        const tipo = key.replace('medici_', '');
        const medici = { ...(magazzino.materialiMedici || {}) };
        medici[tipo] = val;
        fields.materialiMedici = medici;
    } else {
        fields[key] = val;
    }

    if (typeof window.updateMagazzinoFields === 'function') {
        await window.updateMagazzinoFields(fields);
        // Aggiorna il valore visualizzato
        const newVal = key.startsWith('medici_')
            ? magazzino.materialiMedici?.[key.replace('medici_', '')]
            : magazzino[key];
        input.value = newVal || 0;
        if (typeof renderMasterMagazzino === 'function') renderMasterMagazzino();
        if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
    } else {
        alert('Funzione updateMagazzinoFields non disponibile. Verifica che magazzino-ui.js sia caricato.');
    }
};

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

function getFoodEfficiency(p) {
    let scale = 1;
    if (hasPerk(p, 'Digiuno')) scale *= 1.2;
    if (hasPerk(p, 'Insaziabile')) scale *= 0.8;
    if (hasPerk(p, 'Sottopeso')) scale *= (1 / 1.1);
    if (hasPerk(p, 'Anoressico')) scale *= (1 / 1.2);
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

window._proposteInSospeso = new Map(); // key: idProposta, value: {mittente, destinatario, tipo, dati, scadenza}

// ========================= SISTEMA PROPOSTE =========================
window._proposte = window._proposte || [];

function salvaProposte() {
    try {
        localStorage.setItem('proposte', JSON.stringify(window._proposte));
    } catch(e) {}
}

function caricaProposte() {
    try {
        const data = localStorage.getItem('proposte');
        if (data) {
            const parsed = JSON.parse(data);
            const now = Date.now();
            window._proposte = parsed.filter(p => p.scade_il > now && p.stato === 'in_attesa');
        } else {
            window._proposte = [];
        }
    } catch(e) {
        window._proposte = [];
    }
}

function inviaProposta(mittenteId, destinatarioId, tipo, dati) {
    const mittente = party.find(p => p.id === mittenteId);
    const destinatario = party.find(p => p.id === destinatarioId);
    if (!mittente || !destinatario) {
        console.error('Personaggio mittente o destinatario non trovato.');
        return null;
    }

    const user = getCurrentUser();
    const stessoGiocatore = (mittente.user_id === destinatario.user_id) && (mittente.user_id === user?.id);
    const isMaster = user && user.role === 'master';

    const id = `prop-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const scade_il = Date.now() + 120000;

    const proposta = {
        id,
        mittenteId,
        destinatarioId,
        tipo,
        dati,
        stato: 'in_attesa',
        scade_il
    };

    window._proposte.push(proposta);
    salvaProposte();

    if (stessoGiocatore || isMaster) {
        accettaProposta(id);
    } else {
        const msg = `📨 Proposta da ${mittente.nome}: ${tipo}`;
        mostraNotificaInAlto(msg, 'info');
        renderProposte();
        setTimeout(() => {
            const prop = window._proposte.find(p => p.id === id);
            if (prop && prop.stato === 'in_attesa') {
                prop.stato = 'scaduta';
                salvaProposte();
                mostraNotificaInAlto(`⏰ Proposta "${tipo}" da ${mittente.nome} scaduta.`, 'avviso');
                renderProposte();
                setTimeout(() => {
                    const idx = window._proposte.indexOf(prop);
                    if (idx > -1) window._proposte.splice(idx, 1);
                    salvaProposte();
                }, 5000);
            }
        }, 120000);
    }

    return id;
}

function accettaProposta(id) {
    const prop = window._proposte.find(p => p.id === id);
    if (!prop) return;
    if (prop.stato !== 'in_attesa') {
        mostraNotificaInAlto('Proposta già gestita.', 'avviso');
        return;
    }

    prop.stato = 'accettata';
    salvaProposte();
    setTimeout(() => {
        const idx = window._proposte.indexOf(prop);
        if (idx > -1) window._proposte.splice(idx, 1);
        salvaProposte();
        renderProposte();
    }, 1000);

    eseguiAzioneProposta(prop);
}

function rifiutaProposta(id) {
    const prop = window._proposte.find(p => p.id === id);
    if (!prop) return;
    if (prop.stato !== 'in_attesa') {
        mostraNotificaInAlto('Proposta già gestita.', 'avviso');
        return;
    }

    prop.stato = 'rifiutata';
    const mittente = party.find(p => p.id === prop.mittenteId);
    mostraNotificaInAlto(`❌ Proposta rifiutata da ${mittente?.nome || 'sconosciuto'}.`, 'avviso');

    if (prop.tipo === 'artificeria-gruppo' && prop.dati.groupId) {
        const gruppo = window._artificeriaGruppiPendenti && window._artificeriaGruppiPendenti[prop.dati.groupId];
        if (gruppo && !gruppo.rifiutato) {
            gruppo.rifiutato = true;
            mostraNotificaInAlto(`⚠️ Gruppo di artificeria annullato: un collaboratore ha rifiutato.`, 'pericolo');
            delete window._artificeriaGruppiPendenti[prop.dati.groupId];
        }
    }

    salvaProposte();
    const idx = window._proposte.indexOf(prop);
    if (idx > -1) window._proposte.splice(idx, 1);
    salvaProposte();
    renderProposte();
}

function renderProposte() {
    let container = document.getElementById('proposte-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'proposte-container';
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style.right = '20px';
        container.style.width = '300px';
        container.style.maxHeight = '300px';
        container.style.overflowY = 'auto';
        container.style.backgroundColor = '#1a1a2e';
        container.style.border = '1px solid #444';
        container.style.borderRadius = '8px';
        container.style.padding = '10px';
        container.style.zIndex = '9999';
        container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.6)';
        container.style.display = 'none';
        document.body.appendChild(container);
    }

    const proposteInAttesa = window._proposte.filter(p => p.stato === 'in_attesa');
    if (proposteInAttesa.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    let html = `<div style="font-weight:bold; color:#f1c40f; margin-bottom:8px;">📨 Proposte in sospeso (${proposteInAttesa.length})</div>`;

    proposteInAttesa.forEach(prop => {
        const mittente = party.find(p => p.id === prop.mittenteId);
        const destinatario = party.find(p => p.id === prop.destinatarioId);
        const user = getCurrentUser();
        const isDestinatario = (destinatario && destinatario.user_id === user?.id);
        const isMaster = user && user.role === 'master';

        let azioni = '';
        if (isDestinatario || isMaster) {
            azioni = `
                <button onclick="accettaProposta('${prop.id}')" style="background:#27ae60; padding:4px 8px; border:none; border-radius:4px; color:white; cursor:pointer;">Accetta</button>
                <button onclick="rifiutaProposta('${prop.id}')" style="background:#c0392b; padding:4px 8px; border:none; border-radius:4px; color:white; cursor:pointer;">Rifiuta</button>
            `;
        } else {
            azioni = `<span style="color:#888;">In attesa di risposta...</span>`;
        }

        const tempoRimasto = Math.max(0, Math.round((prop.scade_il - Date.now()) / 1000));
        html += `
            <div style="background:#111; padding:8px; margin-bottom:6px; border-radius:4px; border-left:3px solid #f1c40f;">
                <div><strong>${mittente?.nome || '?'}</strong> → <strong>${destinatario?.nome || '?'}</strong></div>
                <div style="font-size:0.85rem; color:#ccc;">${prop.tipo} ${prop.dati?.nomeRicetta || ''} ${prop.dati?.ricettaId || ''}</div>
                <div style="font-size:0.75rem; color:#888;">Scade tra ${tempoRimasto}s</div>
                <div style="margin-top:4px; display:flex; gap:4px;">${azioni}</div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function eseguiAzioneProposta(prop) {
    const mittente = party.find(p => p.id === prop.mittenteId);
    const destinatario = party.find(p => p.id === prop.destinatarioId);

    if (!mittente || !destinatario) {
        console.error('Personaggi non trovati per l\'esecuzione della proposta.');
        return;
    }

    switch (prop.tipo) {
        case 'esplorazione':
            const compagni = prop.dati.compagni || [];
            if (!compagni.includes(destinatario.id)) {
                compagni.push(destinatario.id);
            }
            avviaEsplorazioneGruppo(mittente, compagni.map(id => party.find(p => p.id === id)).filter(Boolean), prop.dati.pericolo, prop.dati.pericoloIdx);
            break;

        case 'alchimia':
            avviaCreazione_AlchimiaConCollaboratore(mittente, destinatario, prop.dati.nomeRicetta, prop.dati.grado, prop.dati.cdEffettiva);
            break;

        case 'artificeria-gruppo': {
            const groupId = prop.dati.groupId;
            const gruppo = window._artificeriaGruppiPendenti && window._artificeriaGruppiPendenti[groupId];
            if (!gruppo || gruppo.rifiutato) break;

            gruppo.accettati.add(destinatario.id);
            const tuttiAccettati = gruppo.collaboratoriIds.every(id => gruppo.accettati.has(id));

            if (tuttiAccettati) {
                const leaderP = party.find(p => p.id === gruppo.leaderId);
                const collaboratoriIdxs = gruppo.collaboratoriIds
                    .map(id => party.findIndex(p => p.id === id))
                    .filter(i => i !== -1);
                const ricetta = window.getArtificerRecipeById(gruppo.ricettaId);
                if (leaderP && ricetta) {
                    window.eseguiCreazioneArtificeria(
                        leaderP, collaboratoriIdxs, ricetta,
                        gruppo.costoIngranaggi, gruppo.isSmontaggio, gruppo.dettagliExtra, gruppo.costoBase
                    );
                }
                delete window._artificeriaGruppiPendenti[groupId];
            } else {
                const mancanti = gruppo.collaboratoriIds.length - gruppo.accettati.size;
                mostraNotificaInAlto(`${destinatario.nome} ha accettato. In attesa di altri ${mancanti} collaboratori...`, 'info');
            }
            break;
        }

        case 'intrattieni': {
            if (!destinatario.azioneCorrente) {
                destinatario.azioneCorrente = {
                    tipo: 'intrattieni', oreTotali: 1, oreRimanenti: 1,
                    onComplete: () => {
                        const riduzione = rollDice(1, 4);
                        destinatario.follia = Math.max(0, destinatario.follia - riduzione);
                        mostraNotificaInAlto(`${destinatario.nome} si è distratto: Follia -${riduzione}.`, 'successo');
                        salvaPersonaggioCloud(destinatario);
                        aggiornaInterfaccia();
                    }
                };
                salvaPersonaggioCloud(destinatario);
                aggiornaInterfaccia();
            }
            break;
        }

        default:
            console.warn('Tipo di proposta non riconosciuto:', prop.tipo);
    }
}

function verificaProposteInSospeso() {
    const pending = window._proposte.filter(p => p.stato === 'in_attesa');
    if (pending.length > 0) {
        const nomi = pending.map(p => {
            const mitt = party.find(pp => pp.id === p.mittenteId);
            const dest = party.find(pp => pp.id === p.destinatarioId);
            return `${mitt?.nome || '?'} → ${dest?.nome || '?'} (${p.tipo})`;
        }).join('\n');
        alert(`⚠️ Ci sono ${pending.length} proposte in sospeso:\n${nomi}\n\nAttendi che vengano gestite prima di avanzare il tempo.`);
        return false;
    }
    return true;
}

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

window._proposteInSospeso = new Map(); // key: idProposta, value: {mittente, destinatario, tipo, dati, scadenza}

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
    const user = getCurrentUser();
    if (!user || user.role !== 'master') {
        alert('Solo il Master può far avanzare il tempo.');
        return;
    }
    console.log('[ATTENDI] ruolo utente:', user.role, '| proposte pendenti:', window._proposte.filter(p=>p.stato==='in_attesa').length);
    if (!verificaProposteInSospeso()) {
        return;
    }

    let oreInput = prompt("Quante ore vuoi far passare nel mondo?", "1");
    let ore = parseInt(oreInput);
    if (isNaN(ore) || ore <= 0) return;

    const giornoPrecedente = Math.floor(oreTotali / 24);
    oreTotali += ore;
    window.oreTotali = oreTotali;
    if (typeof window.updateMagazzinoFields === 'function') {
        window.updateMagazzinoFields({ oreTotali });
    }
    const giornoAttuale = Math.floor(oreTotali / 24);

    // Frigorifero
    const haFrigo = magazzino.congegniFissi.some(c => c.nome === 'Frigorifero');
    const scortaProtetta = haFrigo ? Math.min(50, magazzino.cibo) : 0;
    const ciboEsposto = Math.max(0, magazzino.cibo - scortaProtetta);
    const probDegrado = haFrigo ? 0.25 / 6 : 0.25;

    for (let giorno = giornoPrecedente + 1; giorno <= giornoAttuale; giorno++) {
        if (ciboEsposto > 0 && Math.random() < probDegrado) {
            const perduto = Math.min(ciboEsposto, rollDice(1, 6));
            let ciboPersoDefinitivo = perduto;

            if (magazzino.conserve > 0) {
                const ridotto = perduto / 2;
                magazzino.conserve = Math.max(0, magazzino.conserve - 1);
                magazzino.cibo = Math.max(0, magazzino.cibo - ridotto);
                ciboPersoDefinitivo = ridotto;
                alert(`Una conserva ha ridotto il degrado: perso solo ${ridotto.toFixed(1)} cibo, consumata 1 conserva.`);
            } else {
                magazzino.cibo = Math.max(0, magazzino.cibo - perduto);
                alert(`Attenzione: il cibo è andato a male o è stato mangiato da animali! Perduti ${perduto.toFixed(1)} unità di cibo.`);
            }

            const generatoAvariato = ciboPersoDefinitivo * 0.5;
            magazzino.ciboAvariato += generatoAvariato;
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

    if (haFrigo) {
        if (magazzino.batterie >= 2) {
            magazzino.batterie -= 2;
        } else {
            alert('⚠️ Frigorifero senza batterie – si è spento!');
        }
    }

    for (let i = party.length - 1; i >= 0; i--) {
        const p = party[i];
        if (typeof p.resetDailyStudy === 'function') p.resetDailyStudy(oreTotali);
        const causaMorte = (typeof p.tickOre === 'function') ? p.tickOre(ore) : null;
        if (causaMorte) {
            // Annulla esplorazione per i compagni
            annullaEsplorazionePerMorte(p);

            const giorniSopravvissuto = giornoAttuale - (p.giornoInizio || 0);
            p.causaMorte = causaMorte;
            p.giorniSopravvissuto = giorniSopravvissuto;
            p.giornoMorte = giornoAttuale;

            fetch(apiUrl(`/api/personaggi/${p.id}`), {
                method: 'PUT',
                headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ data: JSON.stringify(p), status: 'morto' })
            }).catch(err => console.warn('Errore salvataggio morte:', err));

            alert(`CONDOGLIANZE: ${p.nome} è morto per ${causaMorte}.`);
            party.splice(i, 1);
            if (typeof chiudiScheda === 'function') chiudiScheda();
        } else {
            processAutomaticActions(p);
        }
    }
    aggiornaInterfaccia();
}

// --- AGGIORNAMENTO INTERFACCIA PRINCIPALE ---
window.aggiungiPersonaggioAlParty = function(p) {
    if (!p) return;
    // Evita duplicati
    if (!party.some(char => char.id === p.id)) {
        party.push(p);
        aggiornaInterfaccia();
    }
};

export function aggiornaInterfaccia() {
    window.aggiornaInterfaccia = aggiornaInterfaccia;
    if (window._isUpdatingUI) return;
    window._isUpdatingUI = true;
    try {
        // Controllo morte immediato
        party.forEach((p, i) => {
            if (p.puntiFeritaReali <= 0 && !p.isRobot) {
                p.causaMorte = p.causaMorte || "emorragia";
                const giornoAttuale = Math.floor(oreTotali / 24);
                p.giorniSopravvissuto = giornoAttuale - (p.giornoInizio || 0);
                p.giornoMorte = giornoAttuale;
                
                // Notifica server
                fetch(apiUrl(`/api/personaggi/${p.id}`), {
                    method: 'PUT',
                    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ data: JSON.stringify(p), status: 'morto' })
                }).catch(err => console.warn('Errore salvataggio morte automatica:', err));

                alert(`NOTIZIA ESALATA: ${p.nome} è deceduto per ${p.causaMorte}.`);
                party.splice(i, 1);
                try {
                    const modal = document.getElementById('modal-scheda');
                    if (modal && modal.style.display === 'block') {
                        // Verifica se la scheda aperta è quella del morto
                        const h2 = modal.querySelector('h2');
                        if (h2 && h2.innerText.toLowerCase() === p.nome.toLowerCase()) {
                            chiudiScheda();
                        }
                    }
                } catch (e) {}
                if (typeof chiudiScheda === 'function') chiudiScheda();
            } else if (p.isRobot && p.robotPF <= 0) {
                 // Logica robot distrutto se necessaria
            }
        });

        if (typeof window.oreTotali === 'number' && window.oreTotali > oreTotali) {
            oreTotali = window.oreTotali;
        }
        const giornoAttuale = Math.floor(oreTotali / 24);
        const oraAttuale = Math.floor(oreTotali % 24);
        // Aggiornamento display magazzino
        document.getElementById('display-giorno').innerText = giornoAttuale;
        document.getElementById('display-ora').innerText = `${oraAttuale < 10 ? '0' : ''}${oraAttuale}:00`;
        document.getElementById('display-cibo').innerText = (magazzino.cibo || 0).toFixed(1);
        const conserveDisplay = document.getElementById('display-conserve');
        if (conserveDisplay) conserveDisplay.innerText = magazzino.conserve || 0;
        const deliziosiDisplay = document.getElementById('display-piatti-deliziosi');
        if (deliziosiDisplay) deliziosiDisplay.innerText = magazzino.piattiDeliziosi || 0;
        const ciboAvariatoDisplay = document.getElementById('display-cibo-avariato');
        if (ciboAvariatoDisplay) ciboAvariatoDisplay.innerText = (magazzino.ciboAvariato || 0).toFixed(1);
        document.getElementById('display-acqua').innerText = (magazzino.acqua || 0).toFixed(1);
        document.getElementById('display-alchemici').innerText = magazzino.materialiAlchemici || 0;
        document.getElementById('display-ingranaggi').innerText = magazzino.ingranaggi || 0;
        document.getElementById('display-medici-base').innerText = (magazzino.materialiMedici || {}).base || 0;
        document.getElementById('display-medici-avanzati').innerText = (magazzino.materialiMedici || {}).avanzati || 0;
        document.getElementById('display-medici-critici').innerText = (magazzino.materialiMedici || {}).critici || 0;

        const container = document.getElementById('party-container');
        container.innerHTML = "";

        // Barra assistenza (invariata)
        const assistStatus = window.assistenzaSelezionata ?
            `<div style="margin-bottom:12px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                <button class="btn-hero" onclick="apriAiutoModal()">🤝 Aiuta qualcuno</button>
                <div style="flex:1; min-width:220px; color:#f1c40f;">Assistente selezionato: <strong>${party[assistenzaSelezionata.idx]?.nome || 'Nessuno'}</strong> per <strong>${assistenzaSelezionata.tipo}</strong></div>
                <button class="btn-big" style="background:#c0392b;" onclick="annullaAssistente()">Annulla assistenza</button>
            </div>` :
            `<div style="margin-bottom:12px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                <button class="btn-hero" onclick="apriAiutoModal()">🤝 Aiuta qualcuno</button>
            </div>`;
        container.innerHTML = assistStatus;

        // Applica effetti dei perk
        party.forEach(papply => { if (typeof applyPerkEffects === 'function') applyPerkEffects(papply); });

        // Determina ruolo utente
        const user = getCurrentUser();
        const isMaster = user && user.role === 'master';
        const isGuest = window.guestMode || (user && user.role === 'ospite');

        party.forEach((p, idx) => {
            const isOwner = user && p.user_id === user.id;
            const canView = true; // Tutti possono vedere la card
            const canSeeStats = isMaster || isOwner; // Solo master o proprietario vedono le barre
            const canManage = isMaster || isOwner;            // può eseguire azioni

            const repairPotential = p.isRobot ? Math.max(0, (p.robotRepairTotalLimit || 50) - (p.robotRepairTotalDone || 0)) : 0;
            let barsHtml = "";
            if (!canSeeStats) {
                barsHtml = `<div style="font-size:0.8rem; color:#666; font-style:italic;">Statistiche protette</div>`;
            } else if (p.isRobot) {
                barsHtml = `
                    <div style="font-size:0.72em; color:#f1c40f; margin-top:4px; line-height:1.4;">
                        <div>🤖 PF Robotici: ${p.robotPF} / ${p.robotPFMax}</div>
                        <div>🔋 Batteria Arcana: ${Number(p.batteryHours || 0).toFixed(1)}h / ${Number(p.batteryHoursMax || 0).toFixed(0)}h</div>
                        <div>🛠️ Riparazioni residue: ${repairPotential} PF</div>
                    </div>
                `;
            } else {
                const risorse = [
                    { label: "Fame", attuale: p.fame, max: 14 },
                    { label: "Sete", attuale: p.sete, max: 4 },
                    { label: "Sonno", attuale: p.sonno, max: 8 },
                    { label: "Stamina", attuale: p.staminaAttuale ?? 0, max: p.staminaMax ?? 10, color: "#f1c40f" }
                ];
                if (isMaster) {
                    risorse.push({ label: "Follia", attuale: p.follia || 0, max: 20, color: "#3498db" });
                }
                risorse.forEach(r => {
                    let taccheHtml = "";
                    const colore = r.color || getColoreBarra((r.attuale / r.max) * 100);
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
            }

            // Stato azione
            let statoAzione = "In attesa";
            if (p.inSpedizione) statoAzione = "<span style='color:#3498db'>🚚 IN SPEDIZIONE</span>";
            else if (p.azioneCorrente) statoAzione = `<span style='color:#f1c40f'>🔨 ${p.azioneCorrente.tipo.toUpperCase()} (${p.azioneCorrente.oreRimanenti}h)</span>`;

            let card = document.createElement('div');
            card.className = `card-personaggio ${p.inSpedizione ? 'spedizione-active' : ''}`;

            // Header: nome + badge fatica (solo se canManage)
            let headerHtml = `
                <div class="card-header" style="position:relative;">
                    <h3 style="margin:0">${p.nome}</h3>
                    <div style="font-size:0.75em; color:#aaa;">👤 ${p.ownerUsername || 'Sconosciuto'}</div>
                    ${canManage ? `<span class="fatica-badge">Fatic. ${p.faticaTotale}</span>` : ''}
                    ${isMaster ? `<button onclick="masterEliminaPersonaggio(${idx})" title="Elimina personaggio"
                        style="position:absolute; top:0; right:0; background:#c0392b !important; border:1px solid #c0392b !important; padding:4px 8px; font-size:0.75rem;">🗑️</button>` : ''}
                </div>
            `;

            let detailsHtml = '';

            if (canView) {
                const showFullDetails = canManage;

                detailsHtml = `
                    ${showFullDetails ? (p.isRobot ? `
                        <div style="font-size:0.8em; margin-bottom:4px;">
                            <strong>PF Robotici:</strong> ${p.robotPF} / ${p.robotPFMax} - ${p.woundState}
                        </div>
                        ${getBarra(p.robotPF, p.robotPFMax, '#c0392b')}
                        <div style="font-size:0.75em; margin-bottom:6px; color:#aaa;">🔋 Batteria Arcana: ${Number(p.batteryHours || 0).toFixed(1)}h / ${Number(p.batteryHoursMax || 0).toFixed(0)}h</div>
                        <div style="font-size:0.75em; margin-bottom:10px; color:#aaa;">🛠️ Riparazioni residue: ${Math.max(0, (p.robotRepairTotalLimit || 50) - (p.robotRepairTotalDone || 0))} PF</div>
                    ` : `
                        <div style="font-size:0.75em; margin-bottom:6px; color:#aaa;">🏃 Velocità: ${p.velocitaAttuale}m</div>
                        <div style="font-size:0.8em; margin-bottom:4px;">
                            <strong>PF Reali:</strong> ${p.puntiFeritaReali} / ${p.puntiFeritaRealiMax} - ${p.woundState}
                        </div>
                        ${getBarra(p.puntiFeritaReali, p.puntiFeritaRealiMax, '#c0392b')}
                        <div style="font-size:0.75em; margin-bottom:10px; color:#aaa;">${p.woundEffectText}</div>
                    `) : `
                        <div style="font-size:0.75em; color:#aaa; margin-bottom:6px;">Azione attuale: <b>${statoAzione}</b></div>
                        <div style="font-size:0.72em; color:#777; font-style:italic;">Dati sensibili nascosti.</div>
                    `}
                    ${showFullDetails ? `
                        <div style="font-size:0.7em; margin-bottom:10px;">Stato: <b>${statoAzione}</b></div>
                        <button onclick="apriRiorganizzaAzioni(${idx})" style="width:100%; margin-top:6px; font-size:0.8rem;">🔀 Riorganizza azioni</button>
                        <div class="mini-bars-container">${barsHtml}</div>
                    ` : ''}
                `;

                if (canManage) {
                    const canUseStudyAction = !p.isRobot && (hasPerk(p, 'Insegnante') || hasPerk(p, 'Studio in compagnia') || hasPerk(p, 'Enciclopedia'));
                    const canUseTrainingAction = !p.isRobot && (hasPerk(p, 'Allenatore') || hasPerk(p, 'Combattente'));
                    const canUseMedicalAction = !p.isRobot && (hasPerk(p, 'Medicina Livello 1') || hasPerk(p, 'Primo soccorso') || hasPerk(p, 'Medico') || (p.livelloMedicina || 0) >= 1);
                    const canUseDecipherAction = (hasPerk(p, 'Traduttore') || hasPerk(p, 'Lingue'));

                    // --- Pulsanti di azione (solo per proprietario/master) ---
                    detailsHtml += `
                        <div style="display:flex; gap:4px; margin-bottom:10px;">
                            <button class="btn-big" style="flex:1; background:#8e44ad;" onclick="apriDocumentiPersonaggio(${idx})">📜 Doc</button>
                            <button class="btn-big" style="flex:1; background:#2980b9;" onclick="apriStatiPersonaggio(${idx})">✨ Stati</button>
                            <button class="btn-big guest-allow" style="flex:1; background:#16a085;" onclick="apriInventario(${idx})">🎒 Inventario</button>
                        </div>
                        <button onclick="apriScheda(${idx})" style="width:100%; margin-bottom:10px;">Visualizza Scheda</button>
                        <div class="action-dropdowns" style="margin-top: 12px; display:grid; gap:6px;">
                            <details class="action-dropdown">
                                <summary>SOPRAVVIVI</summary>
                                <div class="dropdown-buttons">
                                    ${p.isRobot ? `
                                            <button onclick="assorbiMagia(${idx})">Assorbi</button>
                                        ` : `
                                            ${hasPerk(p, 'Modalità riposo') ? `<button onclick="attivaModalitaRiposo(${idx})">💤 Modalità Riposo</button>` : ''}
                                            <button onclick="openRisorsaModal(${idx}, 'fame')">Nutri</button>
                                            <button onclick="openRisorsaModal(${idx}, 'sete')">Bevi</button>
                                            <button onclick="openRisorsaModal(${idx}, 'sonno')">Dormi</button>
                                            ${hasPerk(p, 'Artista') ? `<button onclick="apriIntrattieniModal(${idx})">🎭 Intrattieni</button>` : ''}
                                            ${user && user.role === 'master' ? `<button onclick="apriAumentaFollia(${idx})" style="background:#c0392b; color:white;">🧠 Aumenta Follia</button>` : ''}
                                            ${user && user.role === 'master' && hasPerk(p, 'Pessimista') ? `<button onclick="gestisciPessimista(${idx})" style="background:#7f8c8d; color:white;">😔 Pessimista</button>` : ''}
                                            ${user && user.role === 'master' && hasPerk(p, 'Ossessione del Pulito') ? `<button onclick="bloccaPulizia(${idx})" style="background:#c0392b; color:white;">🧹 Blocca Pulizia</button>` : ''}
                                            ${hasPerk(p, 'Asmatico') ? `<button onclick="usaRecuperoAsmaticoPersonaggio(${idx})" style="background:#16a085 !important; color:white !important;">🫁 Recupero Rapido</button>` : ''}
                                            ${user && user.role === 'master' && hasPerk(p, 'Rancoroso') ? `<button onclick="apriImpostaRancore(${idx})" style="background:#8e44ad; color:white;">😠 Imposta Rancore</button>` : ''}
                                            ${user && user.role === 'master' && hasPerk(p, 'CroceRossina') ? `<button onclick="gestisciCroceRossina(${idx})" style="background:#c0392b; color:white;">💉 Sensi di Colpa</button>` : ''}
                                            ${user && user.role === 'master' ? `<button onclick="riduciStaminaManual(${idx})" style="background:#d35400; color:white;">⚡ Consuma Stamina</button>` : ''}
                                            <button onclick="apriMedica(${idx})" ${canUseMedicalAction ? '' : 'disabled'}>🩹 Medica</button>
                                            <button onclick="apriDiagnosiMalattia(${idx})">🩺 Diagnostica</button>
                                            <button onclick="apriCuraMalattia(${idx})">💊 Cura</button>
                                            ${p.diabeteTipoII ? `<button onclick="usaInsulinaPersonaggio(${idx})" style="background:#16a085 !important; color:white !important;">💉 Insulina (${(p.diabeteTimer/24).toFixed(1)}g)</button>` : ''}
                                        `}
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
                                        <button onclick="apriDecifra(${idx})">🔤 Decifra</button>
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
                    // --- Visualizzazione ospite: solo lettura ---
                    detailsHtml += `
                        <div style="text-align:center; color:#888; font-style:italic; padding:8px 0;">
                            👁️ Visualizzazione in sola lettura – azioni non disponibili
                        </div>
                    `;
                }
            } else {
                // Caso limite (utente non autorizzato)
                detailsHtml = `
                    <div style="padding: 20px; text-align: center; color: #666; font-style: italic;">
                        Statistiche e azioni riservate al proprietario
                    </div>
                    <div style="font-size:0.7em; margin-top:10px; text-align:center;">Stato: <b>${p.inSpedizione ? 'In Spedizione' : 'In Rifugio'}</b></div>
                `;
            }

            card.innerHTML = headerHtml + detailsHtml;
            container.appendChild(card);
        });

        if (typeof window.renderCimitero === 'function') window.renderCimitero();
        autoSaveParty();
    } finally {
        window._isUpdatingUI = false;
    }
};

window.apriIntrattieniModal = function(idx) {
    const leader = party[idx];
    if (!leader || !leader.hasPerk('Artista')) return;
    const candidati = party.filter((p, i) => i !== idx && !p.inSpedizione && !p.azioneCorrente);
    if (candidati.length === 0) { alert('Nessuno è libero per essere intrattenuto ora.'); return; }

    // Il leader inizia subito la sua parte
    leader.azioneCorrente = {
        tipo: 'intrattieni', oreTotali: 1, oreRimanenti: 1,
        onComplete: () => {
            const riduzione = rollDice(1, 4);
            leader.follia = Math.max(0, leader.follia - riduzione);
            mostraNotificaInAlto(`${leader.nome} si è distratto: Follia -${riduzione}.`, 'successo');
            salvaPersonaggioCloud(leader);
            aggiornaInterfaccia();
        }
    };
    salvaPersonaggioCloud(leader);

    candidati.forEach(dest => window.inviaProposta(leader.id, dest.id, 'intrattieni', {}));
    mostraNotificaInAlto(`${leader.nome} vuole distrarre il gruppo da questo mondo crudele...`, 'info');
    aggiornaInterfaccia();
};

export async function entraInGioco() {
    const user = getCurrentUser();
    if (!user) { alert('Devi accedere prima.'); return; }
    try {
        const response = await fetch(apiUrl('/api/party'), { headers: buildAuthHeaders() });
        const data = await response.json();
        const partyData = data.party || [];
        party.length = 0;
        // Carica tutti i personaggi per permettere a tutti di vedere chi è in gioco
        const filtered = partyData;
        filtered.forEach(pData => {
            const stats = (pData.data && typeof pData.data === 'object') ? pData.data : pData;
            const p = Object.assign(new Personaggio(stats.nome || pData.nome, stats.giornoInizio || 0), stats);
            p.id = pData.id;
            p.user_id = pData.user_id;
            p.ownerUsername = pData.owner_username || null;
            party.push(p);
        });
    } catch (e) {
        console.warn('Errore caricamento personaggi:', e);
    }
    showGameScreen(isGuestUser() ? 'Ospite' : 'Giocatore');
}

// --- LOGICA DELLE AZIONI (Thread e Code) ---
function toggleSpedizione(idx) {
    party[idx].inSpedizione = !party[idx].inSpedizione;
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

function puoIniziareAzione(p, tipo) {
    if (!p) return false;
    const azioniConsentite = ['dormi', 'nutri', 'disseta'];
    if (p.staminaAttuale <= 0 && !azioniConsentite.includes(tipo)) {
        alert(`${p.nome} è troppo esausto per farlo. Deve riposare, bere o mangiare prima.`);
        return false;
    }
    return true;
}

function assorbiMagia(idx) {
    const p = party[idx];
    if (!p || !p.isRobot) return;
    if (typeof p.absorbMagicItem !== 'function') {
        alert('Questo personaggio non supporta l’assorbimento energetico.');
        return;
    }

    const stock = magazzino.oggettiMagici || {};
    const opzioni = [
        { key: 'comuni', label: 'Comune', rarity: 'comune' },
        { key: 'nonComuni', label: 'Non Comune', rarity: 'non_comune' },
        { key: 'rari', label: 'Raro', rarity: 'raro' },
        { key: 'superRari', label: 'Super Raro', rarity: 'super_raro' }
    ].filter(opt => (stock[opt.key] || 0) > 0);

    if (!opzioni.length) {
        alert('Nessun oggetto magico disponibile da assorbire.');
        return;
    }

    const promptText = `Scegli cosa assorbire per ${p.nome}:\n${opzioni.map(opt => `${opt.label} (${stock[opt.key] || 0})`).join('\n')}`;
    const scelta = prompt(promptText, opzioni[0].label);
    const sceltaValida = opzioni.find(opt => opt.label.toLowerCase() === (scelta || '').toLowerCase() || opt.rarity.toLowerCase() === (scelta || '').toLowerCase());
    if (!sceltaValida) {
        alert('Scelta non valida.');
        return;
    }

    stock[sceltaValida.key] = Math.max(0, (stock[sceltaValida.key] || 0) - 1);
    const guadagno = p.absorbMagicItem(sceltaValida.rarity);
    alert(`${p.nome} ha assorbito ${sceltaValida.label.toLowerCase()} e ha guadagnato ${guadagno} ore di batteria.`);
    aggiornaInterfaccia();
}

window.mostraInvitoEsplorazione = function(invito, personaggio) {
    const secondi = Math.max(0, Math.round((new Date(invito.scade_il).getTime() - Date.now()) / 1000));
    const accetta = confirm(`📨 Sei stato invitato a esplorare insieme (con ${personaggio.nome})!\nHai circa ${secondi} secondi per rispondere.\n\nAccetti? (OK = Sì, Annulla = No)`);
    fetch(apiUrl(`/api/inviti/${invito.id}/rispondi`), {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ risposta: accetta ? 'accetta' : 'rifiuta' })
    }).catch(e => console.warn('Errore risposta invito:', e));
};

function allenamento(idx) {
    const modal = document.getElementById('modal-allenamento');
    const content = document.getElementById('allenamento-content');
    const p = party[idx];
    if (!puoIniziareAzione(p, 'allenamento')) return;

    const categorie = ['Archi', 'Balestre', 'Armi con l\'asta', 'Lame leggere', 'Armi da fuoco', 'Rampini e fruste', 'Mazze e armi contundenti'];
    const giornoAttuale = Math.floor(oreTotali / 24);
    const oraAttuale = Math.floor(oreTotali % 24);
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

window.usaRecuperoAsmaticoPersonaggio = function(idx) {
    const p = party[idx];
    if (!p) return;
    p.usaRecuperoAsmatico();
};

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
        }
    } else {
        p.azioneCorrente = nuovaAzione;
    }
    // Salva subito
    salvaPersonaggio(p);
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

async function registraColpo(idx, categoria, risultato) {
    const p = party[idx];

    // 1. Tenta di consumare la munizione (categoria funge da tipoArma)
    const colpoSparato = await consumaMunizioneAttacco(p, categoria);
    if (!colpoSparato) {
        return;
    }
    p.registraColpoCombattimento(categoria, risultato);

    const labels = { success: 'Colpo riuscito', critical: 'Colpo critico', fail: 'Colpo fallito' };
    const gains = { success: 1, critical: 2, fail: 0.5 };

    alert(`${p.nome} ha registrato un ${labels[risultato]} con ${categoria}!\n+${gains[risultato]} PCA`);

    // 4. Aggiorna l'interfaccia
    if (typeof registraAttaccoModal === 'function') registraAttaccoModal(idx); // Refresh
    if (typeof aggiornaInterfaccia === 'function') aggiornaInterfaccia();
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

window.apriDecifra = function(idx) {
    const p = party[idx];
    if (!p) return;

    const documenti = [
        ...(p.documenti || []).map(d => ({ ...d, fonte: 'personaggio' })),
        ...(window.archivedDocuments || []).map(d => ({ ...d, fonte: 'biblioteca' }))
    ].filter(d => personaggioConosceLingua(p, d.lingua) || (d.traduzioni || []).some(l => personaggioConosceLingua(p, l)));

    let modal = document.getElementById('modal-decifra');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-decifra';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    if (documenti.length === 0) {
        modal.innerHTML = `<div class="modal-content"><h2 style="color:#8e44ad;">🔤 Decifra</h2>
            <p style="color:#aaa;">${p.nome} non ha documenti leggibili da tradurre.</p>
            <div class="modal-footer"><button class="btn-big btn-cancel" onclick="chiudiModal('modal-decifra')">CHIUDI</button></div></div>`;
        modal.style.display = 'block';
        return;
    }

    const lingueTarget = (p.lingue || []).filter(l => !['comune', 'verdum'].includes(l.toLowerCase()));

    modal.innerHTML = `
        <div class="modal-content" style="max-width:520px;">
            <h2 style="color:#8e44ad;">🔤 Decifra un Documento</h2>
            <div style="margin-bottom:10px; text-align:left;">
                <label style="color:#ccc;">Documento:</label>
                <select id="decifra-doc-select" style="width:100%; background:#222; color:white; border:1px solid #444; padding:6px;">
                    ${documenti.map((d, i) => `<option value="${i}">${d.titolo} (${d.lingua})</option>`).join('')}
                </select>
            </div>
            <div style="margin-bottom:10px; text-align:left;">
                <label style="color:#ccc;">Traduci in:</label>
                <select id="decifra-lingua-select" style="width:100%; background:#222; color:white; border:1px solid #444; padding:6px;">
                    ${lingueTarget.length ? lingueTarget.map(l => `<option value="${l}">${l}</option>`).join('') : `<option value="">${p.nome} non conosce altre lingue</option>`}
                </select>
            </div>
            <div class="modal-footer">
                <button class="btn-big btn-cancel" onclick="chiudiModal('modal-decifra')">ANNULLA</button>
                <button class="btn-big btn-confirm" onclick="confermaDecifra(${idx})">TRADUCI</button>
            </div>
        </div>`;
    modal._documenti = documenti;
    modal.style.display = 'block';
};

window.confermaDecifra = async function(idx) {
    const p = party[idx];
    const modal = document.getElementById('modal-decifra');
    const docIdx = parseInt(document.getElementById('decifra-doc-select').value);
    const linguaTarget = document.getElementById('decifra-lingua-select').value;
    if (!linguaTarget) { alert(`${p.nome} non conosce altre lingue in cui tradurre.`); return; }

    const rif = modal._documenti[docIdx];
    if (!rif) return;

    let originale = rif.fonte === 'personaggio'
        ? (p.documenti || []).find(d => d.id === rif.id)
        : (window.archivedDocuments || []).find(d => d.id === rif.id);
    if (!originale) return;

    originale.traduzioni = originale.traduzioni || [];
    if (originale.lingua !== linguaTarget && !originale.traduzioni.includes(linguaTarget)) {
        originale.traduzioni.push(linguaTarget);
    }

    // Persisti sul server
    try {
        await fetch(apiUrl(`/api/documenti/${originale.id}/traduci`), {
            method: 'PUT',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ lingua: linguaTarget })
        });
    } catch (e) {
        console.warn('Traduzione non sincronizzata col server:', e);
    }

    mostraNotificaInAlto(`${p.nome} ha tradotto "${originale.titolo}" anche in ${linguaTarget}. Ora è leggibile in entrambe le lingue.`, 'successo');
    chiudiModal('modal-decifra');
    if (rif.fonte === 'personaggio') window.apriDocumentiPersonaggio(idx);
    else apriBiblioteca();
};

window.rinominaDocumentoArchiviato = async function(docId) {
    const doc = (window.archivedDocuments || []).find(d => d.id === docId);
    if (!doc) return;
    const nuovoTitolo = prompt('Nuovo nome per il documento:', doc.titolo);
    if (!nuovoTitolo || !nuovoTitolo.trim()) return;
    try {
        const res = await fetch(apiUrl(`/api/documenti/${docId}/rinomina`), {
            method: 'PUT',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ titolo: nuovoTitolo.trim() })
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Errore server');
        doc.titolo = nuovoTitolo.trim();
        apriBiblioteca();
        mostraNotificaInAlto('Documento rinominato.', 'successo');
    } catch (e) {
        alert('Errore rinomina: ' + e.message);
    }
};

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
            salvaPersonaggio(p);
        };
    } else if (tipo === 'dormi') {
    nuovaAzione.onComplete = () => {
        p.applicaRisveglio(plannedHours);
        salvaPersonaggio(p);
    };
}
    // ASMATICO: riposo breve (<8h) limita il recupero stamina a meno che non si usino risorse
    if (p.hasPerk && p.hasPerk('Asmatico') && plannedHours < 8 && !p._asmaShortRestBoost) {
        const vuoleBoost = confirm(`${p.nome} è Asmatico: durante un riposo breve recupererà al massimo 2 tacche di Stamina.\nVuoi usare 10 risorse mediche di base per superare questo limite?`);
        if (vuoleBoost) {
            p.usaRecuperoAsmatico();
        }
    }

    if (p.azioneCorrente) {
        if (confirm(`${p.nome} sta già facendo altro. Vuoi metterlo in coda?`)) {
            p.codaAzioni.push(nuovaAzione);
        }
    } else {
        p.azioneCorrente = nuovaAzione;
    }
    // Salva subito dopo la modifica
    salvaPersonaggio(p);
    aggiornaInterfaccia();
}

function toggleFinoAllUltimo(idx) {
    const p = party[idx];
    p.finoAllUltimoActive = !p.finoAllUltimoActive;
    renderSpedizioneModal();
    aggiornaInterfaccia();
}

function rollD20WithAdv(advantage, disadvantage, svantaggioDoppio = false) {
    if (advantage && !disadvantage) {
        const a = rollDice(1,20);
        const b = rollDice(1,20);
        return Math.max(a, b);
    }
    if (disadvantage && !advantage) {
        const a = rollDice(1,20);
        const b = rollDice(1,20);
        const res = Math.min(a, b);
        if (svantaggioDoppio) {
            // Qui potremmo voler tirare un terzo dado se svantaggioDoppio fosse interpretato così,
            // ma la descrizione dice "si tira con svantaggio E si sottrae il bonus competenza".
            // Quindi il bonus competenza è già sottratto nel modificatore.
        }
        return res;
    }
    return rollDice(1,20);
}

window.apriCuraMalattia = function(idx) {
    const medico = party[idx];
    if (!medico) return;
    
    let html = `<p style="margin-bottom:10px;">Chi deve curare ${medico.nome}?</p>`;
    party.forEach((paziente, pIdx) => {
        if (paziente.isMalato() && paziente.malattia.diagnosiEffettuata) {
            html += `<button class="btn-big" style="margin-bottom:5px; background:#27ae60;" onclick="window.iniziaCuraMalattia(${idx}, ${pIdx}); chiudiModal('modal-risorse');">${paziente.nome} (Grado ${paziente.getGradoMalattia()})</button>`;
        }
    });
    
    if (html.includes('Grado')) {
        document.getElementById('risorse-titolo').innerText = "CURA MALATTIA";
        document.getElementById('risorse-content').innerHTML = html;
        document.getElementById('modal-risorse').style.display = 'block';
    } else {
        alert("Nessun personaggio ha una diagnosi effettuata per essere curato.");
    }
};

window.apriDiagnosiMalattia = function(idx) {
    const medico = party[idx];
    if (!medico) return;
    
    let html = `<p style="margin-bottom:10px;">Chi deve diagnosticare ${medico.nome}?</p>`;
    party.forEach((paziente, pIdx) => {
        if (paziente.isMalato()) {
            html += `<button class="btn-big" style="margin-bottom:5px; background:#2980b9;" onclick="window.diagnosticaMalattia(${idx}, ${pIdx}); chiudiModal('modal-risorse');">${paziente.nome} (Grado ${paziente.getGradoMalattia()})</button>`;
        }
    });
    
    if (html.includes('Grado')) {
        document.getElementById('risorse-titolo').innerText = "DIAGNOSTICA MALATTIA";
        document.getElementById('risorse-content').innerHTML = html;
        document.getElementById('modal-risorse').style.display = 'block';
    } else {
        alert("Nessun altro personaggio è malato.");
    }
};

window.apriAumentaFollia = function(idx) {
    const p = party[idx];
    if (!p) return;

    const modal = document.getElementById('modal-follia');
    const content = document.getElementById('follia-content');

    content.innerHTML = `
        <div style="margin-bottom:15px; border-bottom:1px solid #444; padding-bottom:10px;">
            <p><strong>Personaggio:</strong> ${p.nome}</p>
            <p><strong>Follia Attuale:</strong> ${p.follia || 0}</p>
            <p><strong>Sintomi:</strong> <span style="color:#e74c3c;">${p.folliaSintomi || "1-8 nessun sintomo"}</span></p>
        </div>
        
        <p style="font-size:0.9em; color:#aaa; margin-bottom:10px;">Seleziona la causa dell'aumento:</p>
        
        <div style="display:grid; gap:8px;">
            <button class="btn-big" style="background:#d35400;" onclick="applicaFollia(${idx}, 'cibo_avariato')">Cibo Avariato (1d4)</button>
            <button class="btn-big" style="background:#e67e22;" onclick="applicaFollia(${idx}, 'perk_fobia')">Perk Fobia (1d6)</button>
            <button class="btn-big" style="background:#c0392b;" onclick="applicaFollia(${idx}, 'compagno_morto')">Morte Compagno / Rischio (1d10)</button>
            <button class="btn-big" style="background:#8e44ad;" onclick="applicaFollia(${idx}, 'rischio_morte')">Rischio Morte / Rianimazione (1d12)</button>
        </div>
        
        <div style="margin-top:20px; font-size:0.8em; color:#888;">
            <p><i>Nota: Il modificatore di Carisma (${p.getStatDettagliata('Carisma').mod}) verrà sottratto dal tiro (minimo 1).</i></p>
        </div>
    `;

    modal.style.display = 'block';
};

window.applicaFollia = function(idx, causa) {
    const p = party[idx];
    if (!p) return;

    const risultato = p.subisciFollia(causa);
    
    alert(`FOLLIA AUMENTATA!\n\n` +
          `Causa: ${risultato.causa}\n` +
          `Tiro dado: ${risultato.tiro}\n` +
          `Mod. Carisma: ${risultato.modificatore}\n` +
          `Punti Follia subiti: ${risultato.punti}\n\n` +
          `Totale Follia: ${risultato.totale}\n` +
          `Nuovi Sintomi: ${risultato.sintomi}`);

    document.getElementById('modal-follia').style.display = 'none';
    aggiornaInterfaccia();
};

function rollDice(count, faces) {
    let total = 0;
    for (let i = 0; i < count; i++) {
        total += Math.floor(Math.random() * faces) + 1;
    }
    return total;
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

function generaHtmlStamina(p, idx) {
    const user = getCurrentUser();
    const canControl = user && (user.role === 'master' || p.user_id === user.id);
    
    let tacche = "";
    for(let i=0; i<p.staminaMax; i++) {
        const color = i < p.staminaAttuale ? "#3498db" : "#222";
        tacche += `<div style="flex:1; height:8px; background:${color}; border:1px solid #444; margin:1px;"></div>`;
    }
    return `
        <div style="margin-top:5px;">
            <div style="display:flex; justify-content:space-between; font-size:0.6em;">
                <span>STAMINA</span>
                ${p.follia !== undefined ? `<span style="color:#aaa;">Follia: ${p.follia}</span>` : ''}
                ${canControl ? `<button onclick="riduciStaminaManual(${idx})" style="padding:0 4px; font-size:10px; background:none; color:red; border:1px solid red; cursor:pointer;">-1</button>` : ''}
            </div>
            <div style="display:flex;">${tacche}</div>
            ${p.follia > 0 ? `<div style="font-size:0.7em; color:#e74c3c; margin-top:2px;"><i>${p.folliaSintomi || ""}</i></div>` : ""}
        </div>
    `;
}

function riduciStaminaManual(idx) {
    const p = party[idx];
    if (p && p.staminaAttuale > 0) {
        p.consumaStamina(1);
        if (typeof salvaPersonaggio === 'function') salvaPersonaggio(p);
        aggiornaInterfaccia();
    }
}

window.riduciStaminaManual = riduciStaminaManual;
window.registraColpo = registraColpo;
// Espone le funzioni chiamate dai pulsanti inline in index.html
window.passaTempoGlobale = passaTempoGlobale;
window.chiudiScheda = chiudiScheda;

function findPerkData(nomePerk) {
    const targetName = getPerkBaseName(nomePerk);
    for (let cat in DATABASE_PERK) {
        const found = DATABASE_PERK[cat].find(p => getPerkBaseName(p.nome) === targetName);
        if (found) return found;
    }
    return null;
}

window.getPerkBaseName = getPerkBaseName;
window.findPerkData = findPerkData;

window.mandaInGioco = async function(nome) {
    const user = getCurrentUser();
    if (!user) return alert('Devi essere loggato.');

    // Carica i dati locali del personaggio
    let pData = window.caricaDatiDaLocalStorage ? window.caricaDatiDaLocalStorage(nome) : null;
    if (!pData) {
        alert(`Dati locali per "${nome}" non trovati.`);
        return;
    }

    // Imposta il nome e altri campi obbligatori
    pData.nome = nome;
    pData.classe = pData.classe || 'Sopravvissuto';

    try {
        // Se ha un ID, usiamo PUT invece di POST per evitare il limite dei 2 personaggi attivi
        if (pData.id) {
            const response = await fetch(apiUrl(`/api/personaggi/${pData.id}`), {
                method: 'PUT',
                headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    data: JSON.stringify(pData),
                    status: 'vivo'
                })
            });
            if (response.ok) {
                alert(`✅ Personaggio "${nome}" riattivato con successo!`);
                renderCharacterList();
                aggiornaInterfaccia();
                return;
            }
            // Se PUT fallisce (es. 404), procediamo con POST
            // Leggiamo il corpo della risposta per debug
            const text = await response.text();
            console.warn('PUT fallita, risposta:', text);
        }

        // POST per creare il personaggio
        const response = await fetch(apiUrl('/api/characters'), {
            method: 'POST',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                nome: nome,
                classe: pData.classe,
                data: JSON.stringify(pData),
                updated_at: new Date().toISOString()
            })
        });

        // Leggiamo il corpo come testo prima di provare a fare JSON.parse
        const text = await response.text();
        console.log('Risposta POST /api/characters:', text);

        // Verifichiamo se è JSON valido
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            // Se non è JSON, mostriamo il contenuto e usciamo
            alert(`❌ Errore dal server: la risposta non è JSON.\nContenuto: ${text.substring(0, 200)}...`);
            return;
        }

        if (response.status === 403) {
            alert(`❌ ${data.error || 'Hai già 2 personaggi attivi. Eliminane uno prima di crearne un altro.'}`);
            return;
        }

        if (!response.ok) {
            throw new Error(data.error || 'Errore sconosciuto durante la creazione');
        }

        // Aggiorna i dati locali con l'ID e la data dal server
        if (data.character) {
            pData.id = data.character.id;
            pData.updated_at = data.character.updated_at;
            localStorage.setItem(`personaggio_${encodeURIComponent(nome)}`, JSON.stringify(pData));
        }

        alert(`✅ Personaggio "${nome}" mandato in gioco con successo!`);
        renderCharacterList();
        if (typeof caricaPartyMaster === 'function' && user.role === 'master') {
            await caricaPartyMaster();
        } else {
            const partyMember = party.find(p => p.nome === nome);
            if (!partyMember) {
                const p = Object.assign(new Personaggio(pData.nome, pData.giornoInizio || 0), pData);
                p.id = data.character.id;
                p.user_id = user.id;
                party.push(p);
            }
        }
        aggiornaInterfaccia();

    } catch (err) {
        console.error('Errore mandaInGioco:', err);
        alert(`⚠️ Errore: ${err.message}`);
    }
};

function togglePerk(nomePerk, forceRemove = false) {
    const p = window.tempP;
    if (!p) return;
    const perkDati = findPerkData(nomePerk);
    if (!perkDati) return;

    const selectedCount = getPerkCount(p, perkDati.nome);
    const isSelected = selectedCount > 0;
    const canAfford = perkDati.costo <= 0 || p.puntiCreazione >= perkDati.costo;
    const isRepeatable = Boolean(perkDati.repeats);
    const shouldRemove = forceRemove || (!isRepeatable && isSelected);

    if (shouldRemove && isSelected) {
        const index = p.perks.findIndex(pp => getPerkBaseName(perkObjectName(pp)) === getPerkBaseName(perkDati.nome));
        if (index === -1) return;
        const removed = p.perks[index];
        if (getPerkBaseName(perkDati.nome) === 'Lingue') {
            const match = /\(([^)]+)\)/.exec(perkObjectName(removed));
            if (match && p.lingue) p.lingue = p.lingue.filter(l => l !== match[1]);
        }
        p.perks.splice(index, 1);
        if (getPerkBaseName(perkDati.nome) === 'Obeso' || getPerkBaseName(perkDati.nome) === 'Sovrappeso') {
            p.pesoCorporeo = p.pesoCorporeo || {};
            p.pesoCorporeo.usiCuscinetto = null;
        }
        if (getPerkBaseName(perkDati.nome) === 'Alchemico') {
            p.masteries = p.masteries.filter(m => m.toLowerCase() !== 'natura');
        }
        p.puntiCreazione += perkDati.costo;
        renderSetupStats();
        p.sincronizzaLivelloMedicina();
        renderSetupPerks();
    } else {
        if (perkDati.requires && !hasPerk(p, perkDati.requires)) {
            alert(`Devi scegliere prima ${perkDati.requires} per poter prendere ${perkDati.nome}.`);
            return;
        }
        if (perkDati.nome === 'Arti marziali') {
            const hasManiNude = p.perks.some(pp => getPerkBaseName(perkObjectName(pp)).startsWith('Mani nude'));
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
            p.perks.push({...perkDati, nome: nomeSpecifico});
        } else if (nomePerk === 'Lingue') {
            const lingueDisponibili = ['Yazyk', 'Engenity', 'Chrimil', 'Ridulphi', 'Antali', 'Puleun', 'Eklesti', 'Meer'];
            const giaConosciute = p.lingue || ['Verbum'];
            const disponibiliRestanti = lingueDisponibili.filter(l => !giaConosciute.includes(l));
            if (disponibiliRestanti.length === 0) {
                alert('Conosci già tutte le lingue disponibili!');
                return;
            }
            const scelta = prompt(`Perk "Lingue": scegli una nuova lingua da imparare:\n${disponibiliRestanti.join(", ")}`, disponibiliRestanti[0]);
            const trovata = disponibiliRestanti.find(l => l.toLowerCase() === (scelta || '').toLowerCase());
            if (!trovata) {
                alert('Lingua non valida o annullata.');
                return;
            }
            p.lingue = [...giaConosciute, trovata];
            p.perks.push({...perkDati, nome: `Lingue (${trovata})`});
        } else if (nomePerk === 'Obeso') {
            p.perks.push({...perkDati});
            p.pesoCorporeo = p.pesoCorporeo || {usiCuscinetto: null, benNutritoOreAccumulate: 0};
            p.pesoCorporeo.usiCuscinetto = 40;
        } else if (nomePerk === 'Sovrappeso') {
            p.perks.push({...perkDati});
            p.pesoCorporeo = p.pesoCorporeo || {usiCuscinetto: null, benNutritoOreAccumulate: 0};
            p.pesoCorporeo.usiCuscinetto = 20;
        } else if (nomePerk === 'Artista') {
                const scelta = prompt(
                    `Perk "Artista": scegli specializzazione:\n1. Musicista (Orecchio fino)\n2. Scrittore (comp. Manodopera)\n3. Danzatore (+2 Acrobazia)\n4. Narratore (studio accelerato 25%)\n5. Pittore (narrativo)`, "1");
                const mappaSpec = {
                    '1': 'Musicista',
                    '2': 'Scultore',
                    '3': 'Danzatore',
                    '4': 'Narratore',
                    '5': 'Pittore'
                };
                const spec = mappaSpec[scelta] || 'Musicista';
                const nuovoPerk = {...perkDati, nome: 'Artista', specializzazione: spec};
                if (spec === 'Musicista') {
                    const orecchioDati = getGlobalPerkData('Orecchio fino') || {
                        nome: 'Orecchio fino',
                        desc: '',
                        costo: 0
                    };
                    p.perks.push({...orecchioDati, costo: 0});
                } else if (spec === 'Scultore') {
                    nuovoPerk.skills = ['Manodopera'];
                }
                p.perks.push(nuovoPerk);
                } else if (nomePerk === 'Ignorante') {
                    const skillsIgnorante = ['Arcano', 'Artificeria', 'Medicina', 'Natura', 'Storia', 'Religione', 'Cucina', 'Sopravvivenza'];
                    const giaScelte = p.perks
                        .filter(pp => getPerkBaseName(perkObjectName(pp)) === 'Ignorante')
                        .map(pp => (pp.disadvantage && pp.disadvantage[0]) || null)
                        .filter(Boolean);
                    const disponibili = skillsIgnorante.filter(s => !giaScelte.includes(s));
                    if (disponibili.length === 0) {
                        alert('Hai già preso Ignorante su tutte le competenze disponibili!');
                        return;
                    }
                    const scelta = prompt(`Perk "Ignorante": scegli una competenza in cui ottenere svantaggio:\n${disponibili.join(", ")}`, disponibili[0]);
                    const trovata = disponibili.find(s => s.toLowerCase() === (scelta || '').toLowerCase());
                    if (!trovata) {
                        alert('Competenza non valida o annullata.');
                        return;
                    }
                    p.perks.push({ ...perkDati, nome: `Ignorante (${trovata})`, disadvantage: [trovata] });
                } else if (nomePerk === 'Alchimico') {
                        p.perks.push({...perkDati});
                        if (!p.masteries.map(m => m.toLowerCase()).includes('natura')) {
                            p.masteries.push('Natura');
                        }
        } else {
                p.perks.push({...perkDati});
            }
            p.puntiCreazione -= perkDati.costo;

            const existingNames = p.perks.map(pp => getPerkBaseName(perkObjectName(pp)));
            let removedSomething = false;
            p.perks = p.perks.filter(pp => {
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
}

function renderInventarioHtml(p) {
    if (typeof p.initInventarioBase === 'function') p.initInventarioBase();
    const inv = p.inventario || {};
    const munizioniStr = (typeof inv.munizioni === 'object' && inv.munizioni)
        ? Object.entries(inv.munizioni).map(([k, v]) => `${k}: ${v}`).join(' • ') || 'Nessuna'
        : `${inv.munizioni || 0}`;
    return `
    <div style="margin-top:14px; background:#111; padding:12px; border:1px solid #333; border-radius:6px; text-align:left;">
        <div style="font-weight:bold; color:#f1c40f; margin-bottom:8px;">🎒 INVENTARIO (Peso ${p.pesoAttuale}/${p.capacitaMax})</div>
        <div style="font-size:0.85rem; color:#eee; display:grid; gap:4px;">
            <div>🍞 Cibo: ${(inv.cibo || 0).toFixed ? inv.cibo.toFixed(1) : inv.cibo}</div>
            <div>💧 Acqua: ${(inv.acqua || 0).toFixed ? inv.acqua.toFixed(1) : inv.acqua}</div>
            <div>⚙️ Ingranaggi: ${inv.ingranaggi || 0}</div>
            <div>⚗️ Alchemici: ${inv.alchemici || 0}</div>
            <div>🩺 Medici: base ${inv.medBase || 0} • avanzati ${inv.medAvanzati || 0} • critici ${inv.medCritici || 0}</div>
            <div>🔫 Munizioni: ${munizioniStr}</div>
        </div>
        <div style="margin-top:8px; font-size:0.85rem; color:#eee;">
            <strong>Armi:</strong> ${inv.armi && inv.armi.length ? inv.armi.join(' • ') : 'Nessuna'}
        </div>
        <div style="margin-top:6px; font-size:0.85rem; color:#eee;">
            <strong>Zaino equipaggiato:</strong> ${p.zainoEquipaggiato ? p.zainoEquipaggiato.nome : 'Nessuno'}
            ${inv.zaini && inv.zaini.length ? `<br><strong>Altri zaini portati:</strong> ${inv.zaini.map(z => z.nome).join(' • ')}` : ''}
        </div>
           <div style="margin-top:6px; font-size:0.85rem; color:#eee;">
            <strong>Consumabili:</strong>
            ${inv.consumabili && inv.consumabili.length ? `
                <div style="display:grid; gap:4px; margin-top:4px;">
                    ${inv.consumabili.map((c, ci) => `
                        <div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:4px 8px; border:1px solid #333;">
                            <span>${c.nome || c}</span>
                            <button class="btn-hero" style="padding:3px 8px; font-size:0.7rem;" onclick="window.consumaConsumabilePersonaggio(${party.indexOf(p)}, ${ci})">Consuma</button>
                        </div>
                    `).join('')}
                </div>
            ` : 'Nessuno'}
i        </div>
        <div style="margin-top:6px; font-size:0.85rem; color:#eee;">
            <strong>Documenti posseduti:</strong> ${(p.documenti && p.documenti.length) || 0}
        </div>
    </div>`;
}
window.renderInventarioHtml = renderInventarioHtml;

function apriScheda(idx) {
    const p = party[idx];
    if (!p.user_id) {
        const user = getCurrentUser();
        if (user) p.user_id = user.id;
    }
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
            <div style="color:#eee; font-size:0.9rem;">${(p.lingue || ['Verdum']).join(' • ')}</div>
        </div>`;

    statsHtml += lingueHtml;
    const statiPerTS = ["Forza", "Destrezza", "Costituzione", "Intelligenza", "Saggezza", "Carisma"];
    statsHtml += `
    <div style="margin-top:14px; background:#111; padding:12px; border:1px solid #333; border-radius:6px; text-align:left;">
        <div style="font-weight:bold; color:#f1c40f; margin-bottom:6px;">TIRI SALVEZZA</div>
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:6px; font-size:0.85rem;">
            ${statiPerTS.map(s => {
        const mod = p.getSaveModifier(s);
        const comp = p.hasSaveCompetenza(s);
        return `<div style="color:${comp ? '#2ecc71' : '#ccc'};">${s.slice(0,3).toUpperCase()}: ${mod >= 0 ? '+' : ''}${mod}${comp ? ' ★' : ''}</div>`;
    }).join('')}
        </div>
    </div>`;

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
    if (p.diabeteTipoI) {
        effettiHtml += `<p style="margin:8px 0; color:${p.diabeteIpoglicemiaAttiva || p.diabeteIperglicemiaAttiva ? '#e74c3c' : '#888'};">🩸 <b>Diabete Tipo I</b><br><small>${p.diabeteIpoglicemiaAttiva ? 'IPOGLICEMIA attiva' : p.diabeteIperglicemiaAttiva ? 'IPERGLICEMIA attiva' : 'Stabile'}</small></p>`;
    }
    if (p.diabeteTipoII) {
        effettiHtml += `<p style="margin:8px 0; color:${p._diabeteInstabile ? '#e74c3c' : '#2ecc71'};">💉 <b>Insulina</b><br><small>Timer: ${(p.diabeteTimer/24).toFixed(1)}g ${p._diabeteInstabile ? '(INSTABILE - non curabile)' : ''}</small></p>`;
    }

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
                    <p>🏃‍♂️ <b>VELOCITÀ:</b> <span style="color:#2ecc71">${p.velocitaAttuale} m</span></p>
                    <p>🛠️ <b>Riparazioni residue:</b> ${Math.max(0, (p.robotRepairTotalLimit || 50) - (p.robotRepairTotalDone || 0))} PF</p>
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
                    <p>🏃‍♂️ <b>VELOCITÀ:</b> <span style="color:#2ecc71">${p.velocitaAttuale} m</span></p>
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
                 ${renderInventarioHtml(p)}
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

async function renderCharacterList() {
    const container = document.getElementById('lobby-characters');
    if (!container) return;

    const user = getCurrentUser();
    if (!user) {
        container.innerHTML = '<div style="color:#ccc;">Effettua il login per vedere i tuoi personaggi.</div>';
        return;
    }

    const isMaster = user.role === 'master';

    // 1. Recupera i personaggi dal server.
    //    - Master: vede tutti (all=true), gli serve per gestire l'intera partita.
    //    - Giocatore/Ospite: vede solo i propri, il server filtra già lato suo.
    let allChars = [];
    try {
        const url = isMaster ? apiUrl('/api/characters?all=true') : apiUrl('/api/characters');
        const res = await fetch(url, { headers: buildAuthHeaders() });
        if (res.ok) {
            const data = await res.json();
            allChars = data.characters || [];
        }
    } catch (e) {
        console.warn('Errore caricamento personaggi:', e);
    }

    // 2. Per i non-master, filtra comunque lato client come doppia sicurezza
    let userChars = isMaster ? allChars : allChars.filter(c => c.user_id === user.id);

    // 3. Aggiungi eventuali personaggi salvati SOLO in locale (mai mandati in gioco)
    const localKey = `user_chars_${user.username}`;
    const localNames = JSON.parse(localStorage.getItem(localKey) || '[]');
    localNames.forEach(nome => {
        if (!userChars.some(c => c.nome === nome)) {
            const localDataRaw = localStorage.getItem(`personaggio_${encodeURIComponent(nome)}`);
            if (localDataRaw) {
                try {
                    const localData = JSON.parse(localDataRaw);
                    userChars.push({
                        nome: nome,
                        user_id: user.id,
                        status: 'locale',
                        data: localData,
                        id: null
                    });
                } catch (e) { /* dati locali corrotti, ignora */ }
            }
        }
    });

    // 4. Separa vivi e morti
    const vivi = userChars.filter(c => c.status !== 'morto');
    const morti = userChars.filter(c => c.status === 'morto');

    if (vivi.length === 0 && morti.length === 0) {
        container.innerHTML = '<div style="color:#ccc;">Nessun personaggio trovato. Crea il primo con "Crea Personaggio".</div>';
        return;
    }

    let html = '';

    // 5. Render dei personaggi vivi
    vivi.forEach(c => {
        const isLocale = c.status === 'locale';
        const isOwner = c.user_id === user.id;
        const canControl = isMaster || isOwner;

        // "Caricato ora" = è presente nel party locale della sessione corrente di gioco
        const isCaricatoOra = party.some(p => p.nome === c.nome);

        let statusBadge;
        if (isLocale) {
            statusBadge = '<div style="font-size:0.85rem;color:#f1c40f;">🏠 Locale (non ancora in gioco)</div>';
        } else if (isCaricatoOra) {
            statusBadge = '<div style="font-size:0.85rem;color:#2ecc71;">✅ Attivo e caricato</div>';
        } else {
            statusBadge = '<div style="font-size:0.85rem;color:#3498db;">🟢 Attivo sul server</div>';
        }

        const ruoloDestinazione = isMaster ? 'Master' : (window.isGuestUser && window.isGuestUser() ? 'Ospite' : 'Giocatore');
        const enterAction = isCaricatoOra
            ? `showGameScreen('${ruoloDestinazione}')`
            : (isLocale ? `mandaInGiocoDaLobby('${c.nome}')` : `entraInGiocoDaLobby('${c.nome}', ${c.id})`);
        const btnLabel = isCaricatoOra ? 'In Gioco' : (isLocale ? 'Manda in gioco' : 'Entra in gioco');

        html += `
            <div class="lobby-char" style="background:#0f0f0f; padding:8px; border:1px solid #222; display:flex; justify-content:space-between; align-items:center;">
                <div><strong>${c.nome}</strong>${statusBadge}</div>
                <div style="display:flex; gap:6px;">
                    ${canControl ? `
                        <button class="btn-hero" ${isCaricatoOra ? 'style="background:#27ae60;"' : ''} onclick="${enterAction}">${btnLabel}</button>
                        <button class="btn-hero" style="background:#c0392b;" onclick="eliminaPersonaggioLobby('${c.nome}', ${c.id}, true)">🗑️ Elimina</button>
                    ` : `
                        <button class="btn-hero" disabled style="opacity:0.5; cursor:not-allowed;">Solo Visura</button>
                    `}
                </div>
            </div>
        `;
    });

    // 6. Render dei personaggi morti
    morti.forEach(c => {
        const isOwner = c.user_id === user.id;
        const canControl = isMaster || isOwner;
        const causa = c.data?.causaMorte || 'Ignota';
        html += `
            <div class="lobby-char" style="background:#1a0a0a; padding:8px; border:1px solid #442222; display:flex; justify-content:space-between; align-items:center;">
                <div><strong>☠️ ${c.nome}</strong><div style="font-size:0.85rem;color:#ff4444;">Morto (${causa})</div></div>
                <div style="display:flex; gap:6px;">
                    ${canControl ? `<button class="btn-hero" style="background:#c0392b;" onclick="eliminaPersonaggioLobby('${c.nome}', ${c.id}, false)">🗑️ Elimina</button>` : ''}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

window.mostraNotificaInAlto = mostraNotificaInAlto;
window.apriScheda = apriScheda;
window.chiudiScheda = chiudiScheda;
window.visualizzaPerk = visualizzaPerk;
window.passaTempoGlobale = typeof passaTempoGlobale === 'function' ? passaTempoGlobale : (window.passaTempoGlobale || undefined);
window.chiudiModal = chiudiModal;
window.renderMasterMagazzino = renderMasterMagazzino;
window.renderCharacterList = renderCharacterList;
window.aggiornaInterfaccia = aggiornaInterfaccia;
window.initUI = initUI;
window.getPerkCount = getPerkCount;
window.allenamento = allenamento;
window.scheduleAllenamento = scheduleAllenamento;
window.togglePerk = togglePerk;
window.assorbiMagia = assorbiMagia;
window.completeAllenamento = completeAllenamento;
window.hasPerk = hasPerk;
window.rollDice = rollDice;
window.rollDiceNotation = rollDiceNotation;
window.pianificaAzione = pianificaAzione;
window.puoIniziareAzione = puoIniziareAzione;
window.getBarra = getBarra;
window.applyPerkEffects = applyPerkEffects;
window.entraInGioco = entraInGioco;
window.rollD20WithAdv = rollD20WithAdv;
window.inviaProposta = inviaProposta;
window.accettaProposta = accettaProposta;
window.rifiutaProposta = rifiutaProposta;
window.renderProposte = renderProposte;
window.verificaProposteInSospeso = verificaProposteInSospeso;