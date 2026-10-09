// campo.js — stato del campo base selezionato dal client e helper di rete correlati
import { apiUrl, buildAuthHeaders, getCurrentUser } from './logic.js';

const CAMPO_STORAGE_PREFIX = 'campo_base_selezionato';
const CAMPO_DEFAULT_ID = 1;

export let campoBaseCorrente = null; // { id, nome }

// La selezione del campo è per-utente: su un browser condiviso (o dopo un cambio
// account) il secondo utente non deve ereditare il campo base del primo.
function campoStorageKey() {
    const user = getCurrentUser();
    return user?.id != null ? `${CAMPO_STORAGE_PREFIX}_${user.id}` : CAMPO_STORAGE_PREFIX;
}

function leggiCampoSalvato() {
    if (typeof localStorage === 'undefined') return null;
    const id = parseInt(localStorage.getItem(campoStorageKey()), 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// Legge il body una volta sola e non esplode se il server risponde con HTML
// (502 del proxy, pagina di warning di ngrok, stack trace...).
async function leggiCorpoRisposta(res) {
    const testo = await res.text().catch(() => '');
    if (!testo) return {};
    try {
        return JSON.parse(testo);
    } catch {
        return {};
    }
}

async function richiedi(path, options, messaggioErrore) {
    const res = await fetch(apiUrl(path), options);
    const data = await leggiCorpoRisposta(res);
    if (!res.ok) throw new Error(data.error || `${messaggioErrore} (HTTP ${res.status})`);
    return data;
}

export function getCampoBaseId() {
    if (campoBaseCorrente && Number.isInteger(campoBaseCorrente.id)) return campoBaseCorrente.id;
    return leggiCampoSalvato() || CAMPO_DEFAULT_ID;
}

export function setCampoBaseCorrente(campo) {
    campoBaseCorrente = campo ? { id: campo.id, nome: campo.nome } : null;
    window.campoBaseCorrente = campoBaseCorrente;
    if (typeof localStorage === 'undefined') return;
    // Azzerare la selezione deve azzerare anche quella persistita, altrimenti
    // getCampoBaseId() continuerebbe a restituire il vecchio id.
    if (campoBaseCorrente) localStorage.setItem(campoStorageKey(), String(campoBaseCorrente.id));
    else localStorage.removeItem(campoStorageKey());
}

export async function fetchCampiBase() {
    const data = await richiedi('/api/campi', { headers: buildAuthHeaders() }, 'Impossibile caricare i campi base');
    return Array.isArray(data.campi) ? data.campi : [];
}

export async function creaCampoBase(nome) {
    const data = await richiedi('/api/campi', {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ nome })
    }, 'Errore creazione campo base');
    return data.campo;
}

/**
 * Allinea campoBaseCorrente a un campo che esiste davvero sul server.
 * Ordine di preferenza: preferredId (es. il campo del personaggio dell'utente),
 * poi la selezione in memoria, poi quella salvata, infine il primo campo disponibile.
 * Ritorna il campo scelto (o null se non ce ne sono); confronta `campo.id` con
 * l'id che avevi richiesto per sapere se è scattato il fallback.
 */
export async function initCampoBaseCorrente(preferredId = null) {
    try {
        const campi = await fetchCampiBase();
        if (!campi.length) return null;

        let trovato = null;
        for (const id of [preferredId, campoBaseCorrente?.id, leggiCampoSalvato()]) {
            if (!Number.isInteger(id)) continue;
            trovato = campi.find(c => c.id === id);
            if (trovato) break;
        }
        if (!trovato) {
            trovato = campi[0];
            console.warn(`Campo base non più disponibile: ripiego su "${trovato.nome}" (id ${trovato.id}).`);
        }

        setCampoBaseCorrente(trovato);
        return campoBaseCorrente;
    } catch (e) {
        console.warn('Impossibile inizializzare il campo base corrente:', e);
        return null;
    }
}

// --- LOG EVENTI DEL CAMPO ---
// Alimenta il visore "Cosa è successo" (campo-ui.js). Ritorna true/false invece
// di lanciare: un evento perso non deve mai interrompere il flusso di gioco.
export async function registraEvento(campoBaseId, messaggio, tipo = 'info', personaggioNome = null, oraGioco = 0) {
    const id = parseInt(campoBaseId, 10);
    if (!Number.isInteger(id) || id <= 0 || !messaggio) {
        console.warn('registraEvento: parametri non validi', { campoBaseId, messaggio });
        return false;
    }
    try {
        await richiedi('/api/eventi', {
            method: 'POST',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ campoBaseId: id, messaggio: String(messaggio), tipo, personaggioNome, oraGioco: Number(oraGioco) || 0 })
        }, 'Impossibile registrare evento');
        return true;
    } catch (e) {
        console.warn('Impossibile registrare evento:', e.message);
        return false;
    }
}

// Scorciatoia per i call site di gioco: campo e ora li ricava da sé.
export function registraEventoCampoCorrente(messaggio, tipo = 'info', personaggioNome = null) {
    return registraEvento(getCampoBaseId(), messaggio, tipo, personaggioNome, Number(window.oreTotali) || 0);
}

export async function fetchEventiCampo(campoBaseId) {
    const id = parseInt(campoBaseId, 10);
    if (!Number.isInteger(id) || id <= 0) {
        console.warn('fetchEventiCampo: campoBaseId non valido', campoBaseId);
        return [];
    }
    try {
        const data = await richiedi(
            `/api/eventi?campoBaseId=${encodeURIComponent(id)}`,
            { headers: buildAuthHeaders() },
            'Impossibile caricare gli eventi del campo'
        );
        return Array.isArray(data.eventi) ? data.eventi : [];
    } catch (e) {
        console.warn('Impossibile caricare gli eventi del campo:', e.message);
        return [];
    }
}

export async function segnaEventiLetti(campoBaseId) {
    const id = parseInt(campoBaseId, 10);
    if (!Number.isInteger(id) || id <= 0) return false;
    try {
        await richiedi('/api/eventi/segna-letti', {
            method: 'POST',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ campoBaseId: id })
        }, 'Impossibile segnare gli eventi come letti');
        return true;
    } catch (e) {
        console.warn('Impossibile segnare gli eventi come letti:', e.message);
        return false;
    }
}

window.getCampoBaseId = getCampoBaseId;
window.setCampoBaseCorrente = setCampoBaseCorrente;
window.fetchCampiBase = fetchCampiBase;
window.creaCampoBase = creaCampoBase;
window.initCampoBaseCorrente = initCampoBaseCorrente;
window.registraEvento = registraEvento;
window.registraEventoCampoCorrente = registraEventoCampoCorrente;
window.fetchEventiCampo = fetchEventiCampo;
window.segnaEventiLetti = segnaEventiLetti;
