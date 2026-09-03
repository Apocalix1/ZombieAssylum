import { magazzino as stateMagazzino, party, setMagazzino } from "../state.js";
import { apiUrl, buildAuthHeaders } from '../logic/logic.js';
import { salvaPersonaggioCloud, caricaDatiDaLocalStorage, salvaPersonaggioLocalmente } from "../logic/logic.js";

const magazzino = stateMagazzino;
window.magazzino = magazzino;

function loadCharactersForUser() {
    try {
        const u = JSON.parse(localStorage.getItem('utente'));
        if (!u) return [];
        return JSON.parse(localStorage.getItem(`user_chars_${u.username}`) || '[]');
    } catch { return []; }
}

const PORTABILI = ['localizzatore','orologio_timer','torcia_direzionale','cassa_amplificata','innesco','taser','proiettile_frammentazione','pistola_rampino','stivali_molla'];

// Mappa per le risorse del magazzino e dell'inventario
const RESOURCE_MAP = {
    cibo: { label: 'Cibo', key: 'cibo', weightPerUnit: 1 },
    acqua: { label: 'Acqua', key: 'acqua', weightPerUnit: 1 },
    conserve: { label: 'Conserve', key: 'conserve', weightPerUnit: 1 },
    piattiDeliziosi: { label: 'Piatti Deliziosi', key: 'piattiDeliziosi', weightPerUnit: 1 },
    materialiAlchemici: { label: 'Materiali Alchemici', key: 'materialiAlchemici', weightPerUnit: 0.16 },
    ingranaggi: { label: 'Ingranaggi', key: 'ingranaggi', weightPerUnit: 0.1 },
    'medici_base': { label: 'Materiali Medici (base)', key: 'medici_base', weightPerUnit: 0.1 },
    'medici_avanzati': { label: 'Materiali Medici (avanzati)', key: 'medici_avanzati', weightPerUnit: 0.2 },
    'medici_critici': { label: 'Materiali Medici (critici)', key: 'medici_critici', weightPerUnit: 0.3 },
};

function normalizeMagazzinoItems() {
    const items = [];
    for (const [key, info] of Object.entries(RESOURCE_MAP)) {
        let count = 0;
        if (key === 'medici_base') count = magazzino.materialiMedici?.base || 0;
        else if (key === 'medici_avanzati') count = magazzino.materialiMedici?.avanzati || 0;
        else if (key === 'medici_critici') count = magazzino.materialiMedici?.critici || 0;
        else count = magazzino[key] || 0;
        items.push({ ...info, count });
    }
    return items;
}

window.mostraLogMagazzino = function() {
    const log = magazzino.log || [];
    if (log.length === 0) {
        alert('Nessuna operazione registrata.');
        return;
    }
    let msg = '📋 LOG MAGAZZINO\n\n';
    const viste = log.slice(-50).reverse();
    viste.forEach(entry => {
        msg += `${entry.timestamp} – ${entry.personaggio} ${entry.azione} ${entry.quantita} x ${entry.risorsa}\n`;
    });
    alert(msg);
};

function registraLogMagazzino(nomePersonaggio, azione, tipo, quantita) {
    if (!magazzino.logMagazzino) magazzino.logMagazzino = [];
    const logEntry = {
        time: new Date().toISOString(),
        personaggio: nomePersonaggio,
        azione: azione, // 'Deposita' o 'Ritira'
        tipo: tipo,
        quantita: quantita
    };

    // Aggiunge in cima alla lista e mantiene solo le ultime 100 transazioni per non appesantire il server
    magazzino.logMagazzino.unshift(logEntry);
    if (magazzino.logMagazzino.length > 100) {
        magazzino.logMagazzino.pop();
    }

    // Salva il log aggiornato sul server
    updateMagazzinoFields({ logMagazzino: magazzino.logMagazzino });
}

function getPersonaggioRisorse(p) {
    const items = [];
    for (const [key, info] of Object.entries(RESOURCE_MAP)) {
        let count = 0;
        if (key === 'medici_base') count = p.inventario?.medBase || 0;
        else if (key === 'medici_avanzati') count = p.inventario?.medAvanzati || 0;
        else if (key === 'medici_critici') count = p.inventario?.medCritici || 0;
        else if (key === 'materialiAlchemici') count = p.inventario?.alchemici || 0;
        else count = p.inventario?.[key] || 0;
        items.push({ ...info, count });
    }
    return items;
}

function apriGestioneRitorno(idx) {
    const p = party[idx];
    if (!p) return;
    openMagazzino();
    setTimeout(() => {
        const sel = document.getElementById('magazzino-target');
        if (sel) {
            sel.value = idx;
            renderMagazzinoModal();
        }
    }, 30);
    if (typeof window.mostraNotificaInAlto === 'function') {
        window.mostraNotificaInAlto(`${p.nome} è tornato/a: scegli cosa depositare nel magazzino comune.`, 'info');
    }
}
window.apriGestioneRitorno = apriGestioneRitorno;

window.apriInventario = function(idx) {
    const p = party[idx];
    if (!p) return;
    let modal = document.getElementById('modal-inventario');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-inventario';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    const pulsanteMagazzinoOLascia = p.inSpedizione
        ? `<button class="btn-big" style="background:#c0392b;" onclick="apriLasciaIndietroModal(${idx})">🗑️ Lascia indietro</button>`
        : `<button class="btn-big" style="background:#8e44ad;" onclick="chiudiModal('modal-inventario'); apriGestioneRitorno(${idx});">📦 MAGAZZINO</button>`;
    modal.innerHTML = `
        <div class="modal-content" style="max-width:520px;">
            <h2 style="color:#16a085; letter-spacing:2px; margin-bottom:15px;">🎒 INVENTARIO DI ${p.nome.toUpperCase()}</h2>
            ${hasPerk(p, 'Stazione mobile') ? `<div style="margin-top:10px; color:#9b59b6;">🔧 Stazione mobile: ${p.stazioneMobileTotale}/${p.stazioneMobileCapacita}</div>` : ''}
            <div style="text-align:left; max-height:60vh; overflow-y:auto;">${renderInventarioHtml(p)}</div>
            <div class="modal-footer">
                <button class="btn-big" style="background:#2980b9;" onclick="apriDaiOggettoModal(${idx})">🤝 Dai</button>
                ${pulsanteMagazzinoOLascia}
                <button class="btn-big btn-cancel" onclick="chiudiModal('modal-inventario')">CHIUDI</button>
            </div>
        </div>`;
    modal.style.display = 'block';
};

const CHIAVI_TRASFERIBILI = {
    cibo: 'Cibo', acqua: 'Acqua', ingranaggi: 'Ingranaggi', alchemici: 'Materiali Alchemici',
    medBase: 'Medici Base', medAvanzati: 'Medici Avanzati', medCritici: 'Medici Critici',
    batterie: 'Batterie', proiettiliFrammentazione: 'Proiettili Frammentazione'
};

window.apriDaiOggettoModal = function(idx) {
    const p = party[idx];
    if (!p) return;
    p.initInventarioBase();
    const candidati = party.filter((q, i) => i !== idx && !!q.inSpedizione === !!p.inSpedizione);
    if (candidati.length === 0) {
        alert('Nessun personaggio disponibile: puoi dare oggetti solo a chi si trova nella tua stessa posizione (base o spedizione).');
        return;
    }
    const listaDest = candidati.map((c, i) => `${i}) ${c.nome}`).join('\n');
    const sceltaDest = parseInt(prompt(`A chi vuoi dare qualcosa?\n${listaDest}`, '0'));
    const target = candidati[sceltaDest];
    if (!target) return;
    target.initInventarioBase();

    const chiaviDisponibili = Object.entries(CHIAVI_TRASFERIBILI).filter(([k]) => (p.inventario[k] || 0) > 0);
    const armiDisponibili = (p.inventario.armi || []);
    let listaOggetti = chiaviDisponibili.map(([k, label], i) => `${i}) ${label} (hai ${p.inventario[k]})`).join('\n');
    if (armiDisponibili.length) {
        listaOggetti += (listaOggetti ? '\n' : '') + armiDisponibili.map((a, i) => `arma${i}) ${a}`).join('\n');
    }
    if (!listaOggetti) { alert('Non hai nulla da dare.'); return; }

    const scelta = prompt(`Cosa vuoi dare a ${target.nome}?\n${listaOggetti}\n(scrivi il numero, oppure "armaN" per un'arma)`, '0');
    if (scelta === null) return;

    if (scelta.startsWith('arma')) {
        const armaIdx = parseInt(scelta.replace('arma', ''));
        const arma = p.inventario.armi[armaIdx];
        if (!arma) return alert('Arma non trovata.');
        p.inventario.armi.splice(armaIdx, 1);
        target.inventario.armi.push(arma);
        mostraNotificaInAlto(`${p.nome} ha dato "${arma}" a ${target.nome}.`, 'successo');
    } else {
        const i = parseInt(scelta);
        const entry = chiaviDisponibili[i];
        if (!entry) return alert('Scelta non valida.');
        const [chiave, label] = entry;
        const qtaStr = prompt(`Quanto ${label} vuoi dare? (max ${p.inventario[chiave]})`, '1');
        const qta = parseFloat(qtaStr);
        if (isNaN(qta) || qta <= 0 || qta > p.inventario[chiave]) return alert('Quantità non valida.');
        p.inventario[chiave] -= qta;
        target.inventario[chiave] = (target.inventario[chiave] || 0) + qta;
        mostraNotificaInAlto(`${p.nome} ha dato ${qta} ${label} a ${target.nome}.`, 'successo');
    }

    salvaPersonaggioCloud(p);
    salvaPersonaggioCloud(target);
    aggiornaInterfaccia();
    window.apriInventario(idx);
};

window.apriLasciaIndietroModal = function(idx) {
    const p = party[idx];
    if (!p || !p.inSpedizione) return;
    p.initInventarioBase();

    const chiaviDisponibili = Object.entries(CHIAVI_TRASFERIBILI).filter(([k]) => (p.inventario[k] || 0) > 0);
    const armiDisponibili = (p.inventario.armi || []);
    let lista = chiaviDisponibili.map(([k, label], i) => `${i}) ${label} (hai ${p.inventario[k]})`).join('\n');
    if (armiDisponibili.length) {
        lista += (lista ? '\n' : '') + armiDisponibili.map((a, i) => `arma${i}) ${a}`).join('\n');
    }
    if (!lista) { alert('Non hai nulla da lasciare indietro.'); return; }

    const scelta = prompt(`⚠️ Gli oggetti lasciati indietro andranno persi per sempre.\nCosa vuoi abbandonare?\n${lista}`, '0');
    if (scelta === null) return;

    if (scelta.startsWith('arma')) {
        const armaIdx = parseInt(scelta.replace('arma', ''));
        const arma = p.inventario.armi[armaIdx];
        if (!arma) return alert('Arma non trovata.');
        if (!confirm(`Abbandonare definitivamente "${arma}"?`)) return;
        p.inventario.armi.splice(armaIdx, 1);
        mostraNotificaInAlto(`${p.nome} ha abbandonato: ${arma}.`, 'avviso');
    } else {
        const i = parseInt(scelta);
        const entry = chiaviDisponibili[i];
        if (!entry) return alert('Scelta non valida.');
        const [chiave, label] = entry;
        const qtaStr = prompt(`Quanto ${label} vuoi abbandonare? (max ${p.inventario[chiave]})`, '1');
        const qta = parseFloat(qtaStr);
        if (isNaN(qta) || qta <= 0 || qta > p.inventario[chiave]) return alert('Quantità non valida.');
        if (!confirm(`Abbandonare definitivamente ${qta} ${label}?`)) return;
        p.inventario[chiave] -= qta;
        mostraNotificaInAlto(`${p.nome} ha abbandonato ${qta} ${label}.`, 'avviso');
    }

    salvaPersonaggioCloud(p);
    aggiornaInterfaccia();
    window.apriInventario(idx);
};

window.prendiOggettoMagicoDaMagazzino = function(idx, uid) {
    const p = party[idx];
    if (!p) return;
    const ctx = window.trovaIstanzaOggettoMagico(uid);
    if (!ctx || ctx.owner) return alert('Oggetto non trovato in magazzino.');
    p.initInventarioBase();
    ctx.collection.splice(ctx.index, 1);
    p.inventario.oggettiMagiciPersonali.push(ctx.istanza);
    mostraNotificaInAlto(`${p.nome} ha preso "${window.getOggettoMagicoDef(ctx.istanza.defId)?.nome}" dal magazzino.`, 'successo');
    salvaPersonaggioCloud(p);
    renderMagazzinoModal();
    aggiornaInterfaccia();
};

window.depositaOggettoMagicoInMagazzino = function(idx, uid) {
    const p = party[idx];
    if (!p) return;
    const ctx = window.trovaIstanzaOggettoMagico(uid);
    if (!ctx || !ctx.owner || ctx.owner !== p) return alert('Oggetto non trovato nel tuo inventario.');
    ctx.collection.splice(ctx.index, 1);
    window.magazzino.oggettiMagiciIstanze = window.magazzino.oggettiMagiciIstanze || [];
    window.magazzino.oggettiMagiciIstanze.push(ctx.istanza);
    mostraNotificaInAlto(`${p.nome} ha depositato "${window.getOggettoMagicoDef(ctx.istanza.defId)?.nome}" in magazzino.`, 'successo');
    salvaPersonaggioCloud(p);
    renderMagazzinoModal();
    aggiornaInterfaccia();
};

function openMagazzino() {
    const modal = document.getElementById('modal-magazzino');
    if (!modal) return;
    const sel = document.getElementById('magazzino-target');
    if (!sel) return;

    // Popola il selettore con i personaggi del party
    sel.innerHTML = '';
    if (party.length) {
        party.forEach((p, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = p.nome;
            sel.appendChild(opt);
        });
    } else {
        // Se non ci sono personaggi in party, fallback su localStorage (ma meglio non usare)
        const localNames = loadCharactersForUser();
        localNames.forEach((n, idx) => {
            const opt = document.createElement('option');
            opt.value = `local-${idx}`;
            opt.textContent = n + ' (locale)';
            sel.appendChild(opt);
        });
    }
    renderMagazzinoModal();
    modal.style.display = 'flex';
}

window.consumaConsumabileMagazzino = function(itemIdx) {
    const item = (window.magazzino.consumabili || [])[itemIdx];
    if (!item) return;
    const nomi = party.map((p, i) => `${i}) ${p.nome}`).join('\n');
    const scelta = parseInt(prompt(`Chi consuma "${item.nome || item}"?\n${nomi}`, '0'));
    const target = party[scelta];
    if (!target) return;
    window.magazzino.consumabili.splice(itemIdx, 1);
    target.registraConsumoConsumabile(item.nome || item);
    mostraNotificaInAlto(`${target.nome} ha consumato dal magazzino: ${item.nome || item}.`, 'info');
    if (typeof window.updateMagazzinoFields === 'function') {
        window.updateMagazzinoFields({ consumabili: window.magazzino.consumabili });
    }
    salvaPersonaggioCloud(target);
    renderMagazzinoModal();
    aggiornaInterfaccia();
};

function renderMagazzinoModal() {
    const list = document.getElementById('magazzino-list');
    if (!list) return;
    const targetSelect = document.getElementById('magazzino-target');
    const idx = parseInt(targetSelect?.value);
    if (isNaN(idx) || idx < 0 || idx >= window.party.length) {
        list.innerHTML = '<p style="color:#aaa;">Seleziona un personaggio valido.</p>';
        return;
    }
    const p = window.party[idx];

    const magazzinoItems = normalizeMagazzinoItems();
    const personaggioItems = getPersonaggioRisorse(p);

    let html = `
        <div style="margin-bottom:12px; color:#ddd;">
            <strong>${p.nome}</strong> - Capacità: ${p.capacitaMax || 0} / Peso: ${p.pesoAttuale?.toFixed(1) || 0}
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
            <div>
                <h4 style="color:#f1c40f;">🏚️ Magazzino</h4>
                ${magazzinoItems.map(it => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid #222;">
                        <div><strong>${it.label}</strong> <span style="color:#aaa;">(${it.count})</span></div>
                        <div>
                            <button class="btn-hero" onclick="ritiraRisorsa(${idx}, '${it.key}')" ${it.count > 0 ? '' : 'disabled'}>Prendi</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div>
                <h4 style="color:#2ecc71;">🎒 ${p.nome}</h4>
                ${personaggioItems.map(it => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid #222;">
                        <div><strong>${it.label}</strong> <span style="color:#aaa;">(${it.count})</span></div>
                        <div>
                            <button class="btn-hero" style="background:#c0392b;" onclick="depositaRisorsa(${idx}, '${it.key}')" ${it.count > 0 ? '' : 'disabled'}>Deposita</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // Composti alchemici
    html += `
    <div style="margin-top:16px;">
        <h4 style="color:#9b59b6;">⚗️ Composti Alchemici (Magazzino)</h4>
        <div style="display:grid; gap:6px;">
            ${(window.magazzino.compounds || []).map((c, ci) => {
        const user = window.getCurrentUser ? window.getCurrentUser() : null;
        const isMaster = user && user.role === 'master';
        let destinatari = isMaster ? window.party : window.party.filter(p => p.user_id === user?.id);
        const autoGive = destinatari.length === 1 ? `onclick="daiCompostoAPersonaggio(${destinatari[0]?.id ?? -1}, ${ci})"` : '';
        let selectHtml = '';
        if (destinatari.length > 1) {
            selectHtml = `
                        <select id="dest-select-${ci}" style="background:#222;color:white;border:1px solid #444;padding:4px;">
                            ${destinatari.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}
                        </select>
                        <button class="btn-hero" onclick="daiCompostoASelezionato(${ci})">Dai</button>
                    `;
        } else if (destinatari.length === 1) {
            selectHtml = `<button class="btn-hero" ${autoGive}>Dai a ${destinatari[0].nome}</button>`;
        } else {
            selectHtml = '<span style="color:#888;">Nessun personaggio disponibile</span>';
        }
        return `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:6px; border:1px solid #333;">
                        <div><strong>${c.nome}</strong> <span style="color:${c.qualita==='tossico'?'#e74c3c':c.qualita==='instabile'?'#f39c12':'#2ecc71'};">(${c.qualita})</span></div>
                        <div style="display:flex; gap:4px; align-items:center;">
                            <button class="btn-hero" onclick="consumaComposto(${ci})">Consuma</button>
                            ${selectHtml}
                        </div>
                    </div>`;
    }).join('') || '<div style="color:#888;">Nessun composto in magazzino.</div>'}
        </div>
    </div>`;
    html += `
    <div style="margin-top:16px;">
        <h4 style="color:#c9a876;">🧪 Consumabili (Base)</h4>
        <div style="display:grid; gap:6px;">
            ${(window.magazzino.consumabili || []).map((c, ci) => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:6px; border:1px solid #333;">
                    <span>${c.nome || c}</span>
                    <button class="btn-hero" style="padding:3px 8px; font-size:0.75rem;" onclick="window.consumaConsumabileMagazzino(${ci})">Consuma</button>
                </div>
            `).join('') || '<div style="color:#888;">Nessun consumabile in magazzino.</div>'}
        </div>
    </div>`;
    const currentUserForMagic = window.getCurrentUser ? window.getCurrentUser() : null;
const isMasterForMagic = currentUserForMagic && currentUserForMagic.role === 'master';
html += `
<div style="margin-top:16px;">
    <h4 style="color:#8e44ad;">🔮 Oggetti Magici (Magazzino)</h4>
    <div style="display:grid; gap:6px;">
        ${(window.magazzino.oggettiMagiciIstanze || []).map((istanza, ii) => {
            const def = window.getOggettoMagicoDef(istanza.defId);
            if (!def) return '';
            const infoHtml = `<div><strong>${def.nome}</strong>
                <span style="color:#aaa; font-size:0.8rem;"> (${window.RARITY_LABELS[def.rarita]}, ${istanza.cariche}/${istanza.caricheMax} cariche)</span></div>`;
            if (isMasterForMagic) {
                return `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:6px; border:1px solid #333;">
                    ${infoHtml}
                    <div style="display:flex; gap:4px; align-items:center;">
                        <select id="oggmagico-dest-${ii}" style="background:#222;color:white;border:1px solid #444;padding:4px;">
                            ${party.map(p2 => `<option value="${p2.id}">${p2.nome}</option>`).join('')}
                        </select>
                        <button class="btn-hero" onclick="window.daiOggettoMagicoAPersonaggio('${istanza.uid}', document.getElementById('oggmagico-dest-${ii}').value)">Dai</button>
                    </div>
                </div>`;
            }
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:6px; border:1px solid #333;">
                    ${infoHtml}
                    <button class="btn-hero" onclick="window.prendiOggettoMagicoDaMagazzino(${idx}, '${istanza.uid}')">Prendi</button>
                </div>`;
        }).join('') || '<div style="color:#888;">Nessun oggetto magico in magazzino.</div>'}
    </div>
</div>`;
    html += `
    <div style="margin-top:16px;">
        <h4 style="color:#9b59b6;">🏗️ Dispositivi della Base</h4>
        <div style="display:grid; gap:6px;">
            ${(window.magazzino.congegniFissi || []).map(c => `
                <div style="background:#111; padding:6px; border:1px solid #333;">
                    <strong>${c.nome}</strong> ${c.dettagli || ''}
                </div>
            `).join('') || '<div style="color:#888;">Nessun congegno fisso.</div>'}
            ${Object.entries(window.magazzino.congegniConteggio || {}).filter(([n, q]) => q > 0).map(([nome, qta]) => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:6px; border:1px solid #333;">
                    <span><strong>${nome}</strong> x${qta}</span>
                    ${PORTABILI.includes(nome) ? `<button class="btn-hero" onclick="ritiraOggettoPortatile(${idx}, '${nome}')">Prendi</button>` : ''}
                </div>
            `).join('') || '<div style="color:#888;">Nessun dispositivo a conteggio.</div>'}
        </div>
    </div>`;

    list.innerHTML = html;
}

window.daiCompostoASelezionato = function(compIdx) {
    const select = document.getElementById(`dest-select-${compIdx}`);
    if (!select) return;
    const personaggioId = parseInt(select.value);
    const target = window.party.find(p => p.id === personaggioId);
    if (!target) return;
    const idx = window.party.indexOf(target);
    daiCompostoAPersonaggio(idx, compIdx);
};

window.daiCompostoASelezionato = function(compIdx) {
    const select = document.getElementById(`dest-select-${compIdx}`);
    if (!select) return;
    const personaggioId = parseInt(select.value);
    const target = window.party.find(p => p.id === personaggioId);
    if (!target) return;
    const idx = window.party.indexOf(target);
    daiCompostoAPersonaggio(idx, compIdx);
};

window.daiOggettoMagicoAPersonaggio = function(uid, personaggioId) {
    const target = party.find(p2 => p2.id === parseInt(personaggioId));
    if (!target) return alert('Personaggio non trovato.');
    const ctx = window.trovaIstanzaOggettoMagico(uid);
    if (!ctx || ctx.owner) return alert('Oggetto non trovato in magazzino.');
    ctx.collection.splice(ctx.index, 1);
    target.initInventarioBase();
    target.inventario.oggettiMagiciPersonali.push(ctx.istanza);
    mostraNotificaInAlto(`${target.nome} ha ricevuto "${window.getOggettoMagicoDef(ctx.istanza.defId)?.nome}" dal Master.`, 'successo');
    salvaPersonaggioCloud(target);
    renderMagazzinoModal();
    aggiornaInterfaccia();
};

window.produciVeleno = function(idx) {
    const p = party[idx];
    if (!p) return;
    if (!hasPerk(p, 'Produrre veleni')) return alert('Non hai il perk Produrre veleni.');
    const perkObj = (p.perks || []).find(pk => (typeof pk === 'string' ? pk : pk.nome) === 'Produrre veleni');
    const tipoVeleno = perkObj && perkObj.tipoVeleno;
    if (!tipoVeleno) return alert('Il tipo di veleno non è stato impostato per questo perk.');
    if (p.sete < 0.2) return alert(`${p.nome} non ha abbastanza acqua nella barra Sete per produrre veleno (serve 0.2).`);
    p.sete = Math.max(0, p.sete - 0.2);
    p.initInventarioBase();
    p.inventario.consumabili = p.inventario.consumabili || [];
    p.inventario.consumabili.push({ nome: `5ml di veleno ${tipoVeleno}`, tipo: 'veleno', veleno: tipoVeleno });
    mostraNotificaInAlto(`${p.nome} produce 5ml di veleno (${tipoVeleno}). Sete -0.2.`, 'successo');
    salvaPersonaggioCloud(p);
    aggiornaInterfaccia();
};

window.depositaVelenoInMagazzino = function(idx, itemIdx) {
    const p = party[idx];
    if (!p || !p.inventario || !p.inventario.consumabili || !p.inventario.consumabili[itemIdx]) return;
    const item = p.inventario.consumabili[itemIdx];
    if (item.tipo !== 'veleno') return;
    p.inventario.consumabili.splice(itemIdx, 1);
    window.magazzino.consumabili = window.magazzino.consumabili || [];
    window.magazzino.consumabili.push(item);
    if (typeof window.updateMagazzinoFields === 'function') {
        window.updateMagazzinoFields({ consumabili: window.magazzino.consumabili });
    }
    mostraNotificaInAlto(`${p.nome} deposita "${item.nome}" in magazzino.`, 'successo');
    salvaPersonaggioCloud(p);
    aggiornaInterfaccia();
};

window.daiCompostoASelezionato = function(compIdx) {
    const select = document.getElementById(`dest-select-${compIdx}`);
    if (!select) return;
    const personaggioId = parseInt(select.value);
    const target = party.find(p => p.id === personaggioId);
    if (!target) return;
    const idx = party.indexOf(target);
    daiCompostoAPersonaggio(idx, compIdx);
};

function ritiraRisorsa(idx, key) {
    const p = party[idx];
    if (!p) return;
    const info = RESOURCE_MAP[key];
    if (!info) return;
    const qty = prompt(`Quanto ${info.label} vuoi prendere? (max ${magazzino[key] || 0})`, "1");
    const amount = parseInt(qty);
    if (isNaN(amount) || amount <= 0) return;
    if (amount > (magazzino[key] || 0)) {
        alert('Non c\'è abbastanza nel magazzino.');
        return;
    }
    // Chiama direttamente la funzione (ora esiste)
    ritiraDaMagazzino(idx, key, amount);
}

function ritiraOggettoPortatile(idx, nome) {
    const p = party[idx];
    if (!p) return;
    if (magazzino.congegniConteggio[nome] <= 0) return;
    // Controllo capacità (peso)
    const peso = 0.5; // peso stimato
    if (p.pesoAttuale + peso > p.capacitaMax) {
        alert(`${p.nome} non ha abbastanza capacità per portare ${nome}.`);
        return;
    }
    p.inventario.armi.push(nome);
    magazzino.congegniConteggio[nome]--;
    aggiornaInterfaccia();
    mostraNotificaInAlto(`${p.nome} ha preso ${nome} dal magazzino.`, 'successo');
}

function depositaRisorsa(idx, key) {
    const p = party[idx];
    if (!p) return;
    const info = RESOURCE_MAP[key];
    if (!info) return;
    const qty = prompt(`Quanto ${info.label} vuoi depositare? (max ${p.inventario?.[key] || 0})`, "1");
    const amount = parseInt(qty);
    if (isNaN(amount) || amount <= 0) return;
    if (amount > (p.inventario?.[key] || 0)) {
        alert('Non hai abbastanza di questa risorsa.');
        return;
    }
    // Chiama direttamente la funzione (ora esiste)
    depositaInMagazzino(idx, key, amount);
}

export async function updateMagazzinoFields(fields) {
    try {
        const campoId = window.getCampoBaseId ? window.getCampoBaseId() : 1;
        const res = await fetch(apiUrl(`/api/magazzino?campoBaseId=${campoId}`), {
            method: 'PUT',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ data: fields })
        });
        if (res.ok) {
            const data = await res.json();
            // Aggiorna il magazzino locale
            if (data.magazzino && data.magazzino.data) {
                Object.assign(magazzino, data.magazzino.data);
            }
            if (typeof window.aggiornaInterfaccia === 'function') {
                window.aggiornaInterfaccia();
            }
        } else {
            console.error('Errore aggiornamento magazzino');
        }
    } catch (e) {
        console.error('Errore di rete:', e);
    }
}

function depositaInMagazzino(idx, tipo, quantita) {
    const p = party[idx];
    if (!p) return alert('Personaggio non trovato.');

    // Verifica che l'inventario esista
    p.initInventarioBase();

    // Mappa tra chiavi del magazzino e chiavi dell'inventario
    const mapInventario = {
        'medici_base': 'medBase',
        'medici_avanzati': 'medAvanzati',
        'medici_critici': 'medCritici',
        'cibo': 'cibo',
        'acqua': 'acqua',
        'conserve': 'conserve',
        'piattiDeliziosi': 'piattiDeliziosi',
        'materialiAlchemici': 'alchemici',
        'ingranaggi': 'ingranaggi'
    };

    const invKey = mapInventario[tipo];
    if (!invKey) return alert(`Tipo risorsa non riconosciuto: ${tipo}`);

    // Verifica che il personaggio abbia abbastanza risorse
    const disponibile = p.inventario[invKey] || 0;
    if (disponibile < quantita) {
        return alert(`Non hai abbastanza ${tipo} nell'inventario. (Disponibile: ${disponibile})`);
    }

    // Sottrai dal personaggio
    p.inventario[invKey] -= quantita;

    // Aggiungi al magazzino (gestisce i materiali medici annidati)
    if (tipo.startsWith('medici_')) {
        const tipoMed = tipo.replace('medici_', '');
        if (!magazzino.materialiMedici) magazzino.materialiMedici = { base: 0, avanzati: 0, critici: 0 };
        magazzino.materialiMedici[tipoMed] = (magazzino.materialiMedici[tipoMed] || 0) + quantita;
    } else {
        magazzino[tipo] = (magazzino[tipo] || 0) + quantita;
    }
    magazzino.logMovimenti = magazzino.logMovimenti || [];
    magazzino.logMovimenti.push({
        oraGioco: window.oreTotali || 0,
        personaggio: p.nome,
        tipo: 'deposito', // oppure 'ritiro' nella funzione ritiraDaMagazzino
        risorsa: tipo,
        quantita: quantita
    });
    if (magazzino.logMovimenti.length > 300) magazzino.logMovimenti.shift();
    syncMagazzinoAfterTransfer();
    salvaPersonaggioCloud(p);
    registraLogMagazzino(p.nome, 'Deposita', tipo, quantita);

    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
    renderMagazzinoModal();
    mostraNotificaInAlto(`${p.nome} ha depositato ${quantita} ${tipo} nel magazzino.`, 'successo');
}

/**
 * Ritira una risorsa dal magazzino all'inventario del personaggio
 * @param {number} idx - Indice del personaggio nel party
 * @param {string} tipo - Chiave della risorsa (cibo, acqua, ingranaggi, ecc.)
 * @param {number} quantita - Quantità da ritirare
 */
function ritiraDaMagazzino(idx, tipo, quantita) {
    const p = party[idx];
    if (!p) return alert('Personaggio non trovato.');

    p.initInventarioBase();

    // Verifica disponibilità nel magazzino
    let disponibileMagazzino = 0;
    if (tipo.startsWith('medici_')) {
        const tipoMed = tipo.replace('medici_', '');
        disponibileMagazzino = magazzino.materialiMedici?.[tipoMed] || 0;
    } else {
        disponibileMagazzino = magazzino[tipo] || 0;
    }

    if (disponibileMagazzino < quantita) {
        return alert(`Non c'è abbastanza ${tipo} nel magazzino. (Disponibile: ${disponibileMagazzino})`);
    }

    // Calcola il peso aggiuntivo
    const info = RESOURCE_MAP[tipo];
    if (!info) return alert(`Tipo risorsa non riconosciuto: ${tipo}`);
    const pesoAggiuntivo = quantita * info.weightPerUnit;

    // Verifica capacità del personaggio
    const capacitaDisponibile = p.capacitaMax - p.pesoAttuale;
    if (pesoAggiuntivo > capacitaDisponibile) {
        return alert(`${p.nome} non ha abbastanza capacità per portare ${quantita} ${tipo}. (Capacità disponibile: ${capacitaDisponibile.toFixed(1)})`);
    }

    // Sottrai dal magazzino
    if (tipo.startsWith('medici_')) {
        const tipoMed = tipo.replace('medici_', '');
        magazzino.materialiMedici[tipoMed] -= quantita;
    } else {
        magazzino[tipo] -= quantita;
    }

    // Aggiungi all'inventario del personaggio
    const mapInventario = {
        'medici_base': 'medBase',
        'medici_avanzati': 'medAvanzati',
        'medici_critici': 'medCritici',
        'cibo': 'cibo',
        'acqua': 'acqua',
        'conserve': 'conserve',
        'piattiDeliziosi': 'piattiDeliziosi',
        'materialiAlchemici': 'alchemici',
        'ingranaggi': 'ingranaggi'
    };
    const invKey = mapInventario[tipo];
    if (!invKey) return alert(`Tipo risorsa non riconosciuto: ${tipo}`);
    p.inventario[invKey] = (p.inventario[invKey] || 0) + quantita;
    magazzino.logMovimenti = magazzino.logMovimenti || [];
    magazzino.logMovimenti.push({
        oraGioco: window.oreTotali || 0,
        personaggio: p.nome,
        tipo: 'deposito', // oppure 'ritiro' nella funzione ritiraDaMagazzino
        risorsa: tipo,
        quantita: quantita
    });
    if (magazzino.logMovimenti.length > 300) magazzino.logMovimenti.shift();
    syncMagazzinoAfterTransfer();
    salvaPersonaggioCloud(p);

    // AGGIUNGI QUESTA RIGA QUI
    registraLogMagazzino(p.nome, 'Ritira', tipo, quantita);
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
    renderMagazzinoModal();
    mostraNotificaInAlto(`${p.nome} ha ritirato ${quantita} ${tipo} dal magazzino.`, 'successo');
}

/**
 * Sincronizza il magazzino dopo un trasferimento (usa la nuova route /api/magazzino/transfer)
 */
async function syncMagazzinoAfterTransfer() {
    try {
        // Usa la nuova route per giocatori
        const res = await fetch(apiUrl('/api/magazzino/transfer'), {
            method: 'POST',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                data: {
                    materialiMedici: magazzino.materialiMedici,
                    cibo: magazzino.cibo,
                    acqua: magazzino.acqua,
                    conserve: magazzino.conserve,
                    piattiDeliziosi: magazzino.piattiDeliziosi,
                    materialiAlchemici: magazzino.materialiAlchemici,
                    ingranaggi: magazzino.ingranaggi
                }
            })
        });
        if (!res.ok) {
            console.warn('Errore sincronizzazione magazzino:', await res.text());
        }
    } catch (e) {
        console.warn('Errore di rete durante sincronizzazione magazzino:', e);
    }
}

async function consumaMunizioneAttacco(personaggio, categoria) {
    // Mappa tra categoria arma e tipo di munizione
    const mappa = {
        'Archi': 'frecce',
        'Balestre': 'quadrelli',
        'Armi da fuoco': 'proiettili'
    };
    const tipoMunizione = mappa[categoria];
    if (!tipoMunizione) return true; // non serve munizione

    // Controlla se il personaggio ha munizioni nel suo inventario
    const disponibili = personaggio.inventario?.munizioni?.[tipoMunizione] || 0;
    if (disponibili < 1) {
        alert(`${personaggio.nome} non ha munizioni per ${categoria}!`);
        return false;
    }
    // Consuma 1 munizione
    personaggio.inventario.munizioni[tipoMunizione]--;
    return true;
}

function applicaPerkArmato(p) {
    if (!p) return;
    const nomiPerk = (p.perks || []).map(pk => typeof pk === 'string' ? pk : pk.nome);
    if (!nomiPerk.includes('Armato')) return;

    const categorie = ['Archi', 'Balestre', "Armi con l'asta", 'Lame leggere', 'Armi da fuoco', 'Rampini e fruste', 'Mazze e armi contundenti'];
    const elenco = categorie.map((c, i) => `${i + 1}) ${c}`).join('\n');
    let scelta = prompt(`Perk "Armato": scegli un'arma iniziale (competenza livello 1):\n${elenco}`, '1');
    let idx = parseInt(scelta, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= categorie.length) idx = 0;
    const categoria = categorie[idx];
    p.initInventarioBase();
    p.inventario.armi.push(categoria);
    p.armiLivello = p.armiLivello || {};
    const livelloBase = p.isRobot ? 4 : 1;
    const livelloAttuale = p.armiLivello[categoria] || 0;
    if (!p.isRobot && livelloAttuale >= 1) {
        const costi = window.ARMI_COSTI && window.ARMI_COSTI[categoria];
        const rimborso = costi ? (costi[1] || 1) : 1;
        p.puntiCreazione = (p.puntiCreazione || 0) + rimborso;
        alert(`Avevi già acquistato Livello 1 in ${categoria}: rimborsati ${rimborso} punti, ora fornito gratis dal perk Armato.`);
    }
    p.armiLivello[categoria] = Math.max(livelloBase, livelloAttuale);

    let munText = '';
    if (categoria === 'Archi' || categoria === 'Balestre') {
        p.inventario.munizioni = (typeof p.inventario.munizioni === 'number' ? p.inventario.munizioni : 0) + 10;
        munText = ' e 10 munizioni';
    } else if (categoria === 'Armi da fuoco') {
        p.inventario.munizioni = (typeof p.inventario.munizioni === 'number' ? p.inventario.munizioni : 0) + 3;
        munText = ' e 3 munizioni';
    }

    alert(`${p.nome} inizia con: ${categoria} (competenza livello 1)${munText}.`);
}

window.applicaPerkArmato = applicaPerkArmato;
window.consumaMunizioneAttacco = consumaMunizioneAttacco;
window.updateMagazzinoFields = updateMagazzinoFields;
window.openMagazzino = openMagazzino;
window.ritiraRisorsa = ritiraRisorsa;
window.depositaRisorsa = depositaRisorsa;
window.depositaInMagazzino = depositaInMagazzino;
window.ritiraDaMagazzino = ritiraDaMagazzino;
window.renderMagazzinoModal = renderMagazzinoModal;
window.closeMagazzino = () => {
    const modal = document.getElementById('modal-magazzino');
    if (modal) modal.style.display = 'none';
};