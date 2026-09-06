// campo.js — stato del campo base selezionato dal client e helper di rete correlati
import { apiUrl, buildAuthHeaders } from './logic.js';

const CAMPO_STORAGE_KEY = 'campo_base_selezionato';

export let campoBaseCorrente = null; // { id, nome }

export function getCampoBaseId() {
    return campoBaseCorrente ? campoBaseCorrente.id : (parseInt(localStorage.getItem(CAMPO_STORAGE_KEY), 10) || 1);
}

export function setCampoBaseCorrente(campo) {
    campoBaseCorrente = campo;
    if (campo) localStorage.setItem(CAMPO_STORAGE_KEY, String(campo.id));
    window.campoBaseCorrente = campo;
}

export async function fetchCampiBase() {
    const res = await fetch(apiUrl('/api/campi'), { headers: buildAuthHeaders() });
    if (!res.ok) throw new Error('Impossibile caricare i campi base');
    const data = await res.json();
    return data.campi || [];
}

export async function creaCampoBase(nome) {
    const res = await fetch(apiUrl('/api/campi'), {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ nome })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Errore creazione campo base');
    return data.campo;
}

export async function initCampoBaseCorrente() {
    try {
        const campi = await fetchCampiBase();
        if (!campi.length) return null;
        const idSalvato = getCampoBaseId();
        const trovato = campi.find(c => c.id === idSalvato) || campi[0];
        setCampoBaseCorrente(trovato);
        return trovato;
    } catch (e) {
        console.warn('Impossibile inizializzare il campo base corrente:', e);
        return null;
    }
}

export async function fetchOreTotaliGlobali() {
    const res = await fetch(apiUrl('/api/mondo'), { headers: buildAuthHeaders() });
    if (!res.ok) throw new Error('Impossibile leggere l\'orologio globale');
    const data = await res.json();
    return data.mondo?.ore_totali || 0;
}

export async function setOreTotaliGlobali(ore) {
    const res = await fetch(apiUrl('/api/mondo'), {
        method: 'PUT',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ore_totali: ore })
    });
    if (!res.ok) throw new Error('Impossibile aggiornare l\'orologio globale');
}

export async function registraEvento(campoBaseId, messaggio, tipo = 'info', personaggioNome = null, oraGioco = 0) {
    try {
        await fetch(apiUrl('/api/eventi'), {
            method: 'POST',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ campoBaseId, messaggio, tipo, personaggioNome, oraGioco })
        });
    } catch (e) {
        console.warn('Impossibile registrare evento:', e);
    }
}

export async function fetchEventiCampo(campoBaseId) {
    const res = await fetch(apiUrl(`/api/eventi?campoBaseId=${campoBaseId}`), { headers: buildAuthHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.eventi || [];
}

export async function segnaEventiLetti(campoBaseId) {
    try {
        await fetch(apiUrl('/api/eventi/segna-letti'), {
            method: 'POST',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ campoBaseId })
        });
    } catch (e) { /* non bloccante */ }
}

window._eliminaCampoBase = async function(id, nome) {
    if (!confirm(`Eliminare il campo base "${nome}"? I personaggi vivi al suo interno torneranno "in attesa" nel menù del loro giocatore e dovranno scegliere un nuovo campo per rientrare in gioco. Il magazzino del campo verrà perso.`)) return;
    try {
        const res = await fetch(apiUrl(`/api/campi/${id}`), {
            method: 'DELETE',
            headers: buildAuthHeaders()
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Errore eliminazione campo base');
        }
        if (typeof window.mostraNotificaInAlto === 'function') {
            window.mostraNotificaInAlto(`Campo base "${nome}" eliminato.`, 'avviso');
        }
        if (window.campoBaseCorrente && window.campoBaseCorrente.id === id) {
            window.setCampoBaseCorrente({ id: 1, nome: 'Casa di Maria' });
            if (typeof window.ricaricaCampoCorrente === 'function') await window.ricaricaCampoCorrente();
        }
        if (typeof window.renderCharacterList === 'function') window.renderCharacterList();
        window.apriSelezioneCampoBase(window._callbackSelezioneCampoBase || (() => {}));
    } catch (e) {
        alert('Errore: ' + e.message);
    }
};

window.getCampoBaseId = getCampoBaseId;
window.setCampoBaseCorrente = setCampoBaseCorrente;
window.fetchCampiBase = fetchCampiBase;
window.creaCampoBase = creaCampoBase;
window.initCampoBaseCorrente = initCampoBaseCorrente;