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

window.getCampoBaseId = getCampoBaseId;
window.setCampoBaseCorrente = setCampoBaseCorrente;
window.fetchCampiBase = fetchCampiBase;
window.creaCampoBase = creaCampoBase;
window.initCampoBaseCorrente = initCampoBaseCorrente;