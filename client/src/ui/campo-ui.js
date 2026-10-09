// campo-ui.js
import {
    fetchCampiBase, creaCampoBase, setCampoBaseCorrente, getCampoBaseId,
    fetchEventiCampo, segnaEventiLetti, initCampoBaseCorrente, registraEvento
} from '../logic/campo.js';
import { apiUrl, buildAuthHeaders, getCurrentUser, fetchUserCharacters } from '../logic/logic.js';

// I nomi dei campi base e i messaggi del log arrivano dal server (li scrivono altri
// utenti): vanno sempre escapati prima di finire dentro innerHTML.
function escapeHtml(valore) {
    return String(valore ?? '').replace(/[&<>"']/g, ch => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
}

function notifica(messaggio, tipo = 'info') {
    if (typeof window.mostraNotificaInAlto === 'function') window.mostraNotificaInAlto(messaggio, tipo);
    else console.log(`[${tipo}] ${messaggio}`);
}

async function apriSelezioneCampoBase(onSelezionato) {
    let modal = document.getElementById('modal-campo-base');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-campo-base';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    let campi = [];
    try {
        campi = await fetchCampiBase();
    } catch (e) {
        alert('Errore caricamento campi base: ' + e.message);
        return;
    }

    const isMaster = window.getCurrentUser && window.getCurrentUser()?.role === 'master';

    // Niente interpolazione di `nome` dentro gli attributi onclick: l'id viaggia in
    // un data-attribute e i listener si agganciano dopo il render.
    modal.innerHTML = `
        <div class="modal-content" style="max-width:480px;">
            <h2 style="color:#f1c40f;">🏕️ Scegli Campo Base</h2>
            <div style="display:grid; gap:8px; margin:14px 0; max-height:300px; overflow-y:auto;">
                ${campi.map(c => `
                    <div style="display:flex; gap:6px; align-items:stretch;">
                        <button class="btn-big js-seleziona-campo" data-campo-id="${c.id}"
                                style="flex:1; text-align:left; display:flex; justify-content:space-between;">
                            <span>${escapeHtml(c.nome)}</span>
                            <span style="color:#888; font-size:0.8rem;">${escapeHtml(c.pg_attivi)} pg attivi</span>
                        </button>
                        ${(isMaster && c.id !== 1) ? `
                        <button class="btn-big js-elimina-campo" data-campo-id="${c.id}"
                                style="background:#c0392b;" title="Elimina campo base">🗑️</button>` : ''}
                    </div>
                `).join('')}
            </div>
            <div style="border-top:1px solid #333; padding-top:12px;">
                <label style="color:#ccc; font-size:0.85rem;">Oppure crea un nuovo campo base:</label>
                <div style="display:flex; gap:8px; margin-top:6px;">
                    <input type="text" id="nuovo-campo-nome" placeholder="Nome del nuovo campo..." style="flex:1; background:#222; color:white; border:1px solid #444; padding:6px;">
                    <button class="btn-hero" onclick="window._creaENuovoCampoBase()">Crea</button>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-big btn-cancel" onclick="chiudiModal('modal-campo-base')">ANNULLA</button>
            </div>
        </div>`;

    const perId = new Map(campi.map(c => [c.id, c]));
    modal.querySelectorAll('.js-seleziona-campo').forEach(btn => {
        btn.addEventListener('click', () => {
            const campo = perId.get(parseInt(btn.dataset.campoId, 10));
            if (campo) window._confermaSelezioneCampoBase(campo.id, campo.nome);
        });
    });
    modal.querySelectorAll('.js-elimina-campo').forEach(btn => {
        btn.addEventListener('click', () => {
            const campo = perId.get(parseInt(btn.dataset.campoId, 10));
            if (campo) eliminaCampoBase(campo.id, campo.nome);
        });
    });

    modal.style.display = 'block';
    window._callbackSelezioneCampoBase = onSelezionato;
}
window.apriSelezioneCampoBase = apriSelezioneCampoBase;

window._confermaSelezioneCampoBase = function(id, nome) {
    setCampoBaseCorrente({ id, nome });
    chiudiModal('modal-campo-base');
    if (typeof window._callbackSelezioneCampoBase === 'function') {
        window._callbackSelezioneCampoBase({ id, nome });
    }
};

window._creaENuovoCampoBase = async function() {
    const input = document.getElementById('nuovo-campo-nome');
    const nome = input?.value?.trim();
    if (!nome) return alert('Inserisci un nome per il campo base.');
    try {
        const campo = await creaCampoBase(nome);
        await registraEvento(campo.id, `Campo base "${campo.nome}" fondato.`, 'info');
        window._confermaSelezioneCampoBase(campo.id, campo.nome);
    } catch (e) {
        alert('Errore: ' + e.message);
    }
};

// --- MASTER: elimina un campo base ---
// Sta qui e non in campo.js: usa confirm/alert e riapre il modal, è UI a tutti gli effetti.
async function eliminaCampoBase(id, nome) {
    if (!confirm(`Eliminare il campo base "${nome}"? I personaggi vivi al suo interno torneranno "in attesa" nel menù del loro giocatore e dovranno scegliere un nuovo campo per rientrare in gioco. Il magazzino del campo verrà perso.`)) return;
    try {
        const res = await fetch(apiUrl(`/api/campi/${id}`), {
            method: 'DELETE',
            headers: buildAuthHeaders()
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Errore eliminazione campo base (HTTP ${res.status})`);
        }
        notifica(`Campo base "${nome}" eliminato.`, 'avviso');

        if (window.campoBaseCorrente && window.campoBaseCorrente.id === id) {
            // Invalida la selezione cancellata e lascia che initCampoBaseCorrente
            // ripieghi su un campo reale, prendendone il nome dal server invece
            // di darlo per scontato.
            setCampoBaseCorrente(null);
            const nuovo = await initCampoBaseCorrente();
            if (nuovo) {
                notifica(`Visuale spostata su "${nuovo.nome}".`, 'info');
                if (typeof window.ricaricaCampoCorrente === 'function') await window.ricaricaCampoCorrente();
            }
        }
        if (typeof window.renderCharacterList === 'function') window.renderCharacterList();
        await apriSelezioneCampoBase(window._callbackSelezioneCampoBase || (() => {}));
    } catch (e) {
        alert('Errore: ' + e.message);
    }
}
window._eliminaCampoBase = eliminaCampoBase;

// --- Visore log eventi (riepilogo di ciò che è successo mentre nessuno era nel campo) ---
window.apriLogEventiCampo = async function() {
    const campoId = getCampoBaseId();
    let modal = document.getElementById('modal-log-eventi');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-log-eventi';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    const eventi = await fetchEventiCampo(campoId);
    const nonLetti = eventi.filter(e => !e.letto);

    modal.innerHTML = `
        <div class="modal-content" style="max-width:600px;">
            <h2 style="color:#e67e22;">📋 Cosa è successo (${eventi.length} eventi)</h2>
            <div style="text-align:left; max-height:400px; overflow-y:auto; background:#111; padding:10px; border:1px solid #333;">
                ${eventi.length === 0 ? '<p style="color:#888;">Nessun evento registrato.</p>' : eventi.map(e => `
                    <div style="padding:6px 0; border-bottom:1px solid #222; ${!e.letto ? 'background:rgba(230,126,34,0.08);' : ''}">
                        <span style="color:#888; font-size:0.75rem;">Ora ${Math.floor(e.ora_gioco / 24)}g ${Math.floor(e.ora_gioco % 24)}h</span>
                        ${e.personaggio_nome ? `<strong style="color:#f1c40f;"> ${escapeHtml(e.personaggio_nome)}:</strong>` : ''}
                        <span>${escapeHtml(e.messaggio)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="modal-footer">
                <button class="btn-big btn-confirm" onclick="window._segnaEventiLettiEChiudi()">SEGNA COME LETTI E CHIUDI</button>
            </div>
        </div>`;
    modal.style.display = 'block';
    return nonLetti.length;
};

window._segnaEventiLettiEChiudi = async function() {
    await segnaEventiLetti(getCampoBaseId());
    chiudiModal('modal-log-eventi');
};

// Wrapper a Promise, per poter fare `const campo = await window.chiediCampoBase();`
window.chiediCampoBase = function() {
    return new Promise((resolve) => {
        window.apriSelezioneCampoBase((campo) => resolve(campo));
        // Se l'utente annulla il modal senza scegliere, non risolviamo: il chiamante
        // resta in attesa finché non sceglie o ricarica la pagina. Per gestire l'annullo
        // esplicito, aggiungiamo un listener sul bottone ANNULLA.
        const btnAnnulla = document.querySelector('#modal-campo-base .btn-cancel');
        if (btnAnnulla) {
            btnAnnulla.addEventListener('click', () => resolve(null), { once: true });
        }
    });
};

// --- MASTER: cambia il campo base di UN personaggio specifico ---
window.masterCambiaCampoPersonaggio = async function(idx) {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user || user.role !== 'master') return;
    const p = window.party[idx];
    if (!p || !p.id) return alert('Personaggio non valido.');

    const campiBase = await fetchCampiBase();
    const origineId = p.campoBaseId || getCampoBaseId();
    const altri = campiBase.filter(c => c.id !== origineId);
    if (!altri.length) return alert('Non ci sono altri campi base disponibili.');

    const lista = altri.map((c, i) => `${i}) ${c.nome} (${c.pg_attivi} pg attivi)`).join('\n');
    const scelta = parseInt(prompt(`Sposta "${p.nome}" in quale campo base?\n${lista}`, '0'));
    const target = altri[scelta];
    if (!target) return;

    try {
        const res = await fetch(apiUrl(`/api/personaggi/${p.id}`), {
            method: 'PUT',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ data: JSON.stringify(p), campoBaseId: target.id })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Errore spostamento');
        }
        const ora = Number(window.oreTotali) || 0;
        await registraEvento(origineId, `Ha lasciato il campo per "${target.nome}".`, 'avviso', p.nome, ora);
        await registraEvento(target.id, `È arrivato dal campo precedente.`, 'info', p.nome, ora);
        // Il personaggio non appartiene più al campo visualizzato: rimuovilo dalla vista corrente
        window.party.splice(idx, 1);
        notifica(`${p.nome} spostato in "${target.nome}".`, 'successo');
        if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
    } catch (e) {
        alert('Errore: ' + e.message);
    }
};

// --- MASTER: cambia l'intera visuale (quale campo base sta guardando il master) ---
window.masterCambiaCampoVisuale = async function() {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user || user.role !== 'master') return;

    const campo = await window.chiediCampoBase();
    if (!campo) return;

    notifica(`Visuale cambiata: ora stai guardando "${campo.nome}".`, 'info');
    await window.ricaricaCampoCorrente();
};

// Ricarica party + magazzino per il campo attualmente selezionato (usata sia dal master
// dopo il cambio visuale, sia potenzialmente da un giocatore in futuro).
window.ricaricaCampoCorrente = async function() {
    window.party.length = 0;
    if (typeof window.caricaPartyMaster === 'function' && window.getCurrentUser()?.role === 'master') {
        await window.caricaPartyMaster();
    } else if (typeof window.syncPartyFromServer === 'function') {
        await window.syncPartyFromServer();
    }
    if (typeof window.syncMagazzinoDalServer === 'function') {
        await window.syncMagazzinoDalServer();
    }
    window.aggiornaDisplayCampoBase && window.aggiornaDisplayCampoBase();
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
};

window.aggiornaDisplayCampoBase = function() {
    const el = document.getElementById('display-campo-base');
    if (el && window.campoBaseCorrente) el.textContent = window.campoBaseCorrente.nome;
};

// Un giocatore deve atterrare nel campo del suo personaggio, non su campi[0]:
// /api/campi li elenca tutti, senza filtro per utente.
async function campoDelPersonaggioDellUtente() {
    const user = getCurrentUser();
    if (!user || user.role === 'master' || user.role === 'ospite') return null;
    try {
        const personaggi = await fetchUserCharacters();
        const vivo = personaggi.find(c => c.status === 'vivo' && Number.isInteger(c.campo_base_id));
        return vivo ? vivo.campo_base_id : null;
    } catch {
        return null;
    }
}

window.initCampoBaseCorrenteUI = async function(preferredId = null) {
    const idPreferito = preferredId ?? await campoDelPersonaggioDellUtente();
    const idRichiesto = idPreferito ?? getCampoBaseId();
    const campo = await initCampoBaseCorrente(idPreferito);
    window.aggiornaDisplayCampoBase();
    if (campo && campo.id !== idRichiesto) {
        notifica(`Il campo base precedente non è più disponibile: sei su "${campo.nome}".`, 'avviso');
    }
    return campo;
};
