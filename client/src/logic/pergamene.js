// pergamene.js
// Gestione trascrizione, uso e consumo per studio delle pergamene.

function generaIdPergamena() {
    return `perg-${Date.now()}-${Math.floor(Math.random() * 99999)}`;
}

function trovaPergamenaOvunque(uid) {
    const party = window.party || [];
    for (const p of party) {
        p.initInventarioBase && p.initInventarioBase();
        p.inventario.pergamenePersonali = p.inventario.pergamenePersonali || [];
        const idx = p.inventario.pergamenePersonali.findIndex(x => x.id === uid);
        if (idx !== -1) return { pergamena: p.inventario.pergamenePersonali[idx], collection: p.inventario.pergamenePersonali, index: idx, owner: p };
    }
    window.magazzino.pergamene = window.magazzino.pergamene || [];
    const idxM = window.magazzino.pergamene.findIndex(x => x.id === uid);
    if (idxM !== -1) return { pergamena: window.magazzino.pergamene[idxM], collection: window.magazzino.pergamene, index: idxM, owner: null };
    return null;
}
window.trovaPergamenaOvunque = trovaPergamenaOvunque;

// --- MODALE: Gestione Pergamene ---
window.apriPergamene = function(idx) {
    const p = window.party[idx];
    if (!p) return;
    let modal = document.getElementById('modal-pergamene');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-pergamene';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div class="modal-content" style="max-width:560px;">
            <h2 style="color:#d4a017;">📜 Pergamene</h2>
            <div id="pergamene-content" style="text-align:left; max-height:460px; overflow-y:auto; background:#111; padding:10px; border:1px solid #333;"></div>
            <div class="modal-footer">
                <button class="btn-big btn-cancel" onclick="chiudiModal('modal-pergamene')">CHIUDI</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    window.renderPergameneModal(idx);
    modal.style.display = 'block';
};

window.renderPergameneModal = function(idx) {
    const p = window.party[idx];
    const container = document.getElementById('pergamene-content');
    if (!p || !container) return;
    p.initInventarioBase();
    p.inventario.pergamenePersonali = p.inventario.pergamenePersonali || [];
    const personali = p.inventario.pergamenePersonali.map(x => ({ ...x, luogo: 'personale' }));
    const base = (window.magazzino.pergamene || []).filter(x => !p.inSpedizione).map(x => ({ ...x, luogo: 'base' }));
    const tutte = [...personali, ...base];

    const puoIncantare = !p.isRobot || (window.hasPerk && window.hasPerk(p, 'Incantatore'));

    let html = '';
    if (puoIncantare) {
        html += `<div style="margin-bottom:12px;">
            <button class="btn-hero" onclick="window.apriTrascriviPergamena(${idx})">✍️ Trascrivi una pergamena vuota</button>
        </div>`;
    }

    if (tutte.length === 0) {
        html += `<p style="color:#aaa;">Nessuna pergamena disponibile.</p>`;
    } else {
        html += `<div style="display:grid; gap:8px;">`;
        tutte.forEach(perg => {
            if (perg.tipo === 'vuota') {
                html += `
                <div style="background:#161616; padding:10px; border:1px solid #333; border-radius:4px; display:flex; justify-content:space-between; align-items:center;">
                    <div><strong style="color:#eee;">Pergamena Vuota</strong> <span style="color:#888; font-size:0.8rem;">(${perg.maxLivello ? `max Lv${perg.maxLivello}` : 'nessun limite'}, ${perg.luogo})</span></div>
                    ${perg.luogo === 'base' ? `<button class="btn-hero" style="padding:4px 8px; font-size:0.75rem;" onclick="window.prendiPergamenaDaMagazzino(${idx}, '${perg.id}')">Prendi</button>` : `<button class="btn-hero" style="padding:4px 8px; font-size:0.75rem;" onclick="window.depositaPergamenaInMagazzino(${idx}, '${perg.id}')">Deposita</button>`}
                </div>`;
            } else {
                html += `
                <div style="background:#1a1a2e; padding:10px; border:1px solid #444; border-radius:4px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <div><strong style="color:#d4a017;">📜 ${perg.spellNome}</strong> <span style="color:#888; font-size:0.8rem;">(Lv${perg.livello}, ${perg.luogo})</span></div>
                    <div style="display:flex; gap:4px; flex-wrap:wrap;">
                        <button class="btn-hero" style="padding:4px 8px; font-size:0.75rem;" onclick="window.usaPergamenaScritta(${idx}, '${perg.id}')">Lancia</button>
                        <button class="btn-hero" style="padding:4px 8px; font-size:0.75rem;" onclick="window.consumaPergamenaPerStudio(${idx}, '${perg.id}')">Studia</button>
                        ${perg.luogo === 'base' ? `<button class="btn-hero" style="padding:4px 8px; font-size:0.75rem;" onclick="window.prendiPergamenaDaMagazzino(${idx}, '${perg.id}')">Prendi</button>` : `<button class="btn-hero" style="padding:4px 8px; font-size:0.75rem;" onclick="window.depositaPergamenaInMagazzino(${idx}, '${perg.id}')">Deposita</button>`}
                    </div>
                </div>`;
            }
        });
        html += `</div>`;
    }
    container.innerHTML = html;
};

window.prendiPergamenaDaMagazzino = function(idx, uid) {
    const p = window.party[idx];
    const ctx = trovaPergamenaOvunque(uid);
    if (!p || !ctx || ctx.owner) return;
    ctx.collection.splice(ctx.index, 1);
    p.initInventarioBase();
    p.inventario.pergamenePersonali.push(ctx.pergamena);
    if (typeof window.updateMagazzinoFields === 'function') window.updateMagazzinoFields({ pergamene: window.magazzino.pergamene });
    salvaPersonaggioCloud(p);
    window.renderPergameneModal(idx);
    aggiornaInterfaccia();
};

window.depositaPergamenaInMagazzino = function(idx, uid) {
    const p = window.party[idx];
    const ctx = trovaPergamenaOvunque(uid);
    if (!p || !ctx || !ctx.owner || ctx.owner !== p) return;
    ctx.collection.splice(ctx.index, 1);
    window.magazzino.pergamene = window.magazzino.pergamene || [];
    window.magazzino.pergamene.push(ctx.pergamena);
    if (typeof window.updateMagazzinoFields === 'function') window.updateMagazzinoFields({ pergamene: window.magazzino.pergamene });
    salvaPersonaggioCloud(p);
    window.renderPergameneModal(idx);
    aggiornaInterfaccia();
};

// --- TRASCRIZIONE ---
window.apriTrascriviPergamena = function(idx) {
    const p = window.party[idx];
    if (!p) return;
    p.initInventarioBase();
    p.inventario.pergamenePersonali = p.inventario.pergamenePersonali || [];
    const vuoteDisponibili = [
        ...p.inventario.pergamenePersonali.filter(x => x.tipo === 'vuota').map(x => ({ ...x, luogo: 'personale' })),
        ...(!p.inSpedizione ? (window.magazzino.pergamene || []).filter(x => x.tipo === 'vuota').map(x => ({ ...x, luogo: 'base' })) : [])
    ];
    if (vuoteDisponibili.length === 0) {
        alert('Non hai pergamene vuote disponibili.');
        return;
    }
    const incantesimiConoscibili = (p.incantesimi || []).map(nome => p.getSpellDataByName(nome)).filter(Boolean);
    if (incantesimiConoscibili.length === 0) {
        alert(`${p.nome} non conosce alcun incantesimo da trascrivere.`);
        return;
    }

    const listaPerg = vuoteDisponibili.map((x, i) => `${i}) ${x.maxLivello ? `max Lv${x.maxLivello}` : 'nessun limite'} (${x.luogo})`).join('\n');
    const scP = parseInt(prompt(`Quale pergamena vuota vuoi usare?\n${listaPerg}`, '0'));
    const pergScelta = vuoteDisponibili[scP];
    if (!pergScelta) return;

    const candidatiSpell = incantesimiConoscibili.filter(sp => !pergScelta.maxLivello || sp.livello <= pergScelta.maxLivello);
    if (candidatiSpell.length === 0) {
        alert(`Nessuno dei tuoi incantesimi rientra nel limite di questa pergamena (max Lv${pergScelta.maxLivello}).`);
        return;
    }
    const listaSpell = candidatiSpell.map((sp, i) => `${i}) ${sp.nome} (Lv${sp.livello})`).join('\n');
    const scS = parseInt(prompt(`Quale incantesimo vuoi trascrivere?\n${listaSpell}`, '0'));
    const spellScelto = candidatiSpell[scS];
    if (!spellScelto) return;

    const costoMana = p.getSpellCost ? p.getSpellCost(spellScelto.livello) : 0;
    if (!p.canSpendMana || !p.canSpendMana(costoMana)) {
        alert(`Mana insufficiente per trascrivere "${spellScelto.nome}" (servono ${costoMana} mana).`);
        return;
    }

    if (!confirm(`Trascrivere "${spellScelto.nome}" sulla pergamena? Costa ${costoMana} mana e richiede 4 ore.`)) return;

    p.spendMana(costoMana);

    const ctx = trovaPergamenaOvunque(pergScelta.id);
    if (ctx) ctx.collection.splice(ctx.index, 1);

    const azione = {
        tipo: 'trascrivi_pergamena',
        oreTotali: 4,
        oreRimanenti: 4,
        onComplete: () => {
            const nuovaPergamena = { id: generaIdPergamena(), tipo: 'scritta', livello: spellScelto.livello, spellNome: spellScelto.nome };
            p.initInventarioBase();
            p.inventario.pergamenePersonali.push(nuovaPergamena);
            mostraNotificaInAlto(`${p.nome} ha trascritto "${spellScelto.nome}" su una pergamena.`, 'successo');
            salvaPersonaggioCloud(p);
            aggiornaInterfaccia();
        }
    };
    if (p.azioneCorrente) {
        if (confirm(`${p.nome} sta già facendo altro. Metterlo in coda?`)) p.codaAzioni.push(azione);
        else { p.manaAttuale += costoMana; if (ctx) ctx.collection.push(pergScelta); return; }
    } else {
        p.azioneCorrente = azione;
    }
    salvaPersonaggioCloud(p);
    if (typeof window.updateMagazzinoFields === 'function') window.updateMagazzinoFields({ pergamene: window.magazzino.pergamene });
    mostraNotificaInAlto(`${p.nome} inizia a trascrivere "${spellScelto.nome}" (4h).`, 'info');
    chiudiModal('modal-pergamene');
    aggiornaInterfaccia();
};

// --- USO: lancia l'incantesimo dalla pergamena (chiunque, senza consumo di mana proprio) ---
window.usaPergamenaScritta = function(idx, uid) {
    const p = window.party[idx];
    const ctx = trovaPergamenaOvunque(uid);
    if (!p || !ctx || ctx.pergamena.tipo !== 'scritta') return;
    const spellData = p.getSpellDataByName(ctx.pergamena.spellNome);
    if (!spellData) { alert('Dati incantesimo non trovati.'); return; }
    if (!confirm(`Usare la pergamena per lanciare "${spellData.nome}"? La pergamena verrà bruciata dopo l'uso.`)) return;

    ctx.collection.splice(ctx.index, 1);

    let esitoExtra = '';
    const eff = spellData.effetto || {};
    if (eff.danno) {
        const danno = (typeof rollDiceNotation === 'function') ? rollDiceNotation(eff.danno) : 0;
        esitoExtra = ` Effetto: ${danno} danni da ${eff.dannoTipo || ''} (da applicare manualmente al bersaglio).`;
    } else if (eff.tipo === 'buff_resistenza') {
        esitoExtra = ` Effetto: resistenza a danni contundenti/perforanti/taglienti fino alla fine del prossimo turno.`;
    }
    mostraNotificaInAlto(`📜 ${p.nome} legge la pergamena e lancia "${spellData.nome}"! La pergamena si consuma.${esitoExtra}`, 'successo');

    if (ctx.owner) salvaPersonaggioCloud(ctx.owner);
    else if (typeof window.updateMagazzinoFields === 'function') window.updateMagazzinoFields({ pergamene: window.magazzino.pergamene });

    if (document.getElementById('modal-pergamene')?.style.display === 'block') window.renderPergameneModal(idx);
    aggiornaInterfaccia();
};

// --- STUDIO: consuma per potenziare la prossima sessione di studio di quell'incantesimo ---
window.consumaPergamenaPerStudio = function(idx, uid) {
    const p = window.party[idx];
    const ctx = trovaPergamenaOvunque(uid);
    if (!p || !ctx || ctx.pergamena.tipo !== 'scritta') return;
    if (p.isRobot && !(window.hasPerk && window.hasPerk(p, 'Incantatore'))) {
        alert('I robot possono studiare incantesimi solo con il perk "Incantatore".');
        return;
    }
    if ((p.incantesimi || []).includes(ctx.pergamena.spellNome)) {
        alert(`${p.nome} conosce già "${ctx.pergamena.spellNome}".`);
        return;
    }
    if (!confirm(`Consumare la pergamena per potenziare lo studio di "${ctx.pergamena.spellNome}"? (-20% tempo, +1d8 al prossimo tiro di studio). La pergamena verrà distrutta.`)) return;

    const spellData = p.getSpellDataByName(ctx.pergamena.spellNome);
    if (!spellData) { alert('Dati incantesimo non trovati.'); return; }

    ctx.collection.splice(ctx.index, 1);

    if (!p.studioIncantesimoTarget || p.studioIncantesimoTarget.nome !== spellData.nome) {
        p.studioIncantesimoTarget = { nome: spellData.nome, livello: spellData.livello, sessioniFatte: 0, sessioniRichieste: Math.max(1, spellData.livello) };
    }
    p._pergamenaStudioBonus = p._pergamenaStudioBonus || {};
    p._pergamenaStudioBonus[spellData.nome] = { riduzioneTempo: 0.20, bonusDado: '1d8' };

    mostraNotificaInAlto(`${p.nome} consuma la pergamena: la prossima sessione di studio su "${spellData.nome}" sarà potenziata.`, 'successo');

    if (ctx.owner) salvaPersonaggioCloud(ctx.owner);
    else if (typeof window.updateMagazzinoFields === 'function') window.updateMagazzinoFields({ pergamene: window.magazzino.pergamene });

    if (document.getElementById('modal-pergamene')?.style.display === 'block') window.renderPergameneModal(idx);
    aggiornaInterfaccia();
};