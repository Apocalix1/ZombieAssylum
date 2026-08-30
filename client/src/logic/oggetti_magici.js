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
    const chiave = def.formaBase.chiave;
    const qta = def.formaBase.quantita;
    if (ctx.owner) {
        ctx.owner.initInventarioBase();
        ctx.owner.inventario[chiave] = (ctx.owner.inventario[chiave] || 0) + qta;
        if (typeof window.salvaPersonaggioCloud === 'function') window.salvaPersonaggioCloud(ctx.owner);
    } else {
        if (chiave === 'medBase') window.magazzino.materialiMedici.base = (window.magazzino.materialiMedici.base || 0) + qta;
        else if (chiave === 'medAvanzati') window.magazzino.materialiMedici.avanzati = (window.magazzino.materialiMedici.avanzati || 0) + qta;
        else if (chiave === 'medCritici') window.magazzino.materialiMedici.critici = (window.magazzino.materialiMedici.critici || 0) + qta;
        else if (chiave === 'alchemici') window.magazzino.materialiAlchemici = (window.magazzino.materialiAlchemici || 0) + qta;
        else window.magazzino[chiave] = (window.magazzino[chiave] || 0) + qta;
        if (typeof window.updateMagazzinoFields === 'function') {
            window.updateMagazzinoFields({ materialiMedici: window.magazzino.materialiMedici, materialiAlchemici: window.magazzino.materialiAlchemici });
        }
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
window.assorbiOggettoMagicoRobot = function(p, uid) {
    if (!p || !p.isRobot) return 0;
    const risultato = window.assorbiEnergiaIstanzaOggetto(uid, 'robot');
    if (!risultato) return 0;
    p.batteryHours = Math.min(p.batteryHoursMax, (p.batteryHours || 0) + risultato.ore);
    return risultato.ore;
};