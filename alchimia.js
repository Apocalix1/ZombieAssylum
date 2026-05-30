// alchimia.js
// Sistema Alchimia completo

const ALCHIMIA_GRADI = {
    facile:   { cd: 12, tempo: 1, costo: 6,  reqNatura: 'competenza', label: 'Facile' },
    media:    { cd: 16, tempo: 4, costo: 12, reqNatura: 'competenza', label: 'Media'  },
    difficile:{ cd: 22, tempo: 8, costo: 24, reqNatura: 'maestria',   label: 'Difficile' }
};

// Ricette integrate dal database ricette.js (window.RICETTE)
function getRicetteDisponibili(p) {
    const haMaestriaNatura = p.masteries && p.masteries.map(m => m.toLowerCase()).includes('natura');
    const haCompetenzaNatura = haMaestriaNatura || p.hasCompetenza('Natura');

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
    const p = party[idx];

    const haMaestriaNatura   = p.masteries && p.masteries.map(m => m.toLowerCase()).includes('natura');
    const haCompetenzaNatura = haMaestriaNatura || p.hasCompetenza('Natura');
    const modNatura          = p.getStatDettagliata('Intelligenza').mod;
    const bonusComp          = haCompetenzaNatura ? p.getBonusCompetenza() : 0;
    const ricette            = getRicetteDisponibili(p);

    let html = `
        <div style="margin-bottom:14px; font-size:0.9rem; color:#ddd; border-bottom:1px solid #333; padding-bottom:10px;">
            <strong>${p.nome}</strong> — Int ${modNatura >= 0 ? '+' : ''}${modNatura}
            ${haCompetenzaNatura ? `| Competenza Natura +${bonusComp}` : ''}
            ${haMaestriaNatura   ? `| <span style="color:#ff9800;">★ Maestria Natura</span>` : ''}
            <br>Materiali alchemici disponibili: <strong style="color:#f1c40f;">${magazzino.materialiAlchemici}</strong>
        </div>`;

    if (ricette.length === 0) {
        html += `<p style="color:#aaa;">Nessuna ricetta disponibile.</p>`;
        content.innerHTML = html;
        return;
    }

    // Raggruppa per grado
    ['facile', 'media', 'difficile'].forEach(grado => {
        const gruppo = ricette.filter(r => r.grado === grado);
        if (!gruppo.length) return;
        const gradoInfo = ALCHIMIA_GRADI[grado];

        html += `<div style="margin-bottom:16px;">
            <div style="color:#f1c40f; font-weight:bold; font-size:0.95rem; border-bottom:1px solid #333; padding-bottom:4px; margin-bottom:8px;">
                ${gradoInfo.label.toUpperCase()} — CD ${gradoInfo.cd} | ${gradoInfo.tempo}h | ${gradoInfo.costo} alchemici
            </div>`;

        gruppo.forEach(r => {
            const puoCrare = magazzino.materialiAlchemici >= gradoInfo.costo;
            // CD con collaborazione sarebbe mostrata nel momento della creazione
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
                        CREA
                    </button>
                </div>`;
        });

        html += `</div>`;
    });

    content.innerHTML = html;
}

function avviaCreazione_Alchimia(idx, nomeRicetta, grado) {
    const p         = party[idx];
    const gradoInfo = ALCHIMIA_GRADI[grado];

    if (magazzino.materialiAlchemici < gradoInfo.costo) {
        alert('Materiali alchemici insufficienti.');
        return;
    }

    // Chiedi collaboratore
    const candidatiCollab = party.filter((q, i) => {
        if (i === idx) return false;
        return q.hasCompetenza('Natura') || (q.masteries && q.masteries.map(m => m.toLowerCase()).includes('natura'));
    });

    let collaboratore = null;
    let cdRiduzione   = 0;
    let tempoFinale   = gradoInfo.tempo;

    if (candidatiCollab.length > 0) {
        let lista = candidatiCollab.map((c, i) => `${i + 1}) ${c.nome}`).join('\n');
        lista += `\n${candidatiCollab.length + 1}) Nessun collaboratore`;
        const scelta = prompt(`Vuoi un collaboratore per "${nomeRicetta}"?\n${lista}`, `${candidatiCollab.length + 1}`);
        const sceltaIdx = parseInt(scelta);
        if (!isNaN(sceltaIdx) && sceltaIdx >= 1 && sceltaIdx <= candidatiCollab.length) {
            collaboratore = candidatiCollab[sceltaIdx - 1];
            cdRiduzione   = 3;
            tempoFinale   = Math.floor(gradoInfo.tempo * 0.65);
            if (tempoFinale < 1) tempoFinale = 1;
        }
    }

    const cdEffettiva = gradoInfo.cd - cdRiduzione;

    // Consuma materiali subito (come deposit)
    magazzino.materialiAlchemici -= gradoInfo.costo;

    // Crea azione per il creatore
    const azione = {
        tipo: 'alchimia',
        oreTotali: tempoFinale,
        oreRimanenti: tempoFinale,
        nomeRicetta,
        grado,
        cdEffettiva,
        collaboratoreNome: collaboratore ? collaboratore.nome : null,
        onComplete: () => completaAlchimia(p, nomeRicetta, grado, cdEffettiva, collaboratore)
    };

    if (p.azioneCorrente) {
        if (confirm(`${p.nome} sta già facendo altro. Mettere in coda?`)) {
            p.codaAzioni.push(azione);
        } else {
            // Rimborso
            magazzino.materialiAlchemici += gradoInfo.costo;
            return;
        }
    } else {
        p.azioneCorrente = azione;
    }

    // Se c'è collaboratore, occupa anche lui
    if (collaboratore) {
        const azioneCollab = {
            tipo: 'alchimia-assistenza',
            oreTotali: tempoFinale,
            oreRimanenti: tempoFinale,
            nomeRicetta,
            onComplete: () => mostraNotificaInAlto(`${collaboratore.nome} ha finito di assistere la creazione di "${nomeRicetta}".`, 'successo')
        };
        if (collaboratore.azioneCorrente) {
            collaboratore.codaAzioni.push(azioneCollab);
        } else {
            collaboratore.azioneCorrente = azioneCollab;
        }
    }

    const msg = `${p.nome} inizia a creare "${nomeRicetta}" (${tempoFinale}h, CD ${cdEffettiva})${collaboratore ? ` con l'aiuto di ${collaboratore.nome}` : ''}.`;
    mostraNotificaInAlto(msg, 'successo');
    chiudiAlchimia();
    aggiornaInterfaccia();
}

function completaAlchimia(p, nomeRicetta, grado, cdEffettiva, collaboratore) {
    const gradoInfo  = ALCHIMIA_GRADI[grado];
    const modNatura  = p.getStatDettagliata('Intelligenza').mod;
    const haMaestria = p.masteries && p.masteries.map(m => m.toLowerCase()).includes('natura');
    
    let tiroDado;
    if (haMaestria) {
        // Vantaggio
        const a = Math.floor(Math.random() * 20) + 1;
        const b = Math.floor(Math.random() * 20) + 1;
        tiroDado = Math.max(a, b);
    } else {
        tiroDado = Math.floor(Math.random() * 20) + 1;
    }

    const bonusComp = p.hasCompetenza('Natura') ? p.getBonusCompetenza() : 0;
    const totale    = tiroDado + modNatura + bonusComp;
    const scarto    = cdEffettiva - totale; // positivo = fallimento

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
        // Successo
        aggiungiComposto(nomeRicetta, ricettaDati, 'normale');
        esito = `✅ SUCCESSO! Tiro: ${tiroDado}${haMaestria ? ' (vantaggio)' : ''} + ${modNatura} + ${bonusComp} = ${totale} vs CD ${cdEffettiva}\n"${nomeRicetta}" creato con successo!`;
    } else if (scarto <= 2) {
        // Fallimento lieve: composto instabile
        aggiungiComposto(nomeRicetta, ricettaDati, 'instabile');
        esito = `⚠️ FALLIMENTO LIEVE (${totale} vs CD ${cdEffettiva})\n"${nomeRicetta}" è instabile: effetti ridotti della metà.`;
        colorNotifica = 'warning';
    } else if (scarto >= 5) {
        // Fallimento grave: composto tossico
        aggiungiComposto(nomeRicetta, ricettaDati, 'tossico');
        esito = `☠️ FALLIMENTO GRAVE (${totale} vs CD ${cdEffettiva})\n"${nomeRicetta}" è TOSSICO: usarlo infligge 1 PF Reale e +2 gradi di Fatica!`;
        colorNotifica = 'pericolo';
    } else {
        // Fallimento normale (scarto 3-4): composto non riuscito, materiali persi
        esito = `❌ FALLIMENTO (${totale} vs CD ${cdEffettiva})\n"${nomeRicetta}" non è riuscito. I materiali sono andati perduti.`;
        colorNotifica = 'pericolo';
    }

    if (collaboratore) esito += `\n(Collaboratore: ${collaboratore.nome})`;
    alert(esito);
    mostraNotificaInAlto(`Alchimia completata da ${p.nome}: "${nomeRicetta}"`, colorNotifica);
    aggiornaInterfaccia();
}

function aggiungiComposto(nome, ricettaDati, qualita) {
    if (!magazzino.composti) magazzino.composti = [];
    magazzino.composti.push({
        id: `composto-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
        nome,
        qualita, // 'normale', 'instabile', 'tossico'
        effetto: ricettaDati ? ricettaDati.effetto : null,
        desc: ricettaDati ? ricettaDati.desc : ''
    });
}