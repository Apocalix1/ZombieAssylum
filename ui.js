let oreTotali = 0;
let party = [];
let cimitero = [];
let magazzino = {
    cibo: 20,
    acqua: 20,
    materialiAlchemici: 5,
    ingranaggi: 10,
    conserve: 0,
    piattiDeliziosi: 0,
    materialiMedici: {
        base: 2,
        avanzati: 1,
        critici: 0
    },
    postazioneAlchemica: false,
    compounds: [],
    libri: []
};

function rollDiceNotation(notation) {
    const match = notation.match(/(\d+)d(\d+)/);
    if (!match) return 0;
    return rollDice(parseInt(match[1], 10), parseInt(match[2], 10));
}

function hasPerk(personaggio, nomePerk) {
    if (!personaggio || !Array.isArray(personaggio.perks)) return false;
    return personaggio.perks.some(perk => {
        if (typeof perk === 'string') return perk === nomePerk;
        if (typeof perk === 'object' && perk && perk.nome) return perk.nome === nomePerk;
        return false;
    });
}

function getFoodEfficiency(p) {
    let scale = 1;
    if (hasPerk(p, 'Digiuno')) scale *= 1.2;
    if (hasPerk(p, 'Insaziabile')) scale *= 0.8;
    return scale;
}

function getWaterEfficiency(p) {
    let scale = 1;
    if (hasPerk(p, 'Dromedario')) scale *= 1.2;
    if (hasPerk(p, 'Bocca asciutta')) scale *= 0.8;
    return scale;
}

function recordResourceConsumption(p, amount, tipo = 'cibo') {
    if (!p.resourceConsumption) p.resourceConsumption = { cibo: 0, acqua: 0 };
    if (tipo === 'acqua') {
        p.resourceConsumption.acqua += amount;
    } else {
        p.resourceConsumption.cibo += amount;
    }
}

function randomStudyHours() {
    const r = Math.random();
    if (r < 0.04) return 24;
    const distribution = [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23];
    const midpoint = 13.5;
    const weights = distribution.map(v => 1 / (1 + Math.abs(v - midpoint)));
    let total = weights.reduce((sum, w) => sum + w, 0);
    let pick = Math.random() * total;
    for (let i = 0; i < distribution.length; i++) {
        pick -= weights[i];
        if (pick <= 0) return distribution[i];
    }
    return 23;
}

let tempP = null;
let assistenzaSelezionata = null; // { tipo: 'studio'|'medicina'|'alchimia', idx: number }
let alchimiaPersonaggioSelezionata = null;

const MEDICINA_LIVELLI = [
    { livello: 0, effetto: "Nessuna conoscenza specifica; usi base con medicine improvvisate.", costo: 0 },
    { livello: 1, effetto: "Preparazione semplice e medicazioni di base.", costo: 0 },
    { livello: 2, effetto: "Interventi di primo soccorso più efficaci.", costo: 1 },
    { livello: 3, effetto: "Trattamenti avanzati per ferite moderate.", costo: 2 },
    { livello: 4, effetto: "Cura efficiente delle malattie e medicazioni complesse.", costo: 3 },
    { livello: 5, effetto: "Padronanza totale della medicina da campo.", costo: 4 }
];

const TABELLA_ARMI = [
    { nome: 'Lame leggere', descrizione: 'Colpo veloce, critici più frequenti, richiede livello precedente.', livelloBase: 1 },
    { nome: 'Mazze e armi contundenti', descrizione: 'Infligge danno robusto e stordisce, richiede livello precedente.', livelloBase: 1 },
    { nome: 'Archi', descrizione: 'Attacchi a distanza; capacità di tiro e penetranza.', livelloBase: 1 },
    { nome: 'Balestre', descrizione: 'Colpi potenti a distanza, lentezza compensata da danno maggiore.', livelloBase: 1 },
    { nome: 'Armi con l\'asta', descrizione: 'Portata extra e controllo della creatura in mischia.', livelloBase: 1 },
    { nome: 'Armi da fuoco', descrizione: 'Danno esplosivo, richiede rinculo e mira stabilizzata.', livelloBase: 1 },
    { nome: 'Rampini e fruste', descrizione: 'Controllo del campo e disarmo; utile sui bersagli mobili.', livelloBase: 1 }
];

// --- UTILITY: COLORI BARRE ---
function getColoreBarra(percentuale) {
    if (percentuale > 80) return "#2ecc71"; // Verde
    if (percentuale > 50) return "#f1c40f"; // Giallo
    if (percentuale > 25) return "#e67e22"; // Arancione
    if (percentuale > 5)  return "#e74c3c"; // Rosso
    return "#000000";                       // Nero
}

function getBarra(val, max, color) {
    const percent = max > 0 ? Math.max(0, Math.min(100, (val / max) * 100)) : 0;
    return `
        <div class="stat-bar" style="background:#111; margin:6px 0; border:1px solid #333;">
            <div class="bar-fill" style="width:${percent}%; background:${color};"></div>
        </div>`;
}

// --- NUOVA LOGICA: PASSA TEMPO GLOBALE (L'unico modo per far scorrere il tempo) ---
function passaTempoGlobale() {
    let oreInput = prompt("Quante ore vuoi far passare nel mondo?", "1");
    let ore = parseInt(oreInput);
    if (isNaN(ore) || ore <= 0) return;

    // Avanza il tempo globale di 'ore' ore in blocco
    const giornoPrecedente = Math.floor(oreTotali / 24);
    oreTotali += ore;
    const giornoAttuale = Math.floor(oreTotali / 24);

    // Degrado del cibo: 25% di probabilità per ogni giorno che passa
    for (let giorno = giornoPrecedente + 1; giorno <= giornoAttuale; giorno++) {
        if (magazzino.cibo > 0 && Math.random() < 0.25) {
            const perduto = rollDice(1, 6);
            const effettivo = Math.min(magazzino.cibo, perduto);
            if (magazzino.conserve > 0) {
                const ridotto = effettivo / 2;
                magazzino.conserve = Math.max(0, magazzino.conserve - 1);
                magazzino.cibo = Math.max(0, magazzino.cibo - ridotto);
                alert(`Una conserva ha ridotto il degrado: perso solo ${ridotto.toFixed(1)} cibo, consume 1 conserva.`);
            } else {
                magazzino.cibo = Math.max(0, magazzino.cibo - effettivo);
                alert(`Attenzione: il cibo è andato a male o è stato mangiato da animali! Perduti ${effettivo.toFixed(1)} unità di cibo.`);
            }
        }
        if (magazzino.piattiDeliziosi > 0 && Math.random() < 0.40) {
            const perduti = Math.min(magazzino.piattiDeliziosi, rollDice(1, 4));
            magazzino.piattiDeliziosi = Math.max(0, magazzino.piattiDeliziosi - perduti);
            if (perduti > 0) {
                alert(`Attenzione: ${perduti} piatto/i delizioso/i si sono degradati durante il giorno ${giorno}.`);
            }
        }
    }

    for (let i = party.length - 1; i >= 0; i--) {
        const p = party[i];
        if (typeof p.resetDailyStudy === 'function') p.resetDailyStudy(oreTotali);
        const causaMorte = (typeof p.tickOre === 'function') ? p.tickOre(ore) : null;
        if (causaMorte) {
            alert(`CONDOGLIANZE: ${p.nome} è morto per ${causaMorte}.`);
            cimitero.push({
                nome: p.nome,
                causa: causaMorte,
                giorni: giornoAttuale - p.giornoInizio,
                data: `${giornoAttuale}° Giorno`
            });
            party.splice(i, 1);
            if (typeof chiudiScheda === 'function') chiudiScheda();
        } else {
            processAutomaticActions(p);
        }
    }
    aggiornaInterfaccia();
}

// --- AGGIORNAMENTO INTERFACCIA PRINCIPALE ---
function aggiornaInterfaccia() {
    document.getElementById('display-giorno').innerText = Math.floor(oreTotali / 24);
    let ora = oreTotali % 24;
    document.getElementById('display-ora').innerText = `${ora < 10 ? '0' : ''}${ora}:00`;
    document.getElementById('display-cibo').innerText = magazzino.cibo.toFixed(1);
    const conserveDisplay = document.getElementById('display-conserve');
    if (conserveDisplay) conserveDisplay.innerText = magazzino.conserve;
    const deliziosiDisplay = document.getElementById('display-piatti-deliziosi');
    if (deliziosiDisplay) deliziosiDisplay.innerText = magazzino.piattiDeliziosi;
    document.getElementById('display-acqua').innerText = magazzino.acqua.toFixed(1);
    document.getElementById('display-alchemici').innerText = magazzino.materialiAlchemici;
    document.getElementById('display-ingranaggi').innerText = magazzino.ingranaggi;
    document.getElementById('display-medici-base').innerText = magazzino.materialiMedici.base;
    document.getElementById('display-medici-avanzati').innerText = magazzino.materialiMedici.avanzati;
    document.getElementById('display-medici-critici').innerText = magazzino.materialiMedici.critici;

    const container = document.getElementById('party-container');
    container.innerHTML = "";

    const assistStatus = assistenzaSelezionata ?
        `<div style="margin-bottom:12px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <button class="btn-hero" onclick="apriAiutoModal()">🤝 Aiuta qualcuno</button>
            <div style="flex:1; min-width:220px; color:#f1c40f;">Assistente selezionato: <strong>${party[assistenzaSelezionata.idx]?.nome || 'Nessuno'}</strong> per <strong>${assistenzaSelezionata.tipo}</strong></div>
            <button class="btn-big" style="background:#c0392b;" onclick="annullaAssistente()">Annulla assistenza</button>
        </div>` :
        `<div style="margin-bottom:12px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <button class="btn-hero" onclick="apriAiutoModal()">🤝 Aiuta qualcuno</button>
        </div>`;
    container.innerHTML = assistStatus;

    // Applica effetti dei perk (retroattivo/continuo)
    party.forEach(papply => { if (typeof applyPerkEffects === 'function') applyPerkEffects(papply); });

    party.forEach((p, idx) => {
        // Calcolo Barre con Decimali
        const risorse = [
            { label: "Fame", attuale: p.fame, max: 14 },
            { label: "Sete", attuale: p.sete, max: 4 },
            { label: "Sonno", attuale: p.sonno, max: 8 }
        ];

        let barsHtml = "";
        risorse.forEach(r => {
            let taccheHtml = "";
            const colore = getColoreBarra((r.attuale / r.max) * 100);
            for (let i = 0; i < r.max; i++) {
                let opacita = 0.2;
                if (i < Math.floor(r.attuale)) opacita = 1;
                else if (i === Math.floor(r.attuale)) opacita = 0.2 + (r.attuale % 1) * 0.8;
                taccheHtml += `<div class="tacca" style="background-color: ${colore}; opacity: ${opacita}; flex: 1; height: 8px; margin: 1px; border-radius: 1px;"></div>`;
            }
            barsHtml += `
                <div style="display: flex; justify-content: space-between; font-size: 0.65em; margin-top: 4px;">
                    <span>${r.label.toUpperCase()}</span>
                    <span>${r.attuale.toFixed(2)} / ${r.max}</span>
                </div>
                <div style="display: flex; background: #111; padding: 1px; border: 1px solid #333;">${taccheHtml}</div>
            `;
        });

        // Stato del Thread
        let statoAzione = "In attesa";
        if (p.inSpedizione) statoAzione = "<span style='color:#3498db'>🚚 IN SPEDIZIONE</span>";
        else if (p.azioneCorrente) statoAzione = `<span style='color:#f1c40f'>🔨 ${p.azioneCorrente.tipo.toUpperCase()} (${p.azioneCorrente.oreRimanenti}h)</span>`;

        let card = document.createElement('div');
        card.className = `card-personaggio ${p.inSpedizione ? 'spedizione-active' : ''}`;
        card.innerHTML = `
            <div class="card-header">
                <h3 style="margin:0">${p.nome}</h3>
                <span class="fatica-badge">Fatic. ${p.faticaTotale}</span>
            </div>
            <div style="font-size:0.8em; margin-bottom:4px;">
                <strong>PF Reali:</strong> ${p.puntiFeritaReali} / ${p.puntiFeritaRealiMax} - ${p.woundState}
            </div>
            <div style="font-size:0.8em; margin-bottom:6px; color:#ddd;">
                <strong>PCA in corso:</strong> ${Object.entries(p.pca || {}).filter(([, v]) => v > 0).map(([cat, val]) => `${cat}: ${val.toFixed(1)}`).join(' • ') || 'Nessuno'}
            </div>
            <div style="font-size:0.8em; margin-bottom:6px; color:#ddd;">
                <strong>Piatti deliziosi:</strong> ${magazzino.piattiDeliziosi}
            </div>
            ${getBarra(p.puntiFeritaReali, p.puntiFeritaRealiMax, '#c0392b')}
            <div style="font-size:0.75em; margin-bottom:10px; color:#aaa;">${p.woundEffectText}</div>
            <div style="font-size:0.7em; margin-bottom:10px;">Stato: <b>${statoAzione}</b></div>
            
            <div class="mini-bars-container">${barsHtml}</div>

            <button onclick="apriScheda(${idx})" style="width:100%; margin-bottom:10px;">Visualizza Scheda</button>
            <div class="action-dropdowns" style="margin-top: 12px; display:grid; gap:6px;">
                <details class="action-dropdown">
                    <summary>SOPRAVVIVI</summary>
                    <div class="dropdown-buttons">
                        <button onclick="openRisorsaModal(${idx}, 'fame')">Nutri</button>
                        <button onclick="openRisorsaModal(${idx}, 'sete')">Bevi</button>
                        <button onclick="openRisorsaModal(${idx}, 'sonno')">Dormi</button>
                        <button onclick="apriMedica(${idx})">Medica</button>
                    </div>
                </details>
                <details class="action-dropdown">
                    <summary>CREA</summary>
                    <div class="dropdown-buttons">
                                <button onclick="openCucinaModal(${idx})">Cucina</button>
                        <button onclick="alchimiaPersonaggio(${idx})">Alchimia</button>
                        <button onclick="artificeriaPersonaggio(${idx})">Artificeria</button>
                    </div>
                </details>
                <details class="action-dropdown">
                    <summary>MIGLIORA</summary>
                    <div class="dropdown-buttons">
                        <button onclick="allenamento(${idx})">Allenamento</button>
                        <button onclick="studio(${idx})">Studio</button>
                    </div>
                </details>
                <details class="action-dropdown">
                    <summary>ESPLORA</summary>
                    <div class="dropdown-buttons">
                        <button onclick="spedisciPersonaggio(${idx})">Spedisci</button>
                        <button onclick="esplora(${idx})">🔎 Esplora</button>
                    </div>
                </details>
            </div>
        `;
        container.appendChild(card);
    });
    renderCimitero();
}

// --- LOGICA DELLE AZIONI (Thread e Code) ---
function toggleSpedizione(idx) {
    party[idx].inSpedizione = !party[idx].inSpedizione;
    aggiornaInterfaccia();
}

function alchimiaPersonaggio(idx) {
    alchimiaPersonaggioSelezionata = idx;
    renderAlchemyModal();
    const modal = document.getElementById('modal-alchimia');
    if (modal) modal.style.display = 'block';
}

function apriAiutoModal() {
    renderAiutoModal();
    const modal = document.getElementById('modal-aiuto');
    if (modal) modal.style.display = 'block';
}

function annullaAssistente() {
    assistenzaSelezionata = null;
    aggiornaInterfaccia();
    if (typeof mostraNotificaInAlto === 'function') mostraNotificaInAlto('Assistenza annullata.', 'avviso');
}

function selezionaAssistente(idx, tipo) {
    const p = party[idx];
    if (!p) return;
    assistenzaSelezionata = { idx, tipo };
    if (typeof mostraNotificaInAlto === 'function') mostraNotificaInAlto(`${p.nome} è pronto ad aiutare con ${tipo}.`, 'successo');
    renderAiutoModal();
    aggiornaInterfaccia();
}

function getCurrentActionText(p) {
    if (p.inSpedizione) return '🚚 In spedizione';
    if (p.azioneCorrente) {
        const subject = p.azioneCorrente.subject ? ` ${p.azioneCorrente.subject}` : '';
        return `🔨 ${p.azioneCorrente.tipo.toUpperCase()}${subject} (${p.azioneCorrente.oreRimanenti}h)`;
    }
    return 'In attesa';
}

function hasNaturaSupport(p) {
    return p.hasCompetenza && p.hasCompetenza('Natura');
}

function renderAiutoModal() {
    const content = document.getElementById('aiuto-content');
    if (!content) return;

    let html = `<div style="margin-bottom:14px; color:#ddd; font-size:0.9rem;">
        <p>Seleziona un personaggio disponibile e scegli che tipo di aiuto può offrire.</p>
        <p>Studiare: serve competenza nella materia studiata.</p>
        <p>Curare: serve almeno Medicina Livello 1.</p>
        <p>Alchimia: serve competenza in Natura.</p>
    </div>`;

    html += '<div style="display:grid; gap:10px;">';
    party.forEach((p, idx) => {
        const canHelpStudy = p.azioneCorrente && p.azioneCorrente.tipo === 'studio-libro' && p.hasCompetenza && p.hasCompetenza(p.azioneCorrente.subject);
        const hasStudyCandidate = party.some(target => target !== p && target.azioneCorrente && target.azioneCorrente.tipo === 'studio-libro');
        const canHelpMedicine = p.livelloMedicina >= 1;
        const canHelpAlchemy = hasNaturaSupport(p);
        html += `<div style="background:#111; padding:12px; border:1px solid #333; border-radius:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong>${p.nome}</strong>
                <span style="font-size:0.85em; color:#aaa;">${getCurrentActionText(p)}</span>
            </div>
            <div style="font-size:0.85em; color:#ccc; margin-bottom:10px;">
                ${canHelpStudy ? 'Può assistere uno studente nella materia corrente.' : 'Assist. studio: ' + (hasStudyCandidate ? 'richiede la materia giusta' : 'nessuna azione di studio attiva')}<br>
                ${canHelpMedicine ? 'Può aiutare in un intervento medico.' : 'Non può assistere in medicina'}<br>
                ${canHelpAlchemy ? 'Può assistere in Alchimia.' : 'Non può assistere in alchimia'}
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button class="btn-big" style="flex:1;" onclick="selezionaAssistente(${idx}, 'studio')" ${hasStudyCandidate ? '' : 'disabled'}>Assisti Studio</button>
                <button class="btn-big" style="flex:1;" onclick="selezionaAssistente(${idx}, 'medicina')" ${canHelpMedicine ? '' : 'disabled'}>Assisti Medicina</button>
                <button class="btn-big" style="flex:1;" onclick="selezionaAssistente(${idx}, 'alchimia')" ${canHelpAlchemy ? '' : 'disabled'}>Assisti Alchimia</button>
            </div>
        </div>`;
    });
    html += '</div>';
    content.innerHTML = html;
}

function renderAlchemyModal() {
    const container = document.getElementById('alchimia-content');
    if (!container) return;
    const p = party[alchimiaPersonaggioSelezionata];
    if (!p) {
        container.innerHTML = '<p>Seleziona prima un personaggio valido.</p>';
        return;
    }

    const naturaRating = p.getSkillRating('Natura');
    const naturaText = naturaRating >= 2 ? 'Maestria' : naturaRating === 1 ? 'Competenza' : 'Nessuna competenza';
    const assistInfo = assistenzaSelezionata && assistenzaSelezionata.tipo === 'alchimia' ? `Assistente selezionato: <strong>${party[assistenzaSelezionata.idx]?.nome || 'Nessuno'}</strong>` : 'Nessun assistente alchemico selezionato.';

    let html = `<div style="margin-bottom:14px; color:#ddd;">
        <strong>Alchimista:</strong> ${p.nome}<br>
        <strong>Intelligenza:</strong> ${p.intelligenza} (mod ${p.getStatDettagliata('Intelligenza').mod})<br>
        <strong>Natura:</strong> ${naturaText}<br>
        <strong>Stazione:</strong> ${magazzino.postazioneAlchemica ? 'Creata' : 'Non presente'}<br>
        ${assistInfo}
    </div>`;

    if (!magazzino.postazioneAlchemica && magazzino.materialiAlchemici >= 15) {
        html += `<div style="margin-bottom:12px;"><button class="btn-hero" onclick="creaPostazioneAlchemica()">Crea postazione alchemica (15 materiali alchemici)</button></div>`;
    }

    Object.entries(RICETTE).forEach(([grado, ricette]) => {
        const gradeReq = grado === 'difficile' ? 'Maestria in Natura' : 'Competenza in Natura';
        html += `<div style="background:#1a1a1a; padding:10px; border:1px solid #333; border-radius:8px; margin-bottom:10px;">
            <div style="font-weight:bold; color:#f1c40f; margin-bottom:8px; text-transform:capitalize;">${grado}</div>
            <div style="font-size:0.85rem; color:#aaa; margin-bottom:10px;">Requisito: ${gradeReq}</div>
            <div style="display:grid; grid-template-columns: 1fr 60px 60px 60px 130px 100px; gap:8px; font-size:0.85rem; font-weight:bold; color:#bbb; margin-bottom:6px;">
                <div>Nome</div><div>CD</div><div>Ore</div><div>Costo</div><div>Effetto</div><div>Azione</div>
            </div>`;
        ricette.forEach((recipe, recipeIdx) => {
            const hasRequirement = grado === 'difficile' ? naturaRating >= 2 : naturaRating >= 1;
            const canCraft = magazzino.materialiAlchemici >= recipe.costo && hasRequirement;
            html += `<div style="display:grid; grid-template-columns: 1fr 60px 60px 60px 130px 100px; gap:8px; font-size:0.85rem; color:#eee; align-items:center; border-top:1px solid #222; padding-top:8px; margin-top:8px;">
                <div>${recipe.nome}</div>
                <div>${recipe.cd}</div>
                <div>${recipe.tempo}</div>
                <div>${recipe.costo}</div>
                <div style="color:#ccc;">${recipe.desc}</div>
                <button class="btn-small" onclick="startAlchemyRecipe('${grado}', ${recipeIdx})" ${canCraft ? '' : 'disabled'}>Inizia</button>
            </div>`;
        });
        html += `</div>`;
    });

    if (magazzino.compounds && magazzino.compounds.length > 0) {
        html += `<div style="margin-top:14px; color:#ddd; font-size:0.9rem;">
            <strong>Composti creati:</strong> ${magazzino.compounds.length}
            <div style="margin-top:6px; background:#111; padding:10px; border:1px solid #333; border-radius:6px;">
                ${magazzino.compounds.map(c => `<div>${c.nome} ${c.stabile ? '(stabile)' : '(instabile)'}</div>`).join('')}
            </div>
        </div>`;
    }

    container.innerHTML = html;
}

function creaPostazioneAlchemica() {
    if (magazzino.materialiAlchemici < 15) {
        alert('Non ci sono abbastanza materiali alchemici per costruire la postazione. Servono 15.');
        return;
    }
    magazzino.materialiAlchemici -= 15;
    magazzino.postazioneAlchemica = true;
    if (typeof mostraNotificaInAlto === 'function') mostraNotificaInAlto('Postazione alchemica creata.', 'successo');
    aggiornaInterfaccia();
    renderAlchemyModal();
}

function startAlchemyRecipe(grado, recipeIdx) {
    const p = party[alchimiaPersonaggioSelezionata];
    if (!p) return;
    const recipe = RICETTE[grado] && RICETTE[grado][recipeIdx];
    if (!recipe) return;
    if (!magazzino.postazioneAlchemica) {
        alert('Serve una postazione alchemica per creare compositi.');
        return;
    }
    const naturaRating = p.getSkillRating('Natura');
    const hasRequirement = grado === 'difficile' ? naturaRating >= 2 : naturaRating >= 1;
    if (!hasRequirement) {
        alert(`Non hai i requisiti di Natura per creare un composto di grado ${grado}.`);
        return;
    }
    if (magazzino.materialiAlchemici < recipe.costo) {
        alert('Materiali alchemici insufficienti.');
        return;
    }
    let durata = recipe.tempo;
    let cdBonus = 0;
    let helperText = '';
    if (assistenzaSelezionata && assistenzaSelezionata.tipo === 'alchimia') {
        const helper = party[assistenzaSelezionata.idx];
        if (helper && helper !== p && helper.hasCompetenza && helper.hasCompetenza('Natura')) {
            durata = Math.max(1, Math.floor(durata * 0.65));
            cdBonus = -3;
            helperText = ` Assistente: ${helper.nome}`;
        }
    }
    magazzino.materialiAlchemici -= recipe.costo;
    const nuovaAzione = {
        tipo: 'alchimia',
        oreTotali: durata,
        oreRimanenti: durata,
        recipeGrade: grado,
        recipeIdx: recipeIdx,
        recipeData: recipe,
        helperIdx: assistenzaSelezionata && assistenzaSelezionata.tipo === 'alchimia' ? assistenzaSelezionata.idx : null,
        cdModifier: cdBonus,
        helperText: helperText,
        onComplete: () => completeAlchemyAction(p, nuovaAzione)
    };

    if (p.azioneCorrente) {
        if (confirm(`${p.nome} sta già facendo un'azione. Vuoi metterla in coda?`)) {
            p.codaAzioni.push(nuovaAzione);
        }
    } else {
        p.azioneCorrente = nuovaAzione;
    }
    aggiornaInterfaccia();
    renderAlchemyModal();
}

function completeAlchemyAction(p, action) {
    if (!p || !action || !action.recipeData) return;
    const d20 = Math.floor(Math.random() * 20) + 1;
    const naturaRating = p.getSkillRating('Natura');
    const competenzaNatura = naturaRating === 2 ? 2 : naturaRating === 1 ? 1 : 0;
    const modInt = p.getStatDettagliata('Intelligenza').mod;
    const totale = d20 + modInt + competenzaNatura;
    const cdFinale = Math.max(1, action.recipeData.cd + (action.cdModifier || 0));
    let message = `Tiro: ${d20} + INT ${modInt} + Natura ${competenzaNatura} = ${totale} vs CD ${cdFinale}.${action.helperText ? ' ' + action.helperText : ''}`;

    if (totale >= cdFinale) {
        magazzino.compounds = magazzino.compounds || [];
        magazzino.compounds.push({ nome: action.recipeData.nome, grado: action.recipeGrade, stabile: true, effetto: action.recipeData.effetto });
        if (typeof mostraNotificaInAlto === 'function') mostraNotificaInAlto(`${p.nome} ha creato con successo ${action.recipeData.nome}.`, 'successo');
        alert(`Successo! ${message}`);
    } else if (totale >= cdFinale - 2) {
        magazzino.compounds = magazzino.compounds || [];
        magazzino.compounds.push({ nome: action.recipeData.nome, grado: action.recipeGrade, stabile: false, effetto: action.recipeData.effetto });
        if (typeof mostraNotificaInAlto === 'function') mostraNotificaInAlto(`${p.nome} ha creato ${action.recipeData.nome}, ma è instabile.`, 'avviso');
        alert(`Instabile. ${message}`);
    } else {
        if (totale <= cdFinale - 5) {
            p.puntiFeritaReali = Math.max(0, p.puntiFeritaReali - 1);
            p.faticaBase += 2;
            if (typeof mostraNotificaInAlto === 'function') mostraNotificaInAlto(`${p.nome} ha prodotto un composto tossico e subisce danni.`, 'errore');
            alert(`Tossico! ${message}`);
        } else {
            if (typeof mostraNotificaInAlto === 'function') mostraNotificaInAlto(`${p.nome} non è riuscito a creare il composto.`, 'warning');
            alert(`Fallimento. ${message}`);
        }
    }
    assistenzaSelezionata = null;
    aggiornaInterfaccia();
    renderAlchemyModal();
}

function artificeriaPersonaggio(idx) {
    alert('Funzione Artificeria in sviluppo.');
}

function puoIniziareAzione(p, tipo) {
    if (!p) return false;
    const azioniConsentite = ['dormi', 'nutri', 'disseta'];
    if (p.staminaAttuale <= 0 && !azioniConsentite.includes(tipo)) {
        alert(`${p.nome} è troppo esausto per farlo. Deve riposare, bere o mangiare prima.`);
        return false;
    }
    return true;
}

function allenamento(idx) {
    const modal = document.getElementById('modal-allenamento');
    const content = document.getElementById('allenamento-content');
    const p = party[idx];
    if (!puoIniziareAzione(p, 'allenamento')) return;

    const categorie = ['Archi', 'Balestre', 'Armi con l\'asta', 'Lame leggere', 'Armi da fuoco', 'Rampini e fruste', 'Mazze e armi contundenti'];
    const giornoAttuale = Math.floor(oreTotali / 24);
    const gratuite = p.calcolaOreAllenamentoGratuite(giornoAttuale);
    const rimanenti = Math.max(0, gratuite - p.oreAllenamento);
    
    let html = `<div style="margin-bottom:12px; color:#ddd;">
        <p><strong>${p.nome}</strong></p>
        <p>Ore allenamento gratuite oggi: <span style="color:#2ecc71">${rimanenti}/${gratuite}</span></p>
        <p>Stamina attuale: ${p.staminaAttuale}/${p.staminaMax}</p>
    </div>
    <p style="font-weight:bold; color:#f1c40f; margin-bottom:10px;">Seleziona categoria arma e ore da programmare:</p>
    <div style="display:grid; gap:10px;">`;
    
    categorie.forEach(cat => {
        const pca = p.pca[cat] || 0;
        html += `<div style="background:#222; padding:8px; border:1px solid #333; border-radius:4px;">
            <div style="margin-bottom:6px;"><strong>${cat}</strong> - PCA: ${pca.toFixed(1)}</div>
            <div style="display:flex; gap:4px; align-items:center; margin-bottom:4px;">
                <input type="number" id="ore-${cat}" min="1" value="1" style="width:60px; padding:4px;">
                <button class="btn-big" style="flex:1;" onclick="scheduleAllenamento(${idx}, '${cat}')">Programma</button>
            </div>
        </div>`;
    });
    
    html += `</div>`;
    content.innerHTML = html;
    modal.style.display = 'block';
}

function scheduleAllenamento(idx, categoria) {
    const p = party[idx];
    if (!puoIniziareAzione(p, 'allenamento')) return;
    const oraElement = document.getElementById(`ore-${categoria}`);
    if (!oraElement) return;
    const ore = parseInt(oraElement.value);
    if (isNaN(ore) || ore <= 0) { alert('Inserisci un numero valido di ore.'); return; }

    const nuovaAzione = {
        tipo: 'allenamento',
        categoria: categoria,
        oreTotali: ore,
        oreRimanenti: ore,
        onComplete: () => completeAllenamento(p, categoria, ore)
    };

    if (p.azioneCorrente) {
        if (confirm(`${p.nome} sta già facendo un'altra azione. Vuoi mettere questo allenamento in coda?`)) {
            p.codaAzioni.push(nuovaAzione);
            alert(`${p.nome} inizierà l'allenamento quando avrà finito l'azione corrente.`);
        }
    } else {
        p.azioneCorrente = nuovaAzione;
        alert(`${p.nome} inizia l'allenamento per ${ore} ore su ${categoria}.`);
    }

    aggiornaInterfaccia();
}

function completeAllenamento(p, categoria, ore) {
    const giornoAttuale = Math.floor(oreTotali / 24);
    const result = p.addestraArma(categoria, ore, giornoAttuale);
    alert(`${p.nome} ha completato l'allenamento di ${ore} ore su ${categoria}!\n\nOre gratuite usate: ${result.oreGratuite}\nOre a pagamento: ${result.oreAGagoPagato}\nStamina consumata: ${result.staminaUsata}\nPCA guadagnato: +${result.pcaGuadagnato}`);
    aggiornaInterfaccia();
}

function registraAttaccoModal(idx) {
    const modal = document.getElementById('modal-regista-attacco');
    const content = document.getElementById('regista-attacco-content');
    const p = party[idx];
    
    const categorie = ['Archi', 'Balestre', 'Armi con l\'asta', 'Lame leggere', 'Armi da fuoco', 'Rampini e fruste', 'Mazze e armi contundenti'];
    
    let html = `<div style="margin-bottom:12px; color:#ddd;">
        <p><strong>${p.nome}</strong></p>
        <p style="font-size:0.9rem; color:#aaa;">Registra i tuoi colpi per guadagnare PCA!</p>
    </div>
    <p style="font-weight:bold; color:#f1c40f; margin-bottom:10px;">Seleziona arma e risultato:</p>
    <div style="display:grid; gap:10px;">`;
    
    categorie.forEach(cat => {
        const pca = p.pca[cat] || 0;
        html += `<div style="background:#222; padding:10px; border:1px solid #333; border-radius:4px;">
            <div style="margin-bottom:8px;"><strong>${cat}</strong> - PCA: ${pca.toFixed(1)}</div>
            <div style="display:flex; gap:4px; flex-wrap:wrap;">
                <button class="btn-big" style="flex:1; min-width:80px; background:#2ecc71;" onclick="registraColpo(${idx}, '${cat}', 'success')">✓ Colpo (+1)</button>
                <button class="btn-big" style="flex:1; min-width:80px; background:#f39c12;" onclick="registraColpo(${idx}, '${cat}', 'critical')">⚡ Critico (+2)</button>
                <button class="btn-big" style="flex:1; min-width:80px; background:#e74c3c;" onclick="registraColpo(${idx}, '${cat}', 'fail')">✗ Mancato (+0.5)</button>
            </div>
        </div>`;
    });
    
    html += `</div>`;
    content.innerHTML = html;
    modal.style.display = 'block';
}

function registraColpo(idx, categoria, risultato) {
    const p = party[idx];
    p.registraColpoCombattimento(categoria, risultato);
    
    const labels = { success: 'Colpo riuscito', critical: 'Colpo critico', fail: 'Colpo fallito' };
    const gains = { success: 1, critical: 2, fail: 0.5 };
    
    alert(`${p.nome} ha registrato un ${labels[risultato]} con ${categoria}!\n+${gains[risultato]} PCA`);
    registraAttaccoModal(idx); // Refresh
    aggiornaInterfaccia();
}

function visualizzaPerk(idx) {
    const modal = document.getElementById('modal-perk-viewer');
    const content = document.getElementById('perk-viewer-content');
    const p = party[idx];
    
    let html = `<div style="margin-bottom:12px; color:#ddd;">
        <p><strong>Competenze di ${p.nome}</strong></p>
    </div>`;
    
    if (p.competenze && p.competenze.length > 0) {
        html += `<div style="margin-bottom:14px; background:#1a1a1a; padding:10px; border:1px solid #333; border-radius:6px;">
            <p style="color:#f1c40f; font-weight:bold; margin-bottom:8px;">COMPETENZE (${p.competenze.length})</p>
            ${p.competenze.map(c => `<div style="color:#2ecc71; margin-bottom:4px;">✓ ${c}</div>`).join('')}
        </div>`;
    }
    
    if (p.masteries && p.masteries.length > 0) {
        html += `<div style="margin-bottom:14px; background:#1a1a1a; padding:10px; border:1px solid #333; border-radius:6px;">
            <p style="color:#f1c40f; font-weight:bold; margin-bottom:8px;">MAESTRIE (${p.masteries.length})</p>
            ${p.masteries.map(m => `<div style="color:#ff9800; margin-bottom:4px;">⭐ ${m}</div>`).join('')}
        </div>`;
    }
    
    if (p.perks && p.perks.length > 0) {
        const medicinePerks = p.perks.filter(perk => {
            if (typeof perk === 'string') return false;
            return perk && perk.nome && perk.nome.toLowerCase().includes('medicina');
        });
        
        // Mostra solo i perk di medicina se ne ha comprato
        if (medicinePerks.length > 0) {
            html += `<div style="margin-bottom:14px; background:#1a1a1a; padding:10px; border:1px solid #333; border-radius:6px;">
                <p style="color:#f1c40f; font-weight:bold; margin-bottom:8px;">MEDICINA ACQUISITA (${medicinePerks.length})</p>`;
            medicinePerks.forEach(perk => {
                html += `<div style="background:#111; padding:6px; margin-bottom:6px; border-left:3px solid #16a085; border-radius:3px;">
                    <div style="color:#16a085; font-weight:bold; margin-bottom:2px;">${perk.nome}</div>
                    <div style="color:#aaa; font-size:0.9rem;">${perk.desc}</div>
                    <div style="color:#888; font-size:0.85rem; margin-top:2px;"><em>Costo: ${perk.costo}</em></div>
                </div>`;
            });
            html += `</div>`;
        }
        
        // Mostra gli altri perk
        const otherPerks = p.perks.filter(perk => {
            if (typeof perk === 'string') return true;
            return !perk || !perk.nome || !perk.nome.toLowerCase().includes('medicina');
        });
        
        if (otherPerks.length > 0) {
            html += `<div style="margin-bottom:14px; background:#1a1a1a; padding:10px; border:1px solid #333; border-radius:6px;">
                <p style="color:#f1c40f; font-weight:bold; margin-bottom:8px;">PERK (${otherPerks.length})</p>`;
            otherPerks.forEach(perk => {
                if (typeof perk !== 'string') {
                    html += `<div style="background:#111; padding:6px; margin-bottom:6px; border-left:3px solid #3498db; border-radius:3px;">
                        <div style="color:#3498db; font-weight:bold; margin-bottom:2px;">${perk.nome}</div>
                        <div style="color:#aaa; font-size:0.9rem;">${perk.desc}</div>
                        <div style="color:#888; font-size:0.85rem; margin-top:2px;"><em>Costo: ${perk.costo}</em></div>
                    </div>`;
                }
            });
            html += `</div>`;
        }
    } else {
        html += `<div style="margin-bottom:14px; background:#1a1a1a; padding:10px; border:1px solid #333; border-radius:6px;">
            <p style="color:#f1c40f; font-weight:bold; margin-bottom:8px;">PERK</p>
            <p style="color:#aaa;">Nessun perk acquisito.</p>
        </div>`;
    }

    html += `<div style="margin-bottom:14px; background:#1a1a1a; padding:10px; border:1px solid #333; border-radius:6px;">
        <div style="color:#f1c40f; font-weight:bold; margin-bottom:8px;">ARMATURE E ARMI</div>
        <div style="color:#aaa; font-size:0.9rem; margin-bottom:8px;">Ogni arma ha livello e descrizione. Per salire al livello successivo serve aver già ottenuto il livello precedente.</div>`;
    TABELLA_ARMI.forEach(arma => {
        const livello = p.armiLivello ? (p.armiLivello[arma.nome] || 0) : 0;
        html += `<div style="background:#111; padding:8px; margin-bottom:6px; border-left:3px solid #9b59b6; border-radius:3px;">
            <div style="color:#9b59b6; font-weight:bold;">${arma.nome} - Livello ${livello}</div>
            <div style="color:#ccc; font-size:0.9rem;">${arma.descrizione}</div>
        </div>`;
    });
    html += `</div>`;

    html += `<div style="margin-bottom:14px; background:#1a1a1a; padding:10px; border:1px solid #333; border-radius:6px;">
        <div style="color:#f1c40f; font-weight:bold; margin-bottom:8px;">MEDICINA</div>
        <div style="color:#aaa; font-size:0.9rem; margin-bottom:8px;">La tabella Medicina mostra i progressi di trattamento curativo.</div>`;
    MEDICINA_LIVELLI.forEach(entry => {
        html += `<div style="background:#111; padding:8px; margin-bottom:6px; border-left:3px solid #16a085; border-radius:3px;">
            <div style="color:#16a085; font-weight:bold;">Livello ${entry.livello}</div>
            <div style="color:#ccc; font-size:0.9rem;">${entry.effetto}</div>
        </div>`;
    });
    html += `</div>`;

    content.innerHTML = html;
    modal.style.display = 'block';
}

function pianificaAzione(idx, tipo, bookId = null, subject = null, bookTitle = null, ore = null, teacherName = null) {
    const p = party[idx];
    if (!puoIniziareAzione(p, tipo)) return;
    let plannedHours;
    if (tipo === 'studio-libro') {
        if (!bookId || !ore) return;
        plannedHours = ore;
    } else {
        const defaultHours = tipo === 'dormi' ? '8' : '1';
        plannedHours = prompt(`Quante ore vuoi dedicare a: ${tipo.toUpperCase()}?`, defaultHours);
        plannedHours = parseFloat(plannedHours);
        if (isNaN(plannedHours) || plannedHours <= 0) return;
        if (tipo === 'dormi') {
            const maxRiposo = p.maxOreRiposo || 24;
            if (plannedHours > maxRiposo) {
                if (!confirm(`Con la tua fame/sete puoi riposare al massimo ${maxRiposo} ore. Ridurre a ${maxRiposo}?`)) return;
                plannedHours = maxRiposo;
            }
        }
    }

    const nuovaAzione = { tipo: tipo, oreTotali: plannedHours, oreRimanenti: plannedHours };
    if (tipo === 'studio-libro') {
        nuovaAzione.bookId = bookId;
        nuovaAzione.subject = subject;
        nuovaAzione.bookTitle = bookTitle;
        nuovaAzione.teacherName = teacherName;
        nuovaAzione.onComplete = () => completaStudioBookAction(p, nuovaAzione);
    } else if (tipo === 'studio') {
        nuovaAzione.onComplete = () => {
            const guadagno = awardStudyPM(p, plannedHours);
            if (guadagno > 0) {
                alert(`${p.nome} impara Medicina: +${guadagno} PM (massimo ${getStudyPMCap(p)} totali per il livello corrente).`);
            } else {
                alert(`${p.nome} studia Medicina ma non ottiene PM aggiuntivi oltre il limite attuale.`);
            }
        };
    }

    if (p.azioneCorrente) {
        if (confirm(`${p.nome} sta già facendo altro. Vuoi metterlo in coda?`)) {
            p.codaAzioni.push(nuovaAzione);
        }
    } else {
        p.azioneCorrente = nuovaAzione;
    }
    aggiornaInterfaccia();
}

function spedisciPersonaggio(idx) {
    party[idx].inSpedizione = true;
    aggiornaInterfaccia();
    openSpedizioneModal();
}

function mandaTuttiInSpedizione() {
    party.forEach(p => p.inSpedizione = true);
    aggiornaInterfaccia();
    openSpedizioneModal();
}

function openSpedizioneModal() {
    renderSpedizioneModal();
    const panel = document.getElementById('side-spedizione');
    if (panel) panel.classList.add('open');
}

function chiudiSpedizione() {
    const panel = document.getElementById('side-spedizione');
    if (panel) panel.classList.remove('open');
}

function ritiraTutti() {
    party.forEach(p => p.inSpedizione = false);
    // applica penalità 'Fino all\'ultimo' se attivata
    party.forEach(p => {
        if (p.finoAllUltimoActive) {
            if (Math.random() < 0.4) {
                if (typeof p.worsenWoundDueToTime === 'function') p.worsenWoundDueToTime();
                mostraNotificaInAlto(`${p.nome}: Penalità per Fino all'ultimo, la ferita peggiora.`, 'pericolo');
            }
            p.finoAllUltimoActive = false;
        }
        // Ripristina PF fortuna a massimo al ritorno dalla spedizione
        p.puntiFortuna = p.puntiFortunaMax;
    });
    chiudiSpedizione();
    aggiornaInterfaccia();
}

function ritiraPersonaggio(idx) {
    party[idx].inSpedizione = false;
    const p = party[idx];
    if (p.finoAllUltimoActive) {
        if (Math.random() < 0.4) {
            if (typeof p.worsenWoundDueToTime === 'function') p.worsenWoundDueToTime();
            mostraNotificaInAlto(`${p.nome}: Penalità per Fino all'ultimo, la ferita peggiora.`, 'pericolo');
        }
        p.finoAllUltimoActive = false;
    }
    // Ripristina PF fortuna a massimo al rientro
    p.puntiFortuna = p.puntiFortunaMax;
    renderSpedizioneModal();
    aggiornaInterfaccia();
}

function toggleFinoAllUltimo(idx) {
    const p = party[idx];
    p.finoAllUltimoActive = !p.finoAllUltimoActive;
    renderSpedizioneModal();
    aggiornaInterfaccia();
}

function useInizioCombattimento(idx) {
    const p = party[idx];
    if (!p) return;
    const modDex = p.getStatDettagliata('Destrezza').mod;
    const dado = p.perkFlags && p.perkFlags.natoPerCombattere ? 6 : 4;
    const roll = Math.floor(Math.random() * dado) + 1 + modDex;
    p.puntiFortuna = Math.min(p.puntiFortunaMax, p.puntiFortuna + roll);
    mostraNotificaInAlto(`${p.nome} rigenera ${roll} PF fortuna all'inizio del combattimento.`, 'successo');
    aggiornaInterfaccia();
}

function useRigeneraCombattimento(idx) {
    const p = party[idx];
    if (!p) return;
    const modDex = p.getStatDettagliata('Destrezza').mod;
    const roll = Math.max(1, Math.floor(Math.random() * 4) + 1 + modDex);
    p.puntiFortuna = Math.min(p.puntiFortunaMax, p.puntiFortuna + roll);
    mostraNotificaInAlto(`${p.nome} rigenera ${roll} PF fortuna in combattimento.`, 'successo');
    aggiornaInterfaccia();
}

function useGuerrieroRigenera(idx) {
    const p = party[idx];
    if (!p || !(p.perkFlags && p.perkFlags.guerriero)) return;
    // due volte al giorno: non gestiamo il reset giornaliero qui (semplificato)
    const modCon = p.getStatDettagliata('Costituzione').mod;
    const roll = Math.max(1, Math.floor(Math.random() * 4) + 1 + modCon); // 1d4 + modCon
    p.puntiFortuna = Math.min(p.puntiFortunaMax, p.puntiFortuna + roll);
    p.guerrieroUses = (p.guerrieroUses || 0) + 1;
    mostraNotificaInAlto(`${p.nome} usa Guerriero e rigenera ${roll} PF fortuna.`, 'successo');
    aggiornaInterfaccia();
}

function degradaInCombat(idx) {
    const p = party[idx];
    p.puntiFeritaReali = Math.max(0, p.puntiFeritaReali - 1);
    if (p.puntiFeritaReali <= 0) {
        alert(`Condoglianze ${p.nome} è morto in combattimento`);
        party.splice(idx, 1);
        if (typeof chiudiScheda === 'function') chiudiScheda();
        renderSpedizioneModal();
        aggiornaInterfaccia();
        return;
    }
    renderSpedizioneModal();
    aggiornaInterfaccia();
}

function ferisciInCombat(idx) {
    const p = party[idx];
    let input = prompt(`Quanti danni vuoi infliggere a ${p.nome}?`, '1');
    let danno = parseInt(input);
    if (isNaN(danno) || danno <= 0) return;
    const assorbito = Math.min(p.puntiFortuna, danno);
    p.puntiFortuna -= assorbito;
    let residuo = danno - assorbito;
    if (residuo > 0) {
        const colpiReali = Math.ceil(residuo / 5);
        p.puntiFeritaReali = Math.max(0, p.puntiFeritaReali - colpiReali);
    }
    if (p.puntiFeritaReali <= 0) {
        alert(`Condoglianze ${p.nome} è morto in combattimento`);
        party.splice(idx, 1);
        if (typeof chiudiScheda === 'function') chiudiScheda();
    }
    renderSpedizioneModal();
    aggiornaInterfaccia();
}

function segnaVittoria(idx) {
    const p = party[idx];
    p.registraVittoriaCombattimento();
    renderSpedizioneModal();
    aggiornaInterfaccia();
}

function renderSpedizioneModal() {
    const container = document.getElementById('spedizione-content');
    if (!container) return;
    const inSpedizione = party.filter(p => p.inSpedizione);
    if (inSpedizione.length === 0) {
        container.innerHTML = `<p>Nessun personaggio in spedizione.</p>`;
        return;
    }

    container.innerHTML = inSpedizione.map(p => {
        const idx = party.indexOf(p);
        const perkList = p.perks.length > 0 ? p.perks.map(perk => typeof perk === 'string' ? perk : perk.nome).join(' • ') : 'Nessuno';
        return `
            <div class="combat-card">
                <div class="combat-card-header">
                    <strong>${p.nome}</strong>
                    <button class="combat-retreat" onclick="ritiraPersonaggio(${idx})">RITIRA</button>
                </div>
                <div style="margin:10px 0; font-size:0.9rem;">
                    <div>❤️ PF Reali: ${p.puntiFeritaReali} / ${p.puntiFeritaRealiMax}</div>
                    ${getBarra(p.puntiFeritaReali, p.puntiFeritaRealiMax, '#c0392b')}
                    <div>✨ PF Fortuna: ${p.puntiFortuna} / ${p.puntiFortunaMax}</div>
                    ${getBarra(p.puntiFortuna, p.puntiFortunaMax, '#f1c40f')}
                    <div style="margin-top:8px; font-size:0.85rem; color:#aaa;">Vittorie comb.: ${p.vittorieCombattimento}</div>
                    <div style="margin-top:8px; font-size:0.85rem; color:#ddd;">
                        <strong>PCA:</strong> 
                        ${Object.entries(p.pca).filter(([, v]) => v > 0).map(([cat, val]) => `${cat.split(' ')[0]} ${val.toFixed(1)}`).join(' • ') || 'Nessuno'}
                    </div>
                </div>
                <div class="combat-buttons" style="display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:8px; margin-bottom:12px;">
                    <button onclick="degradaInCombat(${idx})">Degrada</button>
                    <button onclick="ferisciInCombat(${idx})">Ferisci</button>
                    <button onclick="registraAttaccoModal(${idx})">📈 Reg. Attacco</button>
                    <button onclick="useRigeneraCombattimento(${idx})">Rigenera</button>
                    <button onclick="segnaVittoria(${idx})">Segna vittoria</button>
                    ${(() => {
                        let extras = '';
                        if (p.perks.some(pp => pp.nome === 'Nato per combattere')) {
                            extras += `<button onclick="useInizioCombattimento(${idx})">Rigenera inizio</button>`;
                        }
                        if (p.perks.some(pp => pp.nome === 'Guerriero')) {
                            extras += `<button onclick="useGuerrieroRigenera(${idx})">Rigenera Guerriero</button>`;
                        }
                        if (p.perks.some(pp => pp.nome === "Fino all'ultimo")) {
                            extras += `<button onclick="toggleFinoAllUltimo(${idx})">${p.finoAllUltimoActive ? 'Disattiva FinoAll' : 'Usa Fino all\'ultimo'}</button>`;
                        }
                        return extras;
                    })()}
                </div>
                <details style="background:#111; border:1px solid #333; padding:10px; border-radius:6px;">
                    <summary style="cursor:pointer; font-weight:bold;">Mostra perks di combattimento</summary>
                    <div style="margin-top:8px; color:#eee; font-size:0.9rem;">${perkList}</div>
                    <div style="margin-top:8px; color:#ddd; font-size:0.85rem; border-top:1px dashed #333; padding-top:8px;">
                        <strong>Maestrie combattimento:</strong>
                        <div style="margin-top:6px;">${(() => {
                            const candidates = ["Giochi di carte","Intrattenere","Persuasione","Rapidità di mano","Intimidire"];
                            const found = candidates.filter(s => p.getSkillRating && p.getSkillRating(s) === 2);
                            return found.length ? found.join(' • ') : 'Nessuna';
                        })()}</div>
                    </div>
                </details>
            </div>`;
    }).join('');
}

function esplora(idx) {
    const p = party[idx];
    if (!p) return;
    if (!puoIniziareAzione(p, 'esplora')) return;

    const nuovaAzione = {
        tipo: 'esplora',
        oreTotali: 6,
        oreRimanenti: 6,
        onComplete: () => terminaEsplorazione(p)
    };

    if (p.azioneCorrente) {
        if (confirm(`${p.nome} sta già facendo un'altra azione. Vuoi mettere l'esplorazione in coda?`)) {
            p.codaAzioni.push(nuovaAzione);
            alert(`${p.nome} esplorerà non appena avrà finito l'azione corrente.`);
        }
    } else {
        p.azioneCorrente = nuovaAzione;
        alert(`${p.nome} parte per un'esplorazione di 6 ore. Usa ATTENDI per completarla.`);
    }
    aggiornaInterfaccia();
}

function terminaEsplorazione(p) {
    if (!p) return;
    const bonus = getExplorationBonus(p);
    const skill = p.getSkillModifierForCheck ? p.getSkillModifierForCheck('Sopravvivenza') : { modifier: 0, advantage: false, disadvantage: false };

    const mediciTiro = Math.min(20, rollD20WithAdv(skill.advantage, skill.disadvantage) + bonus);
    const ingranaggiTiro = Math.min(20, rollD20WithAdv(skill.advantage, skill.disadvantage) + bonus);
    const alchemiciTiro = Math.min(20, rollD20WithAdv(skill.advantage, skill.disadvantage) + bonus);
    const ciboTiro = Math.min(20, rollD20WithAdv(skill.advantage, skill.disadvantage) + bonus);
    const acquaTiro = Math.min(20, rollD20WithAdv(skill.advantage, skill.disadvantage) + bonus)*1.25;

    const medici = lootMedici(mediciTiro);
    const ingranaggi = lootIngranaggi(ingranaggiTiro);
    const alchemici = lootAlchemici(alchemiciTiro);
    const cibo = lootCiboAcqua(ciboTiro);
    const acqua = lootCiboAcqua(acquaTiro);
    const deliziosi = lootPiattiDeliziosi(ciboTiro);

    magazzino.materialiAlchemici += alchemici;
    magazzino.ingranaggi += ingranaggi;
    magazzino.materialiMedici.base += medici.base;
    magazzino.materialiMedici.avanzati += medici.avanzati;
    magazzino.materialiMedici.critici += medici.critici;
    magazzino.cibo += cibo;
    magazzino.acqua += acqua;
    magazzino.piattiDeliziosi += deliziosi;
    const booksTiro = Math.min(20, rollD20() + bonus);
    const booksFound = lootBooks(booksTiro);

    alert(`Esplorazione completata da ${p.nome}!\n\nRisultati:\n` +
        `• Materiali alchemici: +${alchemici} (d20 ${alchemiciTiro})\n` +
        `• Ingranaggi: +${ingranaggi} (d20 ${ingranaggiTiro})\n` +
        `• Materiali medici: base +${medici.base}, avanzati +${medici.avanzati}, critici +${medici.critici} (d20 ${mediciTiro})\n` +
        `• Cibo: +${cibo} (d20 ${ciboTiro})\n` +
        `• Acqua: +${acqua} (d20 ${acquaTiro})\n` +
        `${deliziosi > 0 ? `• Piatti deliziosi: +${deliziosi} (d20 ${ciboTiro})\n` : ''}` +
        `• Libri: +${booksFound} (d20 ${booksTiro})\n` +
        `Bonus esplorazione: ${bonus >= 0 ? '+' : ''}${bonus}`);
    aggiornaInterfaccia();
}

function rollD20() {
    return Math.floor(Math.random() * 20) + 1;
}

function rollD20WithAdv(advantage, disadvantage) {
    if (advantage && !disadvantage) {
        const a = rollD20();
        const b = rollD20();
        return Math.max(a, b);
    }
    if (disadvantage && !advantage) {
        const a = rollD20();
        const b = rollD20();
        return Math.min(a, b);
    }
    return rollD20();
}

function rollDice(count, faces) {
    let total = 0;
    for (let i = 0; i < count; i++) {
        total += Math.floor(Math.random() * faces) + 1;
    }
    return total;
}

function getExplorationBonus(p) {
    const skill = p.getSkillModifierForCheck ? p.getSkillModifierForCheck('Sopravvivenza') : { modifier: 0, advantage: false, disadvantage: false };
    return skill.modifier || 0;
}

function lootMedici(tiro) {
    let base = 0;
    let avanzati = 0;
    let critici = 0;

    if (tiro >= 5 && tiro <= 8) {
        base = rollDice(1, 4);
    } else if (tiro <= 11) {
        base = rollDice(2, 4);
    } else if (tiro <= 14) {
        base = rollDice(2, 4);
        avanzati = rollDice(1, 4);
    } else if (tiro <= 17) {
        base = rollDice(2, 6);
        avanzati = rollDice(2, 4);
        critici = rollDice(1, 4);
    } else if (tiro <= 19) {
        base = rollDice(2, 8);
        avanzati = rollDice(2, 6);
        critici = rollDice(2, 4);
    } else if (tiro === 20) {
        base = rollDice(3, 8);
        avanzati = rollDice(2, 8);
        critici = rollDice(2, 6);
    }
    return { base, avanzati, critici };
}

function lootIngranaggi(tiro) {
    if (tiro === 1) return 0;
    if (tiro <= 7) return rollDice(1, 4) + 1;
    if (tiro <= 13) return rollDice(1, 6) + 2;
    if (tiro <= 17) return rollDice(2, 6) + 4;
    if (tiro <= 19) return rollDice(2, 8) + 8;
    return rollDice(2, 12) + 16;
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

function lootCiboAcqua(tiro) {
    if (tiro <= 2) return rollDice(1, 4) / 2;
    if (tiro <= 4) return rollDice(1, 4);
    if (tiro <= 9) return rollDice(1, 6) + 1;
    if (tiro <= 13) return rollDice(1, 8) + 2;
    if (tiro <= 17) return rollDice(1, 12) + 4;
    if (tiro <= 19) return rollDice(2, 10) + 6;
    return rollDice(3, 12) + 10;
}

function lootPiattiDeliziosi(tiro) {
    if (tiro <= 9) return 0;
    if (tiro <= 13) return 1;
    if (tiro <= 17) return 2;
    if (tiro <= 19) return rollDice(1, 4) + 1;
    return 3 + rollDice(1, 4);
}

function lootBooks(tiro) {
    let count = 0;
    if (tiro <= 3) count = 0;
    else if (tiro <= 8) count = 1;
    else if (tiro <= 12) count = 2;
    else if (tiro <= 15) count = 3;
    else if (tiro <= 18) count = 4;
    else count = 5;

    const topics = [
        ['Addestrare animali',0.07], ['Arcano',0.08], ['Cucina',0.08], ['Indagare',0.04], ['Giochi di carte',0.03],
        ['Inganno',0.03], ['Storia',0.09], ['Manodopera',0.04], ['Strumenti da scasso',0.04], ['Sopravvivenza',0.06],
        ['Religione',0.08], ['Persuasione',0.05], ['Natura',0.08], ['Intrattenere',0.05],
        ['Intimidire',0.02], ['Medicina',0.06]
    ];
    const total = topics.reduce((s,t)=>s+t[1],0);
    const normalized = topics.map(t=>[t[0], t[1]/total]);

    for (let i = 0; i < count; i++) {
        let r = Math.random();
        let cum = 0;
        let subject = 'Medicina';
        for (let j = 0; j < normalized.length; j++) {
            cum += normalized[j][1];
            if (r <= cum) {
                subject = normalized[j][0];
                break;
            }
        }
        const hours = randomStudyHours();
        const titleList = BOOK_SUBJECT_TITLES[subject] || [subject];
        const title = titleList[Math.floor(Math.random() * titleList.length)];
        magazzino.libri.push({
            id: `libro-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            subject,
            title,
            hours,
            maxStudyHours: hours * 2,
            usedHours: 0
        });
    }
    return count;
}

// --- RISORSE (Istantanee, 1 Unità = 1 Tacca) ---
function nutri(idx) {
    const p = party[idx];
    let qty = prompt(`Quanto cibo dare a ${p.nome}? (Disponibile: ${magazzino.cibo})`, "1");
    qty = parseFloat(qty);
    if (isNaN(qty) || qty <= 0 || qty > magazzino.cibo) return;

    magazzino.cibo -= qty;
    if (p.fame >= 14) p.timers.buffFame = 6;
    p.fame = Math.min(16, p.fame + qty * getFoodEfficiency(p)); // 1 Unità = 1 Tacca modificata dai perk
    p.timers.fameSoddisfatta = 3;
    aggiornaInterfaccia();
}

function apriBiblioteca() {
    const modal = document.getElementById('modal-biblioteca');
    const content = document.getElementById('biblioteca-content');
    if (!modal || !content) return;
    let html = '<h3>Libri nella biblioteca</h3>';
    if (!magazzino.libri.length) {
        html += '<p>No books available at the moment.</p>';
    } else {
        html += '<div style="display:grid; grid-template-columns: 1fr 140px 120px 120px; gap:6px; align-items:center; font-weight:bold; margin-bottom:8px;">';
        html += '<div>Titolo</div><div>Materia</div><div>Ore restanti</div><div>Ore libro</div>';
        html += '</div>';
        magazzino.libri.forEach(book => {
            html += `<div style="padding:6px; background:#0f0f0f; border:1px solid #222;">${book.title}</div>`;
            html += `<div style="padding:6px; background:#0f0f0f; border:1px solid #222;">${book.subject}</div>`;
            html += `<div style="padding:6px; background:#0f0f0f; border:1px solid #222; text-align:right;">${Math.max(0, book.maxStudyHours - book.usedHours)}h</div>`;
            html += `<div style="padding:6px; background:#0f0f0f; border:1px solid #222; text-align:right;">${book.hours}h</div>`;
        });
    }
    content.innerHTML = html;
    modal.style.display = 'block';
}

function applyPerkEffects(p) {
    if (!p) return;
    p.perkFlags = p.perkFlags || {};
    // Guerriero: PF fortuna max 20
    if (p.perks && p.perks.some(pp => pp.nome === 'Guerriero')) {
        p.puntiFortunaMax = 20;
        p.perkFlags.guerriero = true;
    } else {
        // default base
        p.puntiFortunaMax = p.puntiFortunaMax || 15;
    }
    // Se il personaggio è al max, mantieni pieno
    if (!p.inSpedizione) p.puntiFortuna = Math.min(p.puntiFortuna, p.puntiFortunaMax);
}

function bevi(idx, qty = null) {
    const p = party[idx];
    if (!p) return;
    if (qty === null) {
        qty = prompt(`Quanta acqua dare a ${p.nome}? (Disponibile: ${magazzino.acqua})`, "1");
        qty = parseFloat(qty);
    }
    if (isNaN(qty) || qty <= 0 || qty > magazzino.acqua) return;

    magazzino.acqua -= qty;
    recordResourceConsumption(p, qty, 'acqua');
    if (p.sete >= 4) p.timers.buffSete = 6;
    p.sete = Math.min(5, p.sete + qty * getWaterEfficiency(p));
    p.timers.seteSoddisfatta = 2;
    aggiornaInterfaccia();
}

function disseta(idx, qty = null) {
    return bevi(idx, qty);
}

function openRisorsaModal(idx, tipo) {
    const p = party[idx];
    if (!p) return;
    const modal = document.getElementById('modal-risorse');
    const title = tipo === 'fame' ? 'NUTRI' : tipo === 'sete' ? 'BEVI' : 'DORMI';
    const content = document.getElementById('risorse-content');
    const labels = {
        fame: { resource: 'Cibo', available: magazzino.cibo, stat: p.fame, max: 16, unit: 'unità' },
        sete: { resource: 'Acqua', available: magazzino.acqua, stat: p.sete, max: 5, unit: 'unità' },
        sonno: { resource: 'Sonno', available: null, stat: p.sonno, max: 8, unit: 'ore' }
    };
    const info = labels[tipo];
    const autoSetting = p.autoRisorse[tipo] ? p.autoRisorse[tipo] : 'Nessuna impostazione';

    let html = `<div style="margin-bottom:12px; color:#ddd;">
        <p><strong>${p.nome}</strong></p>
        <p>${title} - Stato attuale: ${info.stat.toFixed(1)} / ${info.max}</p>
        <p>Impostazione automatica: <strong>${autoSetting}</strong></p>
    </div>`;

    if (tipo === 'fame') {
        html += `<div style="margin-bottom:12px; color:#ddd;"><p>Piatti deliziosi: <strong>${magazzino.piattiDeliziosi}</strong></p></div>`;
    }

    html += `<div style="display:grid; gap:10px; margin-bottom:14px;">
        <button class="btn-big" style="background:#27ae60;" onclick="manualRisorsa('${tipo}', ${idx})">${title} diretto</button>
        <button class="btn-big" style="background:#e67e22;" onclick="setAutoRisorsa(${idx}, '${tipo}', 'bene')">${title} per star bene</button>
        <button class="btn-big" style="background:#f39c12;" onclick="setAutoRisorsa(${idx}, '${tipo}', 'raziona')">Raziona</button>
        <button class="btn-big" style="background:#d35400;" onclick="setAutoRisorsa(${idx}, '${tipo}', 'elevato')">Raziona elevato</button>
        <button class="btn-big" style="background:#c0392b;" onclick="setAutoRisorsa(${idx}, '${tipo}', 'eccessivo')">Razionamento eccessivo</button>
        <button class="btn-big btn-cancel" style="background:#444;" onclick="clearAutoRisorsa(${idx}, '${tipo}')">Annulla automatismo</button>
    </div>`;

    if (tipo !== 'sonno') {
        html += `<div style="color:#aaa; font-size:0.85rem;">L'autonutrimento usa sempre cibo/acqua normale, non piatti deliziosi.</div>`;
    }

    content.innerHTML = html;
    document.getElementById('risorse-titolo').innerText = title;
    modal.style.display = 'block';
}

function manualRisorsa(tipo, idx) {
    const p = party[idx];
    if (!p) return;
    if (tipo === 'fame') {
        if (magazzino.piattiDeliziosi > 0) {
            if (confirm('Vuoi utilizzare un pasto delizioso invece di cibo normale?')) {
                nutri(idx, 'delizioso');
                return;
            }
        }
        nutri(idx);
    } else if (tipo === 'sete') {
        bevi(idx);
    } else if (tipo === 'sonno') {
        pianificaAzione(idx, 'dormi');
    }
    document.getElementById('modal-risorse').style.display = 'none';
}

function setAutoRisorsa(idx, tipo, livello) {
    const p = party[idx];
    if (!p) return;
    p.autoRisorse[tipo] = livello;
    document.getElementById('modal-risorse').style.display = 'none';
    alert(`${p.nome} ora utilizzerà la modalità automatica '${livello}' per ${tipo}.`);
    aggiornaInterfaccia();
}

function clearAutoRisorsa(idx, tipo) {
    const p = party[idx];
    if (!p) return;
    p.autoRisorse[tipo] = null;
    document.getElementById('modal-risorse').style.display = 'none';
    alert(`Impostazione automatica di ${tipo} rimossa per ${p.nome}.`);
    aggiornaInterfaccia();
}

function getAutoThreshold(tipo, livello) {
    const map = {
        fame: { bene: 12, raziona: 9, elevato: 7, eccessivo: 4 },
        sete: { bene: 4, raziona: 3, elevato: 2, eccessivo: 1 },
        sonno: { bene: 7, raziona: 5, elevato: 3, eccessivo: 1 }
    };
    return map[tipo] ? map[tipo][livello] : null;
}

function processAutomaticActions(p) {
    if (!p || p.azioneCorrente || p.inSpedizione) return;
    const stats = ['fame', 'sete', 'sonno'];
    stats.sort((a,b) => {
        const sa = p[`stadio${a.charAt(0).toUpperCase()+a.slice(1)}`];
        const sb = p[`stadio${b.charAt(0).toUpperCase()+b.slice(1)}`];
        return sb - sa;
    });

    for (const tipo of stats) {
        const livello = p.autoRisorse[tipo];
        if (!livello) continue;
        const target = getAutoThreshold(tipo, livello);
        if (!target) continue;
        let current = tipo === 'fame' ? p.fame : tipo === 'sete' ? p.sete : p.sonno;
        if (current >= target) continue;
        if (tipo === 'fame') {
            const needed = Math.min(target - current, magazzino.cibo);
            if (needed > 0) {
                nutri(party.indexOf(p), 'normale', needed);
                alert(`${p.nome} si auto-nutre fino alla soglia '${livello}'.`);
                return;
            }
        }
        if (tipo === 'sete') {
            const needed = Math.min(target - current, magazzino.acqua);
            if (needed > 0) {
                bevi(party.indexOf(p), needed);
                alert(`${p.nome} si auto-idrata fino alla soglia '${livello}'.`);
                return;
            }
        }
        if (tipo === 'sonno') {
            const oreNecessarie = Math.ceil(target - current);
            if (oreNecessarie > 0) {
                p.azioneCorrente = { tipo: 'dormi', oreTotali: oreNecessarie, oreRimanenti: oreNecessarie, onComplete: () => { const onComplete = p.azioneCorrente?.onComplete; if(typeof onComplete==='function') onComplete(); } };
                alert(`${p.nome} inizierà automaticamente a dormire per ${oreNecessarie} ore per raggiungere '${livello}'.`);
                return;
            }
        }
    }
}

function nutri(idx, tipo = 'normale', qty = null) {
    const p = party[idx];
    if (!p) return;
    if (tipo === 'delizioso') {
        if (magazzino.piattiDeliziosi <= 0) {
            alert('Nessun pasto delizioso disponibile.');
            return;
        }
        magazzino.piattiDeliziosi -= 1;
        recordResourceConsumption(p, 1);
        const deliziosoGain = 0.3 * getFoodEfficiency(p);
        p.fame = Math.min(16, p.fame + deliziosoGain);
        if (p.fame >= 14) p.timers.buffFame = 6;
        p.timers.fameSoddisfatta = 3;
        p.follia = Math.max(0, p.follia - 1);
        if (p.masteries && p.masteries.map(m => m.toLowerCase()).includes('cucina')) {
            p.puntiFortuna = Math.min(p.puntiFortunaMax, p.puntiFortuna + 1);
        }
        alert(`${p.nome} ha mangiato un pasto delizioso: fame +${deliziosoGain.toFixed(2)}, follia ridotta. ${p.masteries && p.masteries.map(m => m.toLowerCase()).includes('cucina') ? 'Fortuna temporanea +1.' : ''}`);
        aggiornaInterfaccia();
        return;
    }
    if (qty === null) {
        qty = prompt(`Quanto cibo dare a ${p.nome}? (Disponibile: ${magazzino.cibo})`, "1");
        qty = parseFloat(qty);
    }
    if (isNaN(qty) || qty <= 0) return;
    if (qty > magazzino.cibo) qty = magazzino.cibo;
    if (qty <= 0) return;

    magazzino.cibo -= qty;
    recordResourceConsumption(p, qty);
    if (p.fame >= 14) p.timers.buffFame = 6;
    p.fame = Math.min(16, p.fame + qty * getFoodEfficiency(p)); // 1 Unità = 1 Tacca modificata dai perk
    p.timers.fameSoddisfatta = 3;
    aggiornaInterfaccia();
}

function openCucinaModal(idx) {
    const p = party[idx];
    if (!p) return;
    const modal = document.getElementById('modal-cucina');
    const content = document.getElementById('cucina-content');
    let html = `<div style="margin-bottom:12px; color:#ddd;">
        <p><strong>${p.nome}</strong></p>
        <p>Piatti deliziosi disponibili: <strong>${magazzino.piattiDeliziosi}</strong></p>
        <p>Cibo disponibile: ${magazzino.cibo.toFixed(1)}, Acqua: ${magazzino.acqua.toFixed(1)}</p>
    </div>`;
    const haCucina = p.hasCompetenza && p.hasCompetenza('Cucina');
    const cucinaCost = hasPerk(p, 'Casalinga esperta') ? { ore: 2, cibo: 4, acqua: 0.5 } : { ore: 3, cibo: 5, acqua: 1 };
    html += `<div style="display:grid; gap:10px;">
            <button class="btn-big" style="background:#27ae60;" onclick="scheduleCucina(${idx})">Cucina ${cucinaCost.ore} ore</button>
            <div style="color:#aaa; font-size:0.9rem;">${cucinaCost.ore} ore, ${cucinaCost.cibo} cibo, ${cucinaCost.acqua} acqua → 12 piatti deliziosi</div>
        </div>`;
    if (!haCucina) {
        html += `<div style="color:#e74c3c; margin-top:8px;">Non hai passato abbastanza ore in cucina da giustificare l'uso delle risorse.</div>`;
    }
    if (hasPerk(p, 'Conserva')) {
        html += `<div style="display:grid; gap:10px; margin-top:14px;">
            <button class="btn-big" style="background:#8e44ad;" onclick="scheduleConserva(${idx})">Crea conserva 5 ore</button>
            <div style="color:#aaa; font-size:0.9rem;">5 ore, 4 materiali alchemici → 1 conserva</div>
        </div>`;
    }
    content.innerHTML = html;
    modal.style.display = 'block';
}

function scheduleCucina(idx) {
    const p = party[idx];
    if (!p) return;
    if (!p.hasCompetenza || !p.hasCompetenza('Cucina')) {
        alert('Non hai passato abbastanza ore in cucina da giustificare l\'uso delle risorse.');
        return;
    }
    const cucinaCost = hasPerk(p, 'Casalinga esperta') ? { ore: 2, cibo: 4, acqua: 0.5 } : { ore: 3, cibo: 5, acqua: 1 };
    if (magazzino.cibo < cucinaCost.cibo || magazzino.acqua < cucinaCost.acqua) {
        alert(`Non hai risorse sufficienti per cucinare. Servono ${cucinaCost.cibo} cibo e ${cucinaCost.acqua} acqua.`);
        return;
    }
    magazzino.cibo = Math.max(0, magazzino.cibo - cucinaCost.cibo);
    magazzino.acqua = Math.max(0, magazzino.acqua - cucinaCost.acqua);
    const nuovaAzione = {
        tipo: 'cucina',
        oreTotali: cucinaCost.ore,
        oreRimanenti: cucinaCost.ore,
        onComplete: () => completeCucina(p)
    };
    if (p.azioneCorrente) {
        if (confirm(`${p.nome} sta già facendo un'altra azione. Vuoi mettere la cucina in coda?`)) {
            p.codaAzioni.push(nuovaAzione);
            alert(`${p.nome} cucinerà non appena avrà finito l'azione corrente.`);
        }
    } else {
        p.azioneCorrente = nuovaAzione;
        alert(`${p.nome} inizia a cucinare per ${cucinaCost.ore} ore.`);
    }
    document.getElementById('modal-cucina').style.display = 'none';
    aggiornaInterfaccia();
}

function scheduleConserva(idx) {
    const p = party[idx];
    if (!p) return;
    if (!hasPerk(p, 'Conserva')) {
        alert('Questo personaggio non ha il perk Conserva.');
        return;
    }
    if (magazzino.materialiAlchemici < 4) {
        alert('Non hai abbastanza materiali alchemici per creare una conserva. Servono 4 materiali.');
        return;
    }
    magazzino.materialiAlchemici -= 4;
    const nuovaAzione = {
        tipo: 'conserva',
        oreTotali: 5,
        oreRimanenti: 5,
        onComplete: () => completeConserva(p)
    };
    if (p.azioneCorrente) {
        if (confirm(`${p.nome} sta già facendo un'altra azione. Vuoi mettere la creazione della conserva in coda?`)) {
            p.codaAzioni.push(nuovaAzione);
            alert(`${p.nome} creerà la conserva non appena avrà finito l'azione corrente.`);
        }
    } else {
        p.azioneCorrente = nuovaAzione;
        alert(`${p.nome} inizia a preparare una conserva per 5 ore.`);
    }
    document.getElementById('modal-cucina').style.display = 'none';
    aggiornaInterfaccia();
}

function completeCucina(p) {
    magazzino.piattiDeliziosi += 12;
    alert(`${p.nome} ha completato la cucina: +12 piatti deliziosi.`);
    aggiornaInterfaccia();
}

function completeConserva(p) {
    magazzino.conserve = (magazzino.conserve || 0) + 1;
    alert(`${p.nome} ha completato la conserva: +1 conserva disponibile.`);
    aggiornaInterfaccia();
}

function avviaCreazione() {
    const nomeInput = document.getElementById('crea-nome');
    if (nomeInput) nomeInput.value = ""; 

    // Inizializziamo il personaggio con i tuoi 42 punti e attributi base 6
    tempP = new Personaggio("Nuovo", Math.floor(oreTotali / 24));
    tempP.puntiCreazione = 42;
    tempP.staminaAttuale = tempP.staminaMax;

    // Visualizziamo il modal
    const modal = document.getElementById('modal-creazione');
    if(modal) modal.style.display = 'block';
    
    // Reset della categoria per sicurezza
    categoriaCorrente = "competenze base";

    // RENDERING
    renderSetupStats();
    renderSetupPerks(); // Se questa funzione non viene chiamata qui, i perk non appariranno mai

    if (nomeInput) setTimeout(() => nomeInput.focus(), 100); 
}

function renderSetupStats() {
    const stats = ["Forza", "Destrezza", "Costituzione", "Intelligenza", "Saggezza", "Carisma"];
    const container = document.getElementById('stats-setup-container');
    if (!container) return; // Sicurezza
    
    container.innerHTML = ""; // Pulisce SOLO il box delle statistiche
    stats.forEach(s => {
        const val = tempP[s.toLowerCase()];
        container.innerHTML += `
            <div class="stat-row" style="display:flex; justify-content:space-between; margin-bottom:5px; background:#222; padding:5px; border-radius:3px;">
                <span style="font-weight:bold; color:#f1c40f">${s.toUpperCase()}</span>
                <div class="stat-controls">
                    <button onclick="modificaStat('${s}', -1)">-</button>
                    <span class="stat-value" style="display:inline-block; width:25px; text-align:center">${val}</span>
                    <button onclick="modificaStat('${s}', 1)">+</button>
                </div>
            </div>`;
    });
    
    // Aggiorna il display dei punti residui
    const displayPunti = document.getElementById('punti-residui');
    if (displayPunti) {
        displayPunti.innerHTML = `Punti Disponibili: <b style="color:${tempP.puntiCreazione < 0 ? '#e74c3c' : '#2ecc71'}">${tempP.puntiCreazione}</b>`;
    }
}

function modificaStat(stat, ammontare) {
    const chiave = stat.toLowerCase();
    if (ammontare === 1) {
        const costo = tempP.calcolaCostoStat(tempP[chiave]);
        if (tempP.puntiCreazione >= costo && tempP[chiave] < 20) {
            tempP.puntiCreazione -= costo;
            tempP[chiave]++;
        }
    } else if (tempP[chiave] > 8) {
        tempP[chiave]--;
        tempP.puntiCreazione += tempP.calcolaCostoStat(tempP[chiave]);
    }
    renderSetupStats();
}

function generaHtmlStamina(p, idx) {
    let tacche = "";
    for(let i=0; i<p.staminaMax; i++) {
        const color = i < p.staminaAttuale ? "#3498db" : "#222";
        tacche += `<div style="flex:1; height:8px; background:${color}; border:1px solid #444; margin:1px;"></div>`;
    }
    return `
        <div style="margin-top:5px;">
            <div style="display:flex; justify-content:space-between; font-size:0.6em;">
                <span>STAMINA</span>
                <button onclick="riduciStaminaManual(${idx})" style="padding:0 4px; font-size:10px; background:none; color:red; border:1px solid red; cursor:pointer;">-1</button>
            </div>
            <div style="display:flex;">${tacche}</div>
        </div>
    `;
}

function riduciStaminaManual(idx) {
    if (party[idx].staminaAttuale > 0) {
        party[idx].staminaAttuale--;
        aggiornaInterfaccia();
    }
}

function confermaCreazione() {
    const nomeInput = document.getElementById('crea-nome');
    const nome = nomeInput ? nomeInput.value.trim() : "";

    if (!nome) {
        alert("Inserisci un nome per il sopravvissuto!");
        return;
    }
    if (tempP.puntiCreazione < 0) {
        alert("Hai usato troppi punti!");
        return;
    }

    // Trasferisce le competenze dai perk scelti all'array definitivo
    tempP.competenze = [];
    tempP.perks.forEach(p => {
        if (p.skills) {
            p.skills.forEach(s => {
                if (!tempP.competenze.includes(s)) tempP.competenze.push(s);
            });
        }
    });

    // Applichiamo effetti immediati di alcuni perk
    tempP.perkFlags = tempP.perkFlags || {};
    tempP.staminaAttuale = tempP.staminaMax;
    if (tempP.perks.some(pp => pp.nome === 'Guerriero')) {
        tempP.puntiFortunaMax = (tempP.puntiFortunaMax || 0) + 5;
        tempP.perkFlags.guerriero = true;
        tempP.guerrieroUses = 0;
    }
    if (tempP.perks.some(pp => pp.nome === 'Nato per combattere')) {
        tempP.perkFlags.natoPerCombattere = true;
    }

    tempP.nome = nome;
    // assicurati che i punti fortuna riflettano eventuali perk (Guerriero = 20)
    tempP.puntiFortunaMax = tempP.puntiFortunaMax || 15;
    if (tempP.perks.some(pp => pp.nome === 'Guerriero')) tempP.puntiFortunaMax = 20;
    tempP.puntiFortuna = tempP.puntiFortunaMax;

    party.push(tempP);
    
    document.getElementById('modal-creazione').style.display = 'none';
    aggiornaInterfaccia();
}

let categoriaCorrente = "competenze base";
let perkSearchQuery = "";
let perkFilterAffordableOnly = false;

function setPerkSearchQuery(query) {
    perkSearchQuery = query.toLowerCase().trim();
    renderSetupPerks();
}

function togglePerkAffordableOnly() {
    perkFilterAffordableOnly = !perkFilterAffordableOnly;
    renderSetupPerks();
}

function renderSetupPerks() {
    const container = document.getElementById('perks-setup-container');
    if (!container) return;

    const categoryOrder = [
        'background', 'competenze base', 'carisma e sociale', 'combattimento',
        'fisico e salute', 'magici', 'razziali', 'sopravvivenza', 'studio', 'medicina'
    ];

    const labelMap = {
        background: 'BACKGROUND',
        'competenze base': 'COMPETENZE BASE',
        'carisma e sociale': 'CARISMA E SOCIALE',
        combattimento: 'COMBATTIMENTO',
        'fisico e salute': 'FISICO E SALUTE',
        'Personalità e Fobie': 'PERSONALITÀ E FOBIE',
        magici: 'MAGICI',
        razziali: 'RAZZIALI',
        sopravvivenza: 'SOPRAVVIVENZA',
        studio: 'STUDIO',
        medicina: 'MEDICINA'
    };

    const searchQuery = perkSearchQuery;
    const scrollPos = container.scrollTop;

    const filterLabel = perkFilterAffordableOnly ? 'Mostra tutto' : 'Solo acquistabili';
    const filterStyle = perkFilterAffordableOnly ? 'background:#27ae60; color:#111;' : 'background:#222; color:#fff;';

    let html = `<div style="display:grid; gap:10px; max-height:70vh; overflow-y:auto; text-align:left; padding-right:6px;">
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:8px;">
            <input id="perk-search-input" type="text" placeholder="Cerca perk..." value="${perkSearchQuery.replace(/"/g,'&quot;')}" oninput="setPerkSearchQuery(this.value)"
                style="flex:1; min-width:220px; padding:10px; background:#111; color:#fff; border:1px solid #333; border-radius:8px;">
            <button class="btn-big" style="padding:10px 12px; ${filterStyle} border:1px solid #333;" onclick="togglePerkAffordableOnly()">${filterLabel}</button>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">`;

    // Pulsanti di navigazione categoria
    categoryOrder.forEach(cat => {
        if (!DATABASE_PERK[cat] || DATABASE_PERK[cat].length === 0) return;
        const active = cat === categoriaCorrente && !searchQuery ? 'background:#27ae60; color:#111;' : 'background:#222; color:#fff;';
        html += `<button class="btn-big" style="padding:8px 10px; font-size:0.8rem; ${active} border:1px solid #333;" onclick="cambiaCategoriaPerk('${cat}')">${labelMap[cat]}</button>`;
    });
    
    html += `</div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; color:#aaa; font-size:0.9rem; margin-bottom:10px;">
            <div>Categoria: <strong>${labelMap[categoriaCorrente] || categoriaCorrente}</strong></div>
            <div>Filtro: <strong>${perkFilterAffordableOnly ? 'Solo acquistabili' : 'Tutti'}</strong></div>
            ${searchQuery ? `<div>Ricerca: <strong>${searchQuery}</strong></div>` : ''}
        </div>`;

    const categoriesToRender = categoryOrder.filter(cat => {
        if (!DATABASE_PERK[cat] || DATABASE_PERK[cat].length === 0) return false;
        if (!searchQuery) return cat === categoriaCorrente;
        return DATABASE_PERK[cat].some(p => p.nome.toLowerCase().includes(searchQuery) || p.desc.toLowerCase().includes(searchQuery));
    });

    if (categoriesToRender.length === 0) {
        html += `<div style="padding:14px; background:#111; border:1px solid #333; border-radius:8px; color:#ddd;">Nessun perk trovato per questa ricerca o categoria.</div>`;
    }

    categoriesToRender.forEach(cat => {
        const categoryTitle = labelMap[cat] || cat.toUpperCase();
        const perks = DATABASE_PERK[cat].filter(p => {
            if (!searchQuery) return true;
            return p.nome.toLowerCase().includes(searchQuery) || p.desc.toLowerCase().includes(searchQuery);
        }).sort((a, b) => a.nome.localeCompare(b.nome));

        const filteredPerks = perks.filter(p => {
            if (!perkFilterAffordableOnly) return true;
            const costo = p.costo || 0;
            return costo <= tempP.puntiCreazione || costo <= 0;
        });

        if (!filteredPerks.length) return;

        html += `<div style="background:#111; border:1px solid #333; border-radius:8px; padding:12px;">
            <div style="font-size:0.95rem; margin-bottom:12px; color:#f1c40f; font-weight:bold;">${categoryTitle}</div>
            <div style="display:grid; gap:10px;">`;

        filteredPerks.forEach(p => {
            const giaPreso = tempP.perks.some(perk => perk.nome === p.nome);
            const costoHtml = `<span style="font-size:0.8rem; color:#aaa;">(${p.costo} PT)</span>`;
            html += `<div class="stat-row" style="font-size:0.82rem; padding:12px; background:#161616; border:1px solid #222; border-radius:6px; display:flex; gap:12px; align-items:flex-start; justify-content:space-between;">
                    <div style="flex:1; text-align:left;">
                        <div style="font-weight:bold; color:#f1c40f; margin-bottom:6px;">${p.nome} ${costoHtml}</div>
                        <div style="color:#bbb; font-size:0.85rem; line-height:1.4;">${p.desc}</div>
                    </div>
                    <button onclick="togglePerk('${p.nome}')" 
                            style="padding:10px 14px !important; min-width:100px; ${giaPreso ? 'background:#c0392b;' : 'background:#27ae60;'} color:#fff !important; border:none !important; border-radius:6px;">
                        ${giaPreso ? 'RIMUOVI' : 'PRENDI'}
                    </button>
                </div>`;
        });

        html += `</div></div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
    container.scrollTop = scrollPos;
}

function cambiaCategoriaPerk(nuovaCat) {
    categoriaCorrente = nuovaCat;
    perkSearchQuery = "";  // Reset ricerca quando cambi categoria
    renderSetupPerks();
}

function togglePerk(nomePerk) {
    // Troviamo i dati del perk nel database
    let perkDati = null;
    for (let cat in DATABASE_PERK) {
        let trovato = DATABASE_PERK[cat].find(p => p.nome === nomePerk);
        if (trovato) { perkDati = trovato; break; }
    }

    const index = tempP.perks.findIndex(p => p.nome === nomePerk);

    if (index > -1) {
        tempP.perks.splice(index, 1);
        tempP.puntiCreazione += perkDati.costo;
    } else {
        // Check 'requires' prerequisiti
        if (perkDati.requires) {
            const hasReq = tempP.perks.some(pp => pp.nome === perkDati.requires);
            if (!hasReq) { alert(`Devi scegliere prima ${perkDati.requires} per poter prendere ${perkDati.nome}.`); return; }
        }
        // Special rule: Arti marziali requires at least "Mani nude 1"
        if (perkDati.nome === 'Arti marziali') {
            const hasManiNude = tempP.perks.some(pp => pp.nome && pp.nome.indexOf('Mani nude') === 0);
            if (!hasManiNude) { alert('Devi selezionare almeno Mani nude 1 prima di poter acquistare Arti marziali.'); return; }
        }
        if (tempP.puntiCreazione >= perkDati.costo) {
            tempP.perks.push(perkDati);
            tempP.puntiCreazione -= perkDati.costo;
        } else {
            alert("Punti insufficienti!");
            return;
        }
    }

    document.querySelector('#punti-residui b').innerText = tempP.puntiCreazione;
    // If we removed a prerequisite, also remove any perks that depend on it (cascading)
    // e.g. rimuovendo Mani nude 1 rimuovere Arti marziali e Mani nude 2/3
    const existingNames = tempP.perks.map(p=>p.nome);
    let removedSomething = false;
    tempP.perks = tempP.perks.filter(pp => {
        if (pp.requires && !existingNames.includes(pp.requires)) { removedSomething = true; return false; }
        // If any 'Mani nude' prerequisite missing, drop Arti marziali
        if (pp.nome === 'Arti marziali') {
            const hasMani = existingNames.some(n => n.indexOf('Mani nude') === 0);
            if (!hasMani) { removedSomething = true; return false; }
        }
        return true;
    });
    if (removedSomething) alert('Alcuni perk dipendenti sono stati rimossi perché mancava il prerequisito.');
    renderSetupPerks();
}

function apriScheda(idx) {
    const p = party[idx];
    const modal = document.getElementById('modal-scheda');
    const modalContent = modal.querySelector('.modal-content');
    
    modalContent.classList.add('scheda-dettagliata');

    // 1. Generazione 6 Quadratini Stats
    let statsHtml = `<div class="stats-grid-scheda">`;
    ["Forza", "Destrezza", "Costituzione", "Intelligenza", "Saggezza", "Carisma"].forEach(s => {
        const d = p.getStatDettagliata(s);
        const statusClass = d.mod >= 0 ? 'pos' : 'neg';
        
        statsHtml += `
            <div class="stat-card-mini">
                <div class="label">${d.nome}</div>
                <div class="mod-grande ${statusClass}">${d.mod >= 0 ? '+' : ''}${d.mod}</div>
                <div class="spiegazione-mod">
                    Base ${d.modBase >= 0 ? '+' : ''}${d.modBase}${d.info.length > 0 ? '<br>' + d.info.join('<br>') : ''}
                </div>
            </div>`;
    });
    statsHtml += `</div>`;

    const lingueHtml = `
        <div style="margin-top:14px; background:#111; padding:12px; border:1px solid #333; border-radius:6px; text-align:left;">
            <div style="font-weight:bold; color:#f1c40f; margin-bottom:6px;">LINGUE CONOSCIUTE</div>
            <div style="color:#eee; font-size:0.9rem;">${p.lingue.join(' • ')}</div>
        </div>`;

    statsHtml += lingueHtml;

    // 2. Generazione Colonna Effetti Attivi
    let effettiHtml = `
        <div class="timer-column" style="text-align:left; font-size:0.85rem; background:#111; padding:12px; border-left:2px solid #ff0000;">
            <h4 style="color:#ff0000; margin-top:0; border-bottom:1px solid #333; padding-bottom:5px;">EFFETTI ATTIVI</h4>`;
    
    const displayTimer = (icon, label, time, color) => {
        if (time > 0) effettiHtml += `<p style="margin:8px 0; color:${color};">${icon} <b>${label}</b><br><small style="color:#888;">Residuo: ${time.toFixed(1)}h</small></p>`;
    };

    displayTimer("🍖", "Ben Nutrito", p.timers.buffFame, "#2ecc71");
    displayTimer("💧", "Ben Idratato", p.timers.buffSete, "#2ecc71");
    displayTimer("🧠", "Ben Riposato", p.timers.buffSonno, "#2ecc71");
    displayTimer("🍞", "Appena Mangiato", p.timers.fameSoddisfatta, "#f1c40f");
    displayTimer("🥤", "Appena Idratato", p.timers.seteSoddisfatta, "#f1c40f");
    displayTimer("🛌", "Appena Svegliato", p.timers.sonnoSoddisfatto, "#f1c40f");

    if (Object.values(p.timers).every(v => v <= 0)) effettiHtml += `<p style="color:#555;">Nessun effetto</p>`;
    effettiHtml += `</div>`;

    // 3. Render Finale Layout a 3 Colonne
    modalContent.innerHTML = `
        <h2 style="color:#ff0000; border-bottom:2px solid #ff0000; padding-bottom:10px;">${p.nome.toUpperCase()}</h2>
        <div class="scheda-grid" style="display: grid; grid-template-columns: 320px 1fr 220px; gap: 20px;">
            ${statsHtml}
            <div class="bio-column" style="text-align:left;">
                <p>❤️ <b>PF Reali:</b> ${p.puntiFeritaReali} / ${p.puntiFeritaRealiMax} - <span style="color:${p.puntiFeritaReali <= 2 ? '#e74c3c' : '#f1c40f'}">${p.woundState}</span></p>
                ${getBarra(p.puntiFeritaReali, p.puntiFeritaRealiMax, '#c0392b')}
                
                ${p.woundState !== "Illeso" && p.puntiFeritaReali > 0 ? `
                    <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; margin-top: 5px; font-size: 0.8rem; border-left: 3px solid #e74c3c;">
                        
                        <div style="margin-bottom: 4px;">
                            <span style="color: #ffaa00;">⚠️ Peggioramento:</span> 
                            ${p.woundTreated ? 
                                '<span style="color: #2ecc71;">Trattata (Timer sospeso)</span>' : 
                                `<b>${p.woundTimer.toFixed(1)}h</b> alla forma più grave`}
                        </div>

                        <div>
                            <span style="color: #3498db;">🌱 Recupero Passivo:</span> 
                            ${(!p.inSpedizione && (!p.azioneCorrente || p.azioneCorrente.tipo !== 'esplora')) ? 
                                `<b>${p.oreRiposoAccumulate.toFixed(1)}</b> / ${p.getOreNecessarieGuarigione()}h` : 
                                '<span style="color: #888;">In pausa (In movimento)</span>'}
                        </div>
                        
                        <div style="font-size: 0.7rem; color: #888; margin-top: 4px; font-style: italic;">
                            ${p.woundState === "Ferita lieve" ? "Possibile autoguarigione (70%)" : "Richiede cure per non peggiorare."}
                        </div>
                    </div>
                ` : ''}
                <p>✨ <b>PF Fortuna:</b> ${p.puntiFortuna} / ${p.puntiFortunaMax}</p>
                ${getBarra(p.puntiFortuna, p.puntiFortunaMax, '#f1c40f')}
                <p style="font-size:0.85em; color:#aaa;">${p.woundEffectText}</p>
                <p>🏅 <b>COMPETENZA:</b> <span style="color:#f1c40f">+${p.getBonusCompetenza()}</span></p>
                <p>⚡ <b>STAMINA:</b> <span style="color:#3498db">${p.staminaAttuale} / ${p.staminaMax}</span></p>
                <p>🏃 <b>FATICA TOTALE:</b> <span style="color:#e74c3c">${p.faticaTotale}</span></p>
                <p style="font-size:0.75em; color:#888;">${p.malusFaticaDettagliati.join(" • ")}</p>
                ${(() => {
                    const pcaEntry = Object.entries(p.pca || {}).filter(([, v]) => v > 0);
                    if (!pcaEntry.length) return '';
                    return `<p style="margin-top:10px; font-size:0.85em; color:#aaa;"><b>PCA ARMI:</b></p>
                        <div style="font-size:0.85em; color:#2ecc71; background:#111; padding:8px; border-radius:4px;">
                            ${pcaEntry.map(([cat, val]) => `<div>${cat}: ${val.toFixed(1)}</div>`).join('')}
                        </div>`;
                })()}
                <hr style="border:0; border-top:1px solid #444; margin:15px 0;">
                <p style="font-size:0.85em; color:#aaa;"><b>COMPETENZE:</b></p>
                <div style="font-size:0.85em; color:#eee; background:#111; padding:8px;">
                    ${p.competenze.length > 0 ? p.competenze.join(' • ') : 'Nessuna'}
                </div>
                <p style="font-size:0.85em; color:#aaa; margin-top:12px;"><b>LIVELLO MEDICINA:</b> ${p.livelloMedicina} • <b>PM MEDICINA:</b> ${p.pmMedicina}</p>
                ${(() => {
                    const entries = Object.entries(p.apprendimento || {}).filter(([, punti]) => punti > 0);
                    if (!entries.length) return '';
                    return `<div style="margin-top:12px; background:#111; padding:10px; border:1px solid #333; border-radius:6px;">
                        <div style="font-weight:bold; color:#f1c40f; margin-bottom:6px;">PROGRESSO STUDIO</div>
                        ${entries.map(([materia, punti]) => `<div style="font-size:0.85rem; margin-bottom:4px;"><strong>${materia}:</strong> ${punti}/210 punti</div>`).join('')}
                    </div>`;
                })()}
                <div style="margin-top:10px; display:flex; gap:8px;">
                    <div style="flex:1;">
                        <p style="font-size:0.85em; color:#aaa;"><b>SVANTAGGI</b></p>
                        <div style="background:#111; padding:8px; color:#eee; min-height:40px;">
                            ${(() => {
                                const allSkills = Object.keys(SKILL_SYSTEM.semantics);
                                const neg = allSkills.filter(s => p.getSkillRating && p.getSkillRating(s) === -1);
                                return neg.length ? neg.join(' • ') : 'Nessuno';
                            })()}
                        </div>
                    </div>
                    <div style="flex:1;">
                        <p style="font-size:0.85em; color:#aaa;"><b>DISASTRI (-2)</b></p>
                        <div style="background:#111; padding:8px; color:#eee; min-height:40px;">
                            ${(() => {
                                const allSkills = Object.keys(SKILL_SYSTEM.semantics);
                                const neg2 = allSkills.filter(s => p.getSkillRating && p.getSkillRating(s) === -2);
                                return neg2.length ? neg2.join(' • ') : 'Nessuno';
                            })()}
                        </div>
                    </div>
                </div>
                <p style="font-size:0.85em; color:#aaa; margin-top:12px;"><b>MAESTRIE:</b></p>
                <div style="font-size:0.85em; color:#eee; background:#111; padding:8px; text-align:left;">
                    ${(() => {
                        const allSkills = Object.keys(SKILL_SYSTEM.semantics);
                        const masters = allSkills.filter(s => p.getSkillRating && p.getSkillRating(s) === 2 && SKILL_SYSTEM.masteryDescriptions[s]);
                        return masters.length ? masters.map(skill => `<strong>${skill}:</strong> ${SKILL_SYSTEM.masteryDescriptions[skill]}`).join('<br>') : 'Nessuna maestria acquisita.';
                    })()}
                </div>
            </div>
            ${effettiHtml}
        </div>
        <div class="modal-footer" style="margin-top:20px; display:flex; gap:10px;">
            <button class="btn-hero" style="flex:1;" onclick="visualizzaPerk(${party.indexOf(p)})">COMPETENZE/PERK</button>
            <button class="btn-hero" onclick="chiudiScheda()">CHIUDI</button>
        </div>
    `;

    modal.style.display = 'block';
}

function calcolaFaticaTotale(p) {
    let malus = 0;
    if (p.fame <= 6) malus++; // Stadio 3
    if (p.sete <= 2) malus++; // Stadio 2
    if (p.sonno <= 4) malus++; // Stadio 2
    return p.faticaBase + malus;
}

function toggleCimitero() {
    const cim = document.getElementById('side-cimitero');
    cim.classList.toggle('open');
    if(cim.classList.contains('open')) renderCimitero();
}

function renderCimitero() {
    const lista = document.getElementById('cimitero-lista');
    if (!lista) return;
    lista.innerHTML = cimitero.map(m => `<div class="morto-entry"><b>${m.nome}</b><br><small>${m.causa} - ${m.data}</small></div>`).reverse().join("");
}
function chiudiScheda() { document.getElementById('modal-scheda').style.display = 'none'; }
function annullaCreazione() { document.getElementById('modal-creazione').style.display = 'none'; }
function chiudiCimitero() {
    document.getElementById('modal-cimitero').style.display = 'none';
}

function renderParty() {
    const container = document.getElementById('party-container');
    container.innerHTML = party.map((p, idx) => `
        <div class="card-personaggio">
            <h3>${p.nome}</h3>
            <p>Fatic. ${p.faticaBase}</p>
            <div class="stat-bar"><div class="bar-fill" style="width: ${p.fame}%"></div></div>
            <div class="stat-bar"><div class="bar-fill" style="width: ${p.sete}%"></div></div>
            <div class="stat-bar"><div class="bar-fill" style="width: ${p.sonno}%"></div></div>
            <button onclick="apriScheda(${idx})">DETTAGLI</button>
        </div>
    `).join('');
}

window.onclick = function(event) {
    if (event.target.className === 'modal') {
        event.target.style.display = "none";
    }
}