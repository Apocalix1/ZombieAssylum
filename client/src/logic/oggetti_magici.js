// oggetti_magici.js
// Meccanica core: istanze di oggetti magici, uso cariche, forma base, assorbimento energia.

function generaIdOggetto() {
    return 'oggm-' + Date.now() + '-' + Math.floor(Math.random() * 99999);
}

function getDefById(defId) {
    const db = window.DATABASE_OGGETTI_MAGICI || {};
    for (const rarita in db) {
        const found = db[rarita].find(o => o.id === defId);
        if (found) return found;
    }
    return null;
}
window.getOggettoMagicoDef = getDefById;

function pickRandomDefByRarity(rarita) {
    const pool = (window.DATABASE_OGGETTI_MAGICI || {})[rarita] || [];
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

// Crea una nuova istanza (cariche piene) per una data rarità. Ritorna null se non esistono oggetti per quella rarità.
window.creaIstanzaOggettoMagico = function(rarita) {
    const def = pickRandomDefByRarity(rarita);
    if (!def) return null;
    return {
        uid: generaIdOggetto(),
        defId: def.id,
        rarita: def.rarita,
        cariche: def.cariche,
        caricheMax: def.cariche
    };
};

// Cerca un'istanza ovunque possa trovarsi: inventario personale di ogni pg, o magazzino condiviso.
// Ritorna { istanza, collection, index } oppure null.
function trovaIstanzaOvunque(uid) {
    const party = window.party || [];
    for (const p of party) {
        p.initInventarioBase && p.initInventarioBase();
        const list = p.inventario?.oggettiMagiciPersonali || [];
        const idx = list.findIndex(i => i.uid === uid);
        if (idx !== -1) return { istanza: list[idx], collection: list, index: idx, owner: p };
    }
    const magList = window.magazzino?.oggettiMagiciIstanze || [];
    const idxM = magList.findIndex(i => i.uid === uid);
    if (idxM !== -1) return { istanza: magList[idxM], collection: magList, index: idxM, owner: null };
    return null;
}
window.trovaIstanzaOggettoMagico = trovaIstanzaOvunque;

function applicaFormaBase(ctx, def) {
    // Alcuni oggetti (es. armi maledette) tornano a essere un oggetto fisico normale, non una risorsa numerica
    if (def.formaBaseArma) {
        if (ctx.owner) {
            ctx.owner.initInventarioBase();
            ctx.owner.inventario.armi.push(def.formaBaseArma);
            if (typeof window.salvaPersonaggioCloud === 'function') window.salvaPersonaggioCloud(ctx.owner);
        } else {
            window.magazzino.armiTrovate = window.magazzino.armiTrovate || [];
            window.magazzino.armiTrovate.push({ nome: def.formaBaseArma, qta: 1, tipo: 'arma' });
            if (typeof window.updateMagazzinoFields === 'function') {
                window.updateMagazzinoFields({ armiTrovate: window.magazzino.armiTrovate });
            }
        }
        return;
    }

    // Supporta sia una singola voce { chiave, quantita } sia un array di più voci
    const voci = Array.isArray(def.formaBase) ? def.formaBase : [def.formaBase];
    voci.forEach(v => {
        const chiave = v.chiave;
        const qta = v.quantita;
        if (ctx.owner) {
            ctx.owner.initInventarioBase();
            ctx.owner.inventario[chiave] = (ctx.owner.inventario[chiave] || 0) + qta;
        } else {
            if (chiave === 'medBase') window.magazzino.materialiMedici.base = (window.magazzino.materialiMedici.base || 0) + qta;
            else if (chiave === 'medAvanzati') window.magazzino.materialiMedici.avanzati = (window.magazzino.materialiMedici.avanzati || 0) + qta;
            else if (chiave === 'medCritici') window.magazzino.materialiMedici.critici = (window.magazzino.materialiMedici.critici || 0) + qta;
            else if (chiave === 'alchemici') window.magazzino.materialiAlchemici = (window.magazzino.materialiAlchemici || 0) + qta;
            else window.magazzino[chiave] = (window.magazzino[chiave] || 0) + qta;
        }
    });
    if (ctx.owner) {
        if (typeof window.salvaPersonaggioCloud === 'function') window.salvaPersonaggioCloud(ctx.owner);
    } else if (typeof window.updateMagazzinoFields === 'function') {
        window.updateMagazzinoFields({ materialiMedici: window.magazzino.materialiMedici, materialiAlchemici: window.magazzino.materialiAlchemici });
    }
}

// Consuma 1 carica dell'istanza individuata da ctx. Se le cariche finiscono, converte in forma base
// (se riutilizzabileFormaBase) oppure distrugge l'oggetto. Ritorna { def, esaurito, convertito }.
function consumaCaricaCtx(ctx) {
    const istanza = ctx.istanza;
    const def = getDefById(istanza.defId);
    istanza.cariche = Math.max(0, istanza.cariche - 1);
    let esaurito = false, convertito = false;
    if (istanza.cariche <= 0) {
        esaurito = true;
        ctx.collection.splice(ctx.index, 1);
        if (def.riutilizzabileFormaBase) {
            applicaFormaBase(ctx, def);
            convertito = true;
        }
    } else if (ctx.owner) {
        window.salvaPersonaggioCloud && window.salvaPersonaggioCloud(ctx.owner);
    }
    return { def, esaurito, convertito };
}
window.consumaCaricaOggettoMagicoCtx = consumaCaricaCtx;

// Trova le istanze usabili (cariche>0) di un dato effetto, disponibili per il personaggio p
// (nel proprio inventario o nel magazzino condiviso).
window.oggettiMagiciDisponibiliPer = function(p, tipoEffetto) {
    const out = [];
    p.initInventarioBase && p.initInventarioBase();
    (p.inventario?.oggettiMagiciPersonali || []).forEach(i => {
        const def = getDefById(i.defId);
        if (def && def.effetto.tipo === tipoEffetto && i.cariche > 0) out.push({ istanza: i, def, luogo: 'inventario' });
    });
    (window.magazzino?.oggettiMagiciIstanze || []).forEach(i => {
        const def = getDefById(i.defId);
        if (def && def.effetto.tipo === tipoEffetto && i.cariche > 0) out.push({ istanza: i, def, luogo: 'magazzino' });
    });
    return out;
};

// Chiede consenso al giocatore prima di usare un oggetto magico per una specifica azione. Se accetta,
// consuma 1 carica e ritorna l'effetto (def.effetto). Se rifiuta o non ne ha, ritorna null.
window.chiediUsoOggettoMagico = function(p, tipoEffetto, messaggio) {
    const disponibili = window.oggettiMagiciDisponibiliPer(p, tipoEffetto);
    if (!disponibili.length) return null;
    let scelto = disponibili[0];
    if (disponibili.length > 1) {
        const lista = disponibili.map((d, i) => `${i}) ${d.def.nome} (${d.istanza.cariche}/${d.istanza.caricheMax} cariche, ${d.luogo})`).join('\n');
        const sceltaStr = prompt(`${messaggio}\nQuale oggetto vuoi usare? (vuoto = non usare)\n${lista}`, '0');
        if (sceltaStr === null || sceltaStr.trim() === '') return null;
        const idx = parseInt(sceltaStr);
        scelto = disponibili[idx];
        if (!scelto) return null;
    } else {
        const ok = confirm(`${messaggio}\nVuoi usare "${scelto.def.nome}" (${scelto.istanza.cariche}/${scelto.istanza.caricheMax} cariche)?`);
        if (!ok) return null;
    }
    const ctx = trovaIstanzaOvunque(scelto.istanza.uid);
    if (!ctx) return null;
    const { def, esaurito, convertito } = consumaCaricaCtx(ctx);
    if (typeof window.mostraNotificaInAlto === 'function') {
        let msg = `✨ ${p.nome} usa "${def.nome}".`;
        if (convertito) msg += ` Le cariche sono esaurite: è tornato un oggetto normale.`;
        else if (esaurito) msg += ` Le cariche sono esaurite: l'oggetto è andato distrutto.`;
        window.mostraNotificaInAlto(msg, 'successo');
    }
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
    return def.effetto;
};

// Attivazione manuale generica da inventario (bottone "Usa"), per effetti che non sono legati a un'azione
// specifica (es. Benda Accellerante). Applica direttamente l'effetto sul possessore.
window.usaOggettoMagicoDaInventario = function(pIdx, uid) {
    const p = window.party[pIdx];
    if (!p) return;
    const ctx = trovaIstanzaOvunque(uid);
    if (!ctx) return alert('Oggetto non trovato.');
    const defPreview = getDefById(ctx.istanza.defId);
    if (!confirm(`Usare "${defPreview.nome}" (${ctx.istanza.cariche}/${ctx.istanza.caricheMax} cariche)?\n${defPreview.desc}`)) return;

    const { def, esaurito, convertito } = consumaCaricaCtx(ctx);

    if (def.effetto.tipo === 'guarigione_accelerata') {
        p._bendaAccellerataFinoA = (window.oreTotali || 0) + def.effetto.durataOre;
        window.mostraNotificaInAlto(`${p.nome} applica la Benda Accellerante: guarigione +${(def.effetto.percentuale * 100).toFixed(0)}%, fame -${(def.effetto.fameExtraPercentuale * 100).toFixed(0)}% più veloce, per ${def.effetto.durataOre}h.`, 'successo');
    } else {
        window.mostraNotificaInAlto(`${p.nome} usa "${def.nome}".`, 'successo');
    }
    if (esaurito) {
        window.mostraNotificaInAlto(convertito ? `"${def.nome}" è tornato un oggetto normale.` : `"${def.nome}" è andato distrutto.`, 'info');
    }
    if (typeof window.salvaPersonaggioCloud === 'function') window.salvaPersonaggioCloud(p);
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
    if (document.getElementById('modal-inventario')?.style.display === 'block' && typeof window.apriInventario === 'function') {
        window.apriInventario(pIdx);
    }
};

// Stabilizzatore Automatico: controllo passivo, nessun consenso richiesto (è un intervento d'emergenza).
window.checkAutoStabilizzatore = function(p) {
    if (!p || p.isRobot || p.puntiFeritaReali !== 1) return;
    if (p._stabilizzatoFinoA && (window.oreTotali || 0) < p._stabilizzatoFinoA) return;
    p.initInventarioBase && p.initInventarioBase();
    const istanza = (p.inventario.oggettiMagiciPersonali || []).find(i => i.defId === 'stabilizzatore_automatico' && i.cariche > 0);
    if (!istanza) return;
    const ctx = trovaIstanzaOvunque(istanza.uid);
    if (!ctx) return;
    const { def } = consumaCaricaCtx(ctx);
    p._stabilizzatoFinoA = (window.oreTotali || 0) + def.effetto.durataOre;
    if (typeof window.mostraNotificaInAlto === 'function') {
        window.mostraNotificaInAlto(`⚡ Lo Stabilizzatore Automatico di ${p.nome} si attiva! Non degenererà per ${def.effetto.durataOre}h.`, 'avviso');
    }
};

// Assorbe interamente l'energia residua di un'istanza (robot o batterie), in proporzione alle cariche rimaste.
// modalita: 'robot' (ritorna {ore}) oppure 'batteria' (ritorna {batterie}).
window.assorbiEnergiaIstanzaOggetto = function(uid, modalita) {
    const ctx = trovaIstanzaOvunque(uid);
    if (!ctx) return null;
    const istanza = ctx.istanza;
    const def = getDefById(istanza.defId);
    const frazione = istanza.caricheMax > 0 ? (istanza.cariche / istanza.caricheMax) : 0;

    ctx.collection.splice(ctx.index, 1);
    let convertito = false;
    if (def.riutilizzabileFormaBase) {
        applicaFormaBase(ctx, def);
        convertito = true;
    }
    if (typeof window.mostraNotificaInAlto === 'function') {
        window.mostraNotificaInAlto(`⚡ Energia assorbita da "${def.nome}" (${(frazione * 100).toFixed(0)}% cariche residue).${convertito ? ' Tornato oggetto normale.' : ' Consumato.'}`, 'info');
    }

    if (modalita === 'robot') {
        const maxOre = (window.OGGETTI_MAGICI_ORE_ROBOT || {})[def.rarita] || 0;
        return { ore: Math.round(maxOre * frazione * 10) / 10, def };
    }
    const maxBatt = (window.OGGETTI_MAGICI_RESA_BATTERIE || {})[def.rarita] || 0;
    return { batterie: Math.floor(maxBatt * frazione), def };
};

// Robot: versione basata su istanza del vecchio absorbMagicItem(rarity).
// Robot: versione basata su istanza del vecchio absorbMagicItem(rarity).
window.assorbiOggettoMagicoRobot = function(p, uid) {
    if (!p || !p.isRobot) return 0;
    const risultato = window.assorbiEnergiaIstanzaOggetto(uid, 'robot');
    if (!risultato) return 0;
    p.batteryHours = Math.min(p.batteryHoursMax, (p.batteryHours || 0) + risultato.ore);
    return risultato.ore;
};

// --- Candela Nera: si accende automaticamente studiando Arcano/Incantesimi, +1d6 al tiro ---
window.applicaBonusCandelaNeraStudio = function(p) {
    if (!p) return 0;
    p.initInventarioBase();
    const istanza = (p.inventario.oggettiMagiciPersonali || []).find(i => i.defId === 'candela_nera' && i.cariche > 0);
    if (!istanza) return 0;
    const ctx = trovaIstanzaOvunque(istanza.uid);
    if (!ctx) return 0;
    const { esaurito, convertito } = consumaCaricaCtx(ctx);
    const bonus = (typeof rollDiceNotation === 'function') ? rollDiceNotation('1d6') : (Math.floor(Math.random() * 6) + 1);
    if (typeof window.mostraNotificaInAlto === 'function') {
        let msg = `🕯️ La Candela Nera di ${p.nome} si accende: +${bonus} al tiro di studio.`;
        if (esaurito) msg += convertito ? ' Si consuma in materiali.' : ' Va distrutta.';
        window.mostraNotificaInAlto(msg, 'info');
    }
    return bonus;
};

// --- Candela Nera: consumo manuale di una carica per +2 Mana istantanei ---
window.usaCandelaNeraMana = function(idx) {
    const p = window.party[idx];
    if (!p) return;
    p.initInventarioBase();
    const istanza = (p.inventario.oggettiMagiciPersonali || []).find(i => i.defId === 'candela_nera' && i.cariche > 0);
    if (!istanza) return alert('Non hai una Candela Nera con cariche disponibili.');
    if (!confirm('Consumare 1 carica della Candela Nera per ottenere 2 Mana?')) return;
    const ctx = trovaIstanzaOvunque(istanza.uid);
    const { esaurito, convertito } = consumaCaricaCtx(ctx);
    p.manaAttuale = Math.min(p.manaMax, (p.manaAttuale || 0) + 2);
    let msg = `${p.nome} usa la Candela Nera: +2 Mana.`;
    if (esaurito) msg += convertito ? ' La candela si è consumata in materiali.' : ' La candela è andata distrutta.';
    if (typeof window.mostraNotificaInAlto === 'function') window.mostraNotificaInAlto(msg, 'successo');
    if (typeof window.salvaPersonaggioCloud === 'function') window.salvaPersonaggioCloud(p);
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
};

// --- Igienizzatore Magico: azione di 4 ore nella base, poi CD medicazioni -4 per 24h (non sommabile con Ossessione del Pulito) ---
window.usaIgienizzatoreMagico = function(idx) {
    const p = window.party[idx];
    if (!p) return;
    if (p.inSpedizione) { alert('Puoi igienizzare la base solo se ti trovi lì.'); return; }
    const effetto = window.chiediUsoOggettoMagico(p, 'igienizza_magica', `${p.nome} vuole igienizzare magicamente la base`);
    if (!effetto) return;

    const durataAzione = effetto.durataAzioneOre || 4;
    const azione = {
        tipo: 'igienizza_magica',
        oreTotali: durataAzione,
        oreRimanenti: durataAzione,
        onComplete: () => {
            const durataEffetto = effetto.durataEffettoOre || 24;
            window.magazzino.igienizzazioneMagicaFinoA = (window.oreTotali || 0) + durataEffetto;
            if (typeof window.updateMagazzinoFields === 'function') {
                window.updateMagazzinoFields({ igienizzazioneMagicaFinoA: window.magazzino.igienizzazioneMagicaFinoA });
            }
            if (typeof window.mostraNotificaInAlto === 'function') {
                window.mostraNotificaInAlto(`${p.nome} ha igienizzato magicamente la base: CD medicazioni -${effetto.riduzioneCD || 4} per ${durataEffetto}h.`, 'successo');
            }
        }
    };
    if (p.azioneCorrente) {
        if (!confirm(`${p.nome} sta già facendo altro. Metterlo in coda?`)) return;
        p.codaAzioni.push(azione);
    } else {
        p.azioneCorrente = azione;
    }
    if (typeof window.salvaPersonaggioCloud === 'function') window.salvaPersonaggioCloud(p);
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
};

// --- Specchio Meraviglioso: Cammuffare Se Stesso senza consumo di Mana ---
window.usaSpecchioMeraviglioso = function(idx) {
    const p = window.party[idx];
    if (!p) return;
    const effetto = window.chiediUsoOggettoMagico(p, 'cammuffa_gratis', `${p.nome} vuole cammuffarsi con lo Specchio Meraviglioso`);
    if (!effetto) return;
    if (typeof window.mostraNotificaInAlto === 'function') {
        window.mostraNotificaInAlto(`✨ ${p.nome} si è cammuffato grazie allo Specchio Meraviglioso (nessun Mana consumato).`, 'successo');
    }
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
};

// --- MASTER: assegna un oggetto magico a scelta con cariche personalizzate ---
window.apriMasterDaiOggettoMagico = function(idx) {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user || user.role !== 'master') return;
    const p = window.party[idx];
    if (!p) return;

    let modal = document.getElementById('modal-master-oggetto-magico');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-master-oggetto-magico';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const db = window.DATABASE_OGGETTI_MAGICI || {};
    let optionsHtml = '';
    ['comune', 'non_comune', 'raro', 'super_raro'].forEach(rarita => {
        (db[rarita] || []).forEach(def => {
            optionsHtml += `<option value="${def.id}" data-cariche="${def.cariche}">${def.nome} — ${window.RARITY_LABELS[rarita]} (base ${def.cariche} cariche)</option>`;
        });
    });

    modal.innerHTML = `
        <div class="modal-content" style="max-width:480px;">
            <h2 style="color:#8e44ad;">🔮 Dai Oggetto Magico a ${p.nome}</h2>
            <div style="margin-bottom:10px; text-align:left;">
                <label style="color:#ccc;">Oggetto:</label>
                <select id="master-oggmagico-select" style="width:100%; background:#222; color:white; border:1px solid #444; padding:6px;" onchange="window._aggiornaCaricheDefaultMasterOggMagico()">
                    ${optionsHtml}
                </select>
            </div>
            <div style="margin-bottom:10px; text-align:left;">
                <label style="color:#ccc;">Cariche da assegnare:</label>
                <input type="number" id="master-oggmagico-cariche" min="1" value="1" style="width:100%; background:#222; color:white; border:1px solid #444; padding:6px;">
            </div>
            <div class="modal-footer">
                <button class="btn-big btn-cancel" onclick="chiudiModal('modal-master-oggetto-magico')">ANNULLA</button>
                <button class="btn-big btn-confirm" onclick="window.confermaMasterDaiOggettoMagico(${idx})">DAI</button>
            </div>
        </div>`;
    modal.style.display = 'block';
    window._aggiornaCaricheDefaultMasterOggMagico();
};

window._aggiornaCaricheDefaultMasterOggMagico = function() {
    const sel = document.getElementById('master-oggmagico-select');
    const inp = document.getElementById('master-oggmagico-cariche');
    if (!sel || !inp) return;
    const opt = sel.selectedOptions[0];
    if (opt) inp.value = opt.dataset.cariche || 1;
};

window.confermaMasterDaiOggettoMagico = function(idx) {
    const p = window.party[idx];
    const sel = document.getElementById('master-oggmagico-select');
    const inp = document.getElementById('master-oggmagico-cariche');
    if (!p || !sel || !inp) return;
    const defId = sel.value;
    const def = window.getOggettoMagicoDef(defId);
    if (!def) return;
    const cariche = parseInt(inp.value);
    if (isNaN(cariche) || cariche <= 0) { alert('Numero di cariche non valido.'); return; }

    p.initInventarioBase();
    p.inventario.oggettiMagiciPersonali.push({
        uid: generaIdOggetto(),
        defId: def.id,
        rarita: def.rarita,
        cariche,
        caricheMax: cariche
    });
    if (typeof window.mostraNotificaInAlto === 'function') {
        window.mostraNotificaInAlto(`${p.nome} ha ricevuto "${def.nome}" (${cariche} cariche) dal Master.`, 'successo');
    }
    if (typeof window.salvaPersonaggioCloud === 'function') window.salvaPersonaggioCloud(p);
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
    chiudiModal('modal-master-oggetto-magico');
};