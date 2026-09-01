const ALCHIMIA_GRADI = {
    facile:   { cd: 12, tempo: 1, costo: 6,  reqNatura: 'competenza', label: 'Facile' },
    media:    { cd: 16, tempo: 4, costo: 12, reqNatura: 'competenza', label: 'Media'  },
    difficile:{ cd: 22, tempo: 8, costo: 24, reqNatura: 'maestria',   label: 'Difficile' }
};

const party = window.party || [];
const magazzino = window.magazzino || { materialiAlchemici: 0, compounds: [], composti: [], postazioneAlchemica: false, congegniFissi: [], congegniConteggio: {} };
window.magazzino = magazzino;
const mostraNotificaInAlto = (...args) => {
    if (typeof window.mostraNotificaInAlto === 'function') return window.mostraNotificaInAlto(...args);
    console.log(...args);
};
const aggiornaInterfaccia_local = () => {
    if (typeof window.aggiornaInterfaccia === 'function' && window.aggiornaInterfaccia !== aggiornaInterfaccia_local) {
        window.aggiornaInterfaccia();
    }
};

// Ricette integrate dal database ricette.js (window.RICETTE)
function getRicetteDisponibili(p) {
    const rating = p.getSkillRating ? p.getSkillRating('Natura') : 0;
    const haCompetenzaNatura = rating >= 1;
    const haMaestriaNatura = rating === 2;

    const out = [];
    if (!window.RICETTE) return out;

    if (haCompetenzaNatura) {
        (window.RICETTE.facile  || []).forEach(r => out.push({ ...r, grado: 'facile'    }));
        (window.RICETTE.media   || []).forEach(r => out.push({ ...r, grado: 'media'     }));
    }
    if (haMaestriaNatura) {
        (window.RICETTE.difficile || []).forEach(r => out.push({ ...r, grado: 'difficile' }));
    }
    return out;
}

function alchimiaPersonaggio(idx) {
    const p = party[idx];
    if (!p) return;

    if (window.hasPerk && window.hasPerk(p, 'Cieco')) {
        alert('Il tuo personaggio non riesce a vedere abbastanza bene per lavorare con precisione alchemica.');
        return;
    }

    // REGOLE: Obbligatorio disporre di una Postazione da Alchimista
    if (!magazzino.postazioneAlchemica) {
        alert("È obbligatorio disporre di una Postazione da Alchimista per creare composti.");
        return;
    }

    const haMaestriaNatura   = p.masteries && p.masteries.map(m => m.toLowerCase()).includes('natura');
    const haCompetenzaNatura = haMaestriaNatura || p.hasCompetenza('Natura');

    if (!haCompetenzaNatura) {
        alert(`${p.nome} non ha competenza in Natura e non può creare composti alchemici.`);
        return;
    }

    apriAlchimiaModal(idx);
}

function apriAlchimiaModal(idx) {
    let modal = document.getElementById('modal-alchimia');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-alchimia';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="width:560px; max-width:96%;">
                <h2 style="color:#ff0000; letter-spacing:2px; margin-bottom:15px;">⚗️ ALCHIMIA</h2>
                <div id="alchimia-content" style="text-align:left; max-height:460px; overflow-y:auto; background:#111; padding:10px; border:1px solid #333;"></div>
                <div class="modal-footer">
                    <button class="btn-big btn-cancel" onclick="chiudiAlchimia()">CHIUDI</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }

    renderAlchimiaModal(idx);
    modal.style.display = 'block';
}

function chiudiAlchimia() {
    const modal = document.getElementById('modal-alchimia');
    if (modal) modal.style.display = 'none';
}

function renderAlchimiaModal(idx) {
    const content = document.getElementById('alchimia-content');
    if (!content) return;
    const p = window.party[idx];

    const haMaestriaNatura = p.masteries && p.masteries.map(m => m.toLowerCase()).includes('natura');
    const haCompetenzaNatura = haMaestriaNatura || p.hasCompetenza('Natura');
    const modInt = p.getStatDettagliata('Intelligenza').mod;
    const bonusComp = haCompetenzaNatura ? p.getBonusCompetenza() : 0;
    const modNaturaTotale = modInt + bonusComp;
    const ricette = getRicetteDisponibili(p);


    let html = `
        <div style="margin-bottom:14px; font-size:0.9rem; color:#ddd; border-bottom:1px solid #333; padding-bottom:10px;">
            <strong>${p.nome}</strong> — Mod. Natura Totale: <strong>${modNaturaTotale >= 0 ? '+' : ''}${modNaturaTotale}</strong><br>
            <span style="color:#888;">(Int ${modInt >= 0 ? '+' : ''}${modInt} ${haCompetenzaNatura ? `| Competenza +${bonusComp}` : ''} ${haMaestriaNatura ? `| <span style="color:#ff9800;">★ Maestria</span>` : ''})</span>
            <br><br>Materiali alchemici disponibili: <strong style="color:#f1c40f;">${window.magazzino.materialiAlchemici}</strong>
        </div>`;

    if (ricette.length === 0) {
        html += `<p style="color:#aaa;">Nessuna ricetta disponibile.</p>`;
        content.innerHTML = html;
        return;
    }

    ['facile', 'media', 'difficile'].forEach(grado => {
        const gruppo = ricette.filter(r => r.grado === grado);
        if (!gruppo.length) return;
        const gradoInfo = ALCHIMIA_GRADI[grado];

        html += `<div style="margin-bottom:16px;">
            <div style="color:#f1c40f; font-weight:bold; font-size:0.95rem; border-bottom:1px solid #333; padding-bottom:4px; margin-bottom:8px;">
                ${gradoInfo.label.toUpperCase()} — CD ${gradoInfo.cd} | ${gradoInfo.tempo}h | ${gradoInfo.costo} alchemici
                ${grado === 'difficile' ? ' <span style="color:#ff9800; font-size:0.8rem;">(Richiede Maestria)</span>' : ''}
            </div>`;

        gruppo.forEach(r => {
            const haMaestriaNatura = p.masteries && p.masteries.map(m => m.toLowerCase()).includes('natura');
            const soddisfaRequisito = (grado !== 'difficile') || haMaestriaNatura;
            const puoCrare = window.magazzino.materialiAlchemici >= gradoInfo.costo && soddisfaRequisito;

            let btnTesto = "CREA";
            if (!soddisfaRequisito) btnTesto = "BLOCCATO";
            else if (!puoCrare) btnTesto = "MAT. INSUFF.";

            html += `
                <div style="background:#1a1a1a; border:1px solid #333; border-radius:4px; padding:10px; margin-bottom:8px; display:grid; grid-template-columns:1fr 110px; gap:8px; align-items:start;">
                    <div>
                        <div style="color:#eee; font-weight:bold; margin-bottom:3px;">${r.nome}</div>
                        <div style="color:#aaa; font-size:0.82rem; margin-bottom:4px;">${r.desc}</div>
                        <div style="color:#888; font-size:0.78rem;">Costo: ${gradoInfo.costo} alch. | ${gradoInfo.tempo}h</div>
                    </div>
                    <button onclick="avviaCreazione_Alchimia(${idx}, '${r.nome}', '${r.grado}')" 
                            ${puoCrare ? '' : 'disabled'}
                            style="background:${puoCrare ? '#27ae60' : '#555'} !important; color:white !important; padding:8px !important; font-size:0.8rem !important;">
                        ${btnTesto}
                    </button>
                </div>`;
        });

        html += `</div>`;
    });

    content.innerHTML = html;
}

function avviaCreazione_Alchimia(idx, nomeRicetta, grado) {
    const p = window.party[idx];
    const gradoInfo = ALCHIMIA_GRADI[grado];

    const haMaestriaNatura = p.masteries && p.masteries.map(m => m.toLowerCase()).includes('natura');
    if (grado === 'difficile' && !haMaestriaNatura) {
        alert(`${p.nome} necessita della Maestria in Natura per creare composti Difficili.`);
        return;
    }

    if (window.magazzino.materialiAlchemici < gradoInfo.costo) {
        alert('Materiali alchemici insufficienti.');
        return;
    }
    let costoBase = gradoInfo.costo;
    if (p.hasPerk && p.hasPerk('Riciclatore disperato')) {
        costoBase = Math.ceil(costoBase * 0.9);
    }

    const candidatiCollab = window.party.filter((q, i) => {
        if (i === idx) return false;
        const rating = q.getSkillRating ? q.getSkillRating('Natura') : 0;
        return rating >= 1;
    });

    let collaboratore = null;
    let cdRiduzione = 0;
    let tempoBase = gradoInfo.tempo;

    if (candidatiCollab.length > 0) {
        let lista = candidatiCollab.map((c, i) => `${i + 1}) ${c.nome}`).join('\n');
        lista += `\n${candidatiCollab.length + 1}) Nessun collaboratore`;
        const scelta = prompt(`Vuoi un collaboratore per "${nomeRicetta}"?\n(Riduce CD di 3 e tempo del 35%)\n${lista}`, `${candidatiCollab.length + 1}`);
        const sceltaIdx = parseInt(scelta);
        if (!isNaN(sceltaIdx) && sceltaIdx >= 1 && sceltaIdx <= candidatiCollab.length) {
            collaboratore = candidatiCollab[sceltaIdx - 1];
            const scienziatoPazzo = p.hasPerk && p.hasPerk('Scienziato Pazzo');
            cdRiduzione = scienziatoPazzo ? 2 : 3;
            const percentualeTempo = scienziatoPazzo ? 0.22 : 0.35;
            tempoBase = Math.max(1, gradoInfo.tempo - Math.floor(gradoInfo.tempo * percentualeTempo));
        }
    }

    let ricettaDati = null;
    if (window.RICETTE) {
        for (const livello of ['facile', 'media', 'difficile']) {
            const trovata = (window.RICETTE[livello] || []).find(r => r.nome === nomeRicetta);
            if (trovata) { ricettaDati = trovata; break; }
        }
    }
    let cdBonusRancore = 0;
    if (collaboratore && (p.rancoreTargetId === collaboratore.id || collaboratore.rancoreTargetId === p.id)) {
        cdBonusRancore = 4;
    }
    let cdBase = gradoInfo.cd;
    if (ricettaDati && ricettaDati.cd !== undefined) cdBase = ricettaDati.cd;
    const cdEffettiva = cdBase - cdRiduzione + cdBonusRancore;
    if (collaboratore) {
        inviaProposta(p.id, collaboratore.id, 'alchimia', {
            nomeRicetta, grado, cdEffettiva, costo: costoBase
        });
        return;
    }

    // --- PERFEZIONISTA: tira PRIMA, poi calcola il tempo in base al risultato ---
    let rollPrecalcolato = null;
    let tempoFinale = Math.ceil(tempoBase * p.getModificatoreTempoAzione('alchimia'));
    if (p.hasPerk && p.hasPerk('Perfezionista')) {
        const modInt = p.getStatDettagliata('Intelligenza').mod;
        const bonusComp = p.hasCompetenza('Natura') ? p.getBonusCompetenza() : 0;
        const tiroDado = Math.floor(Math.random() * 20) + 1;
        const totale = tiroDado + modInt + bonusComp;
        rollPrecalcolato = { tiroDado, totale };
        const modTempo = p.getPerfezionistaTimeModifier(totale);
        tempoFinale = Math.max(1, Math.ceil(tempoFinale * modTempo));
        mostraNotificaInAlto(`${p.nome} (Perfezionista): tiro anticipato ${totale}, tempo ${modTempo < 1 ? 'ridotto' : 'aumentato'} a ${tempoFinale}h.`, modTempo < 1 ? 'successo' : 'avviso');
    }

    window.magazzino.materialiAlchemici -= costoBase;

    const azione = {
        tipo: 'alchimia',
        oreTotali: tempoFinale,
        ricettaDati: ricettaDati,
        oreRimanenti: tempoFinale,
        costoMateriali: costoBase,
        nomeRicetta, grado, cdEffettiva,
        collaboratoreNome: null,
        rollPrecalcolato,
        onComplete: () => completaAlchimia(p, nomeRicetta, grado, cdEffettiva, null, rollPrecalcolato)
    };

    if (p.azioneCorrente) {
        if (confirm(`${p.nome} sta già facendo altro. Mettere in coda?`)) {
            p.codaAzioni.push(azione);
        } else {
            window.magazzino.materialiAlchemici += gradoInfo.costo;
            return;
        }
    } else {
        p.azioneCorrente = azione;
    }

    salvaPersonaggio(p);
    mostraNotificaInAlto(`${p.nome} inizia a creare "${nomeRicetta}" (${tempoFinale}h, CD ${cdEffettiva}).`, 'successo');
    chiudiAlchimia();
    window.aggiornaInterfaccia();
}


function completaAlchimia(p, nomeRicetta, grado, cdEffettiva, collaboratore, rollPrecalcolato = null) {

    const modInt    = p.getStatDettagliata('Intelligenza').mod;
    const bonusComp = p.hasCompetenza('Natura') ? p.getBonusCompetenza() : 0;

    // Se Perfezionista ha già tirato all'avvio, riusa quel tiro invece di tirarne uno nuovo
    let tiroDado, totale;
    if (rollPrecalcolato) {
        tiroDado = rollPrecalcolato.tiroDado;
        totale = rollPrecalcolato.totale;
    } else {
        tiroDado = Math.floor(Math.random() * 20) + 1;
        totale   = tiroDado + modInt + bonusComp;
    }
    const cdConIrascibile = cdEffettiva + p.getIrascibileCDBonus() + p.getPessimistaCDBonus();
    const scarto = cdConIrascibile - totale;
    p.registraIrascibile(scarto <= 0, scarto >= 5);
    p.registraPessimista(scarto <= 0);

    // Trova i dati della ricetta
    let ricettaDati = null;
    if (window.RICETTE) {
        for (const livello of ['facile', 'media', 'difficile']) {
            const trovata = (window.RICETTE[livello] || []).find(r => r.nome === nomeRicetta);
            if (trovata) { ricettaDati = trovata; break; }
        }
    }

    let esito = '';
    let colorNotifica = 'successo';

    if (scarto <= 0) {
        // SUCCESSO (Tiro >= CD)
        if (p.hasPerk && p.hasPerk('Scienziato Pazzo') && totale < 12) {
            esito = `⚗️ SUCCESSO ma Scienziato Pazzo lo butta via! Tiro: ${tiroDado} + ${modInt} + ${bonusComp} = ${totale} (< 12)\n"${nomeRicetta}" viene distrutto e la creazione ricomincia automaticamente.`;
            alert(esito);
            mostraNotificaInAlto(`${p.nome} (Scienziato Pazzo) butta via "${nomeRicetta}" nonostante il successo: ricomincia da capo.`, 'avviso');
            const idxRestart = window.party.indexOf(p);
            if (idxRestart !== -1) avviaCreazione_Alchimia(idxRestart, nomeRicetta, grado);
            return;
        }
        aggiungiComposto(nomeRicetta, ricettaDati, 'normale');
        esito = `✅ SUCCESSO! Tiro: ${tiroDado} + ${modInt} + ${bonusComp} = ${totale} vs CD ${cdEffettiva}\n"${nomeRicetta}" creato perfettamente!`;
    } else if (scarto <= 2) {
        // FALLIMENTO LIEVE (Inferiore di 1-2)
        aggiungiComposto(nomeRicetta, ricettaDati, 'instabile');
        esito = `⚠️ FALLIMENTO LIEVE (${totale} vs CD ${cdEffettiva})\n"${nomeRicetta}" è instabile: i suoi effetti saranno dimezzati.`;
        colorNotifica = 'warning';
    } else if (scarto >= 5) {
        // FALLIMENTO GRAVE (Inferiore di 5 o più)
        aggiungiComposto(nomeRicetta, ricettaDati, 'tossico');
        esito = `☠️ FALLIMENTO GRAVE (${totale} vs CD ${cdEffettiva})\n"${nomeRicetta}" è TOSSICO: l'uso infliggerà 1 PF Reale e 2 Gradi di Fatica!`;
        colorNotifica = 'pericolo';
    } else {
        // FALLIMENTO NORMALE (Inferiore di 3-4) - Regola implicita: si fallisce e si perdono i materiali.
        esito = `❌ FALLIMENTO (${totale} vs CD ${cdEffettiva})\n"${nomeRicetta}" non è riuscito. I materiali sono andati perduti.`;
        colorNotifica = 'pericolo';
    }

    if (collaboratore) esito += `\n(Collaboratore: ${collaboratore.nome})`;
    alert(esito);
    mostraNotificaInAlto(`Alchimia completata da ${p.nome}: "${nomeRicetta}"`, colorNotifica);
    aggiornaInterfaccia_local();
}

function aggiungiComposto(nome, ricettaDati, qualita) {
    magazzino.compounds = magazzino.compounds || [];
    magazzino.compounds.push({
        id: `composto-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
        nome,
        qualita, // 'normale', 'instabile', 'tossico' (Il sistema di combattimento leggerà questo parametro)
        effetto: ricettaDati ? ricettaDati.effetto : null,
        desc: ricettaDati ? ricettaDati.desc : ''
    });
}

function creaPostazioneAlchemica() {
    if (magazzino.materialiAlchemici < 15) {
        alert('Non ci sono abbastanza materiali alchemici per costruire la postazione. Servono 15.');
        return;
    }
    magazzino.materialiAlchemici -= 15;
    magazzino.postazioneAlchemica = true;
    if (typeof mostraNotificaInAlto === 'function') mostraNotificaInAlto('Postazione alchemica creata.', 'successo');
    aggiornaInterfaccia_local();
    renderAlchemyModal();
}

function lootAlchemici(tiro) {
    if (tiro <= 4) return 0;
    if (tiro <= 8) return rollDice(1, 4);
    if (tiro <= 11) return rollDice(2, 4);
    if (tiro <= 14) return rollDice(3, 4);
    if (tiro <= 17) return rollDice(3, 6);
    if (tiro <= 19) return rollDice(5, 6);
    return rollDice(8, 6);
}

/**
 * Applica l'effetto meccanico specifico del composto sul bersaglio.
 * Ritorna una stringa descrittiva dell'esito da mostrare in notifica.
 * Gestisce automaticamente qualità 'tossico' (sostituisce l'effetto con un danno)
 * e 'instabile' (dimezza l'effetto).
 */
function applicaEffettoComposto(target, c) {
    const effetto = c.effetto || {};
    const isInstabile = c.qualita === 'instabile';
    const isTossico = c.qualita === 'tossico';

    if (isTossico) {
        target.puntiFeritaReali = Math.max(0, target.puntiFeritaReali - 1);
        target.faticaBase = Math.min(6, target.faticaBase + 2);
        target.resetWoundTimer();
        return `☠️ era TOSSICO! -1 PF Reale, +2 Fatica.`;
    }

    switch (effetto.tipo) {
        case 'rimuovi_disidratazione': {
            const durata = effetto.durata || 4;
            // Non cumulabile: si imposta, non si somma
            target.timers.seteSoddisfatta = Math.max(target.timers.seteSoddisfatta || 0, isInstabile ? Math.ceil(durata / 2) : durata);
            return `Disidratazione alleviata per ${target.timers.seteSoddisfatta}h.`;
        }
        case 'bonus_abilità': {
            const durata = effetto.durata || 1;
            const bonus = isInstabile ? Math.ceil((effetto.bonus || 3) / 2) : (effetto.bonus || 3);
            target.timers.buffIntegratori = Math.max(target.timers.buffIntegratori || 0, durata);
            target._integratoriBonus = bonus;
            return `+${bonus} a Intelligenza, Saggezza e prove di Studio per ${durata}h.`;
        }
        case 'xp_mischia_bonus': {
            const durata = effetto.durata || 1;
            const mult = isInstabile ? 1.5 : (effetto.moltiplicatore || 2);
            target.timers.buffProteico = Math.max(target.timers.buffProteico || 0, durata);
            target._proteicoMoltiplicatore = mult;
            return `XP delle armi da mischia moltiplicato x${mult} per ${durata}h.`;
        }
        case 'rimuovi_sanguinante': {
            const bonusMed = isInstabile ? Math.ceil((effetto.bonus_med || -4) / 2) : (effetto.bonus_med || -4);
            target._unguentoCoagulanteAttivo = true;
            target._unguentoCoagulanteBonus = bonusMed;
            return `Pronto per la prossima medicazione di ferita grave: CD ${bonusMed}.`;
        }
        case 'riduzione_tempo_rigenerazione': {
            const percent = isInstabile ? Math.ceil((effetto.percent || 20) / 2) : (effetto.percent || 20);
            target._bendaggioCoagulanteAttivo = true;
            target._bendaggioCoagulantePercent = percent;
            return `Il prossimo PF Reale rigenererà il ${percent}% più velocemente.`;
        }
        case 'rigenera_mana': {
            let guadagno = (typeof rollDiceNotation === 'function') ? rollDiceNotation(effetto.dado || '1d4') : (Math.floor(Math.random() * 4) + 1);
            if (isInstabile) guadagno = Math.floor(guadagno / 2);
            const prima = target.manaAttuale;
            target.manaAttuale = Math.min(target.manaMax, target.manaAttuale + guadagno);
            return `+${target.manaAttuale - prima} Mana (${target.manaAttuale}/${target.manaMax}).`;
        }
        case 'bonus_iniziativa_ca_pf': {
            let pf = effetto.pf || 5;
            if (isInstabile) pf = Math.floor(pf / 2);
            target.puntiFortunaTemp = (target.puntiFortunaTemp || 0) + pf;
            return `+${pf} PF Fortuna temporanei.`;
        }
        case 'adrenalina': {
            const postOre = effetto.post_incapacita_h || 1;
            target._incapacitatoFinoA = (window.oreTotali || 0) + postOre;
            return `Ignora ferite e debuff fisici per pochi minuti. Al termine sarà incapace di agire per ${postOre}h.`;
        }
        default:
            return null;
    }
}
window.applicaEffettoComposto = applicaEffettoComposto;

function applicaConsumoComposto(target, c, onConsumed) {
    if (!target || !c) return;
    const isPilloleCalma = c.nome === 'Pillole della Calma' || (c.effetto && c.effetto.tipo === 'riduci_follia');

    if (isPilloleCalma) {
        if (!confirm(`Confermi che ${target.nome} consuma "${c.nome}"? Ridurrà automaticamente la Follia.`)) return;
        if (c.qualita === 'tossico') {
            target.puntiFeritaReali = Math.max(0, target.puntiFeritaReali - 1);
            target.faticaBase = Math.min(6, target.faticaBase + 2);
            target.resetWoundTimer();
            mostraNotificaInAlto(`☠️ ${target.nome}: "${c.nome}" era TOSSICO! -1 PF Reale, +2 Fatica.`, 'pericolo');
        } else {
            let riduzione = (typeof window.rollDice === 'function') ? window.rollDice(1, 4) : (Math.floor(Math.random() * 4) + 1);
            if (c.qualita === 'instabile') riduzione = Math.floor(riduzione / 2);
            target.follia = Math.max(0, target.follia - riduzione);
            if (typeof target.aggiornaSintomiFollia === 'function') target.aggiornaSintomiFollia();
            mostraNotificaInAlto(`💊 ${target.nome} consuma "${c.nome}": Follia -${riduzione}.`, 'successo');
        }
    } else {
        const descBreve = c.desc ? ` (${c.desc})` : '';
        if (!confirm(`Confermi che ${target.nome} consuma "${c.nome}" (${c.qualita})?${descBreve}`)) return;
        const esito = applicaEffettoComposto(target, c);
        if (esito) {
            mostraNotificaInAlto(`🧪 ${target.nome} consuma "${c.nome}": ${esito}`, c.qualita === 'tossico' ? 'pericolo' : 'successo');
        } else {
            mostraNotificaInAlto(`${target.nome} ha consumato "${c.nome}". Effetto da applicare manualmente dal master.`, 'successo');
        }
    }

    if (typeof target.registraConsumoConsumabile === 'function') {
        target.registraConsumoConsumabile(c.nome);
    }
    if (typeof salvaPersonaggioCloud === 'function') salvaPersonaggioCloud(target);
    aggiornaInterfaccia_local();
    if (typeof onConsumed === 'function') onConsumed();
}

/**
 * Consuma un composto presente nel magazzino condiviso, chiedendo quale personaggio lo consuma.
 * Il composto viene rimosso dal magazzino dopo il consumo.
 */
function consumaComposto(compIdx) {
    const c = magazzino.compounds[compIdx];
    if (!c) return;
    const nomi = party.map((p, i) => `${i}) ${p.nome}`).join('\n');
    const scelta = parseInt(prompt(`Chi consuma "${c.nome}" (${c.qualita})?\n${nomi}`, '0'));
    const target = party[scelta];
    if (!target) return;
    applicaConsumoComposto(target, c, () => {
        magazzino.compounds.splice(compIdx, 1);
        if (typeof renderMagazzinoModal === 'function') renderMagazzinoModal();
    });
}

/**
 * Consuma un composto già presente nell'inventario personale del personaggio
 * (portato con sé, es. in spedizione).
 */
function consumaCompostoPersonaggio(idx, itemIdx) {
    const p = party[idx];
    if (!p || !p.inventario || !p.inventario.composti || !p.inventario.composti[itemIdx]) return;
    const c = p.inventario.composti[itemIdx];
    applicaConsumoComposto(p, c, () => {
        p.inventario.composti.splice(itemIdx, 1);
        if (document.getElementById('modal-inventario')?.style.display === 'block' && typeof window.apriInventario === 'function') {
            window.apriInventario(idx);
        }
    });
}

/**
 * Consegna un composto dal magazzino condiviso all'inventario personale di un personaggio
 * (idx = INDICE nel party, non ID).
 */
function daiCompostoAPersonaggio(idx, compIdx) {
    const p = party[idx];
    const c = magazzino.compounds[compIdx];
    if (!p || !c) return;
    p.initInventarioBase();
    p.inventario.composti.push(c);
    magazzino.compounds.splice(compIdx, 1);
    mostraNotificaInAlto(`${c.nome} consegnato a ${p.nome}: ora può portarlo in spedizione.`, 'successo');
    if (typeof renderMagazzinoModal === 'function') renderMagazzinoModal();
    if (typeof salvaPersonaggioCloud === 'function') salvaPersonaggioCloud(p);
}

function avviaCreazione_AlchimiaConCollaboratore(mittente, collaboratore, nomeRicetta, grado, cdEffettiva) {
    if (!mittente || !collaboratore) { console.error('Mittente o collaboratore non definiti.'); return; }
    const gradoInfo = ALCHIMIA_GRADI[grado];
    if (!gradoInfo) return;

    let costoBase = gradoInfo.costo;
    if (mittente.hasPerk && mittente.hasPerk('Riciclatore disperato')) {
        costoBase = Math.ceil(costoBase * 0.9);
    }

    if (window.magazzino.materialiAlchemici < costoBase) {
        mostraNotificaInAlto('Materiali alchemici insufficienti.', 'errore');
        return;
    }
    window.magazzino.materialiAlchemici -= costoBase;

    let ricettaDati = null;
    if (window.RICETTE) {
        for (const livello of ['facile', 'media', 'difficile']) {
            const trovata = (window.RICETTE[livello] || []).find(r => r.nome === nomeRicetta);
            if (trovata) { ricettaDati = trovata; break; }
        }
    }


    const azione = {
        tipo: 'alchimia', oreTotali: gradoInfo.tempo, ricettaDati, oreRimanenti: gradoInfo.tempo,
        costoMateriali: gradoInfo.costo, nomeRicetta, grado, cdEffettiva,
        collaboratoreNome: collaboratore.nome,
        onComplete: () => completaAlchimia(mittente, nomeRicetta, grado, cdEffettiva, collaboratore)
    };
    const azioneCollab = {
        tipo: 'alchimia-assistenza', oreTotali: gradoInfo.tempo, oreRimanenti: gradoInfo.tempo, nomeRicetta,
        onComplete: () => {
            mostraNotificaInAlto(`${collaboratore.nome} ha finito di assistere la creazione di "${nomeRicetta}".`, 'successo');
            salvaPersonaggio(collaboratore);
        }
    };

    // FIX: partono/si accodano SEMPRE insieme, mai separati
    const entrambiLiberi = !mittente.azioneCorrente && !collaboratore.azioneCorrente;
    if (entrambiLiberi) {
        mittente.azioneCorrente = azione;
        collaboratore.azioneCorrente = azioneCollab;
        mostraNotificaInAlto(`${mittente.nome} e ${collaboratore.nome} iniziano insieme l'alchimia (${nomeRicetta}).`, 'successo');
    } else {
        mittente.codaAzioni.push(azione);
        collaboratore.codaAzioni.push(azioneCollab);
        mostraNotificaInAlto(`${mittente.nome} e ${collaboratore.nome} metteranno in coda insieme l'alchimia (${nomeRicetta}), partiranno appena entrambi liberi.`, 'info');
    }
    salvaPersonaggio(mittente);
    salvaPersonaggio(collaboratore);
    aggiornaInterfaccia();
}

window.avviaCreazione_AlchimiaConCollaboratore = avviaCreazione_AlchimiaConCollaboratore;
window.applicaConsumoComposto = applicaConsumoComposto;
window.consumaComposto = consumaComposto;
window.consumaCompostoPersonaggio = consumaCompostoPersonaggio;
window.daiCompostoAPersonaggio = daiCompostoAPersonaggio;
window.alchimiaPersonaggio = alchimiaPersonaggio;
window.apriAlchimiaModal = apriAlchimiaModal;
window.chiudiAlchimia = chiudiAlchimia;
window.avviaCreazione_Alchimia = avviaCreazione_Alchimia;
window.creaPostazioneAlchemica = creaPostazioneAlchemica;
window.lootAlchemici = lootAlchemici;