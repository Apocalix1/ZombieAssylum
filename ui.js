let oreTotali = 0;
let party = [];
let cimitero = [];
let magazzino = {
    cibo: 20,
    acqua: 20,
    materialiAlchemici: 5,
    ingranaggi: 3,
    materialiMedici: {
        base: 2,
        avanzati: 1,
        critici: 0
    },
    libri: []
};

function rollDiceNotation(notation) {
    const match = notation.match(/(\d+)d(\d+)/);
    if (!match) return 0;
    return rollDice(parseInt(match[1], 10), parseInt(match[2], 10));
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
    document.getElementById('display-acqua').innerText = magazzino.acqua.toFixed(1);
    document.getElementById('display-alchemici').innerText = magazzino.materialiAlchemici;
    document.getElementById('display-ingranaggi').innerText = magazzino.ingranaggi;
    document.getElementById('display-medici-base').innerText = magazzino.materialiMedici.base;
    document.getElementById('display-medici-avanzati').innerText = magazzino.materialiMedici.avanzati;
    document.getElementById('display-medici-critici').innerText = magazzino.materialiMedici.critici;

    const container = document.getElementById('party-container');
    container.innerHTML = "";

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
            ${getBarra(p.puntiFeritaReali, p.puntiFeritaRealiMax, '#c0392b')}
            <div style="font-size:0.75em; margin-bottom:10px; color:#aaa;">${p.woundEffectText}</div>
            <div style="font-size:0.7em; margin-bottom:10px;">Stato: <b>${statoAzione}</b></div>
            
            <div class="mini-bars-container">${barsHtml}</div>

            <button onclick="apriScheda(${idx})" style="width:100%; margin-bottom:10px;">Visualizza Scheda</button>
            <div class="action-dropdowns" style="margin-top: 12px; display:grid; gap:6px;">
                <details class="action-dropdown">
                    <summary>SOPRAVVIVI</summary>
                    <div class="dropdown-buttons">
                        <button onclick="nutri(${idx})">Nutri</button>
                        <button onclick="disseta(${idx})">Disseta</button>
                        <button onclick="pianificaAzione(${idx}, 'dormi')">Dormi</button>
                        <button onclick="apriMedica(${idx})">Medica</button>
                    </div>
                </details>
                <details class="action-dropdown">
                    <summary>CREA</summary>
                    <div class="dropdown-buttons">
                        <button onclick="avviaCreazione()">Crea</button>
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
    alert('Funzione Alchimia per il personaggio in sviluppo.');
}

function artificeriaPersonaggio(idx) {
    alert('Funzione Artificeria per il personaggio in sviluppo.');
}

function allenamento(idx) {
    const modal = document.getElementById('modal-allenamento');
    const content = document.getElementById('allenamento-content');
    const p = party[idx];
    
    const categorie = ['Archi', 'Balestre', 'Armi con l\'asta', 'Lame leggere', 'Armi da fuoco', 'Rampini e fruste', 'Mazze e armi contundenti'];
    const giornoAttuale = Math.floor(oreTotali / 24);
    const gratuite = p.calcolaOreAllenamentoGratuite(giornoAttuale);
    const rimanenti = Math.max(0, gratuite - p.oreAllenamento);
    
    let html = `<div style="margin-bottom:12px; color:#ddd;">
        <p><strong>${p.nome}</strong></p>
        <p>Ore allenamento gratuite oggi: <span style="color:#2ecc71">${rimanenti}/${gratuite}</span></p>
        <p>Stamina attuale: ${p.staminaAttuale}/${p.staminaMax}</p>
    </div>
    <p style="font-weight:bold; color:#f1c40f; margin-bottom:10px;">Seleziona categoria arma e ore:</p>
    <div style="display:grid; gap:10px;">`;
    
    categorie.forEach(cat => {
        const pca = p.pca[cat] || 0;
        html += `<div style="background:#222; padding:8px; border:1px solid #333; border-radius:4px;">
            <div style="margin-bottom:6px;"><strong>${cat}</strong> - PCA: ${pca.toFixed(1)}</div>
            <div style="display:flex; gap:4px; margin-bottom:4px;">
                <input type="number" id="ore-${cat}" min="1" value="1" max="${rimanenti + 4}" style="width:50px; padding:4px;">
                <button class="btn-big" style="flex:1;" onclick="executeAllenamento(${idx}, '${cat}', ${giornoAttuale})">Allena</button>
            </div>
        </div>`;
    });
    
    html += `</div>`;
    content.innerHTML = html;
    modal.style.display = 'block';
}

function executeAllenamento(idx, categoria, giornoAttuale) {
    const p = party[idx];
    const inputId = `ore-${categoria}`;
    const oraElement = document.getElementById(inputId);
    if (!oraElement) return;
    const ore = parseInt(oraElement.value);
    if (isNaN(ore) || ore <= 0) { alert('Inserisci un numero valido di ore.'); return; }
    
    const result = p.addestraArma(categoria, ore, giornoAttuale);
    alert(`${p.nome} si è allenato!\n
Ore gratuite usate: ${result.oreGratuite}\n
Ore a pagamento: ${result.oreAGagoPagato}\n
Stamina consumata: ${result.staminaUsata}\n
PCA guadagnato: +${result.pcaGuadagnato}`);
    
    allenamento(idx); // Refresh
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
                <button class="btn-big" style="flex:1; min-width:80px; background:#e74c3c;" onclick="registraColpo(${idx}, '${cat}', 'fail')">✗ Mancato (+0.2)</button>
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
    const gains = { success: 1, critical: 2, fail: 0.2 };
    
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
        html += `<div style="margin-bottom:14px; background:#1a1a1a; padding:10px; border:1px solid #333; border-radius:6px;">
            <p style="color:#f1c40f; font-weight:bold; margin-bottom:8px;">PERK (${p.perks.length})</p>`;
        p.perks.forEach(perk => {
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
    let plannedHours;
    if (tipo === 'studio-libro') {
        if (!bookId || !ore) return;
        plannedHours = ore;
    } else {
        plannedHours = prompt(`Quante ore vuoi dedicare a: ${tipo.toUpperCase()}?`, tipo === 'dormi' ? '8' : '1');
        plannedHours = parseFloat(plannedHours);
        if (isNaN(plannedHours) || plannedHours <= 0) return;
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

function useGuerrieroRigenera(idx) {
    const p = party[idx];
    if (!p || !(p.perkFlags && p.perkFlags.guerriero)) return;
    // due volte al giorno: non gestiamo il reset giornaliero qui (semplificato)
    const modCon = p.getStatDettagliata('Costituzione').mod;
    const roll = Math.floor(Math.random() * 4) + 1 + modCon; // 1d4 + modCon
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

function registraColpo(idx) {
    alert('Registra un colpo: funzione in sviluppo.');
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
    const acquaTiro = Math.min(20, rollD20WithAdv(skill.advantage, skill.disadvantage) + bonus);

    const medici = lootMedici(mediciTiro);
    const ingranaggi = lootIngranaggi(ingranaggiTiro);
    const alchemici = lootAlchemici(alchemiciTiro);
    const cibo = lootCiboAcqua(ciboTiro);
    const acqua = lootCiboAcqua(acquaTiro);

    magazzino.materialiAlchemici += alchemici;
    magazzino.ingranaggi += ingranaggi;
    magazzino.materialiMedici.base += medici.base;
    magazzino.materialiMedici.avanzati += medici.avanzati;
    magazzino.materialiMedici.critici += medici.critici;
    magazzino.cibo += cibo;
    magazzino.acqua += acqua;
    const booksTiro = Math.min(20, rollD20() + bonus);
    const booksFound = lootBooks(booksTiro);

    alert(`Esplorazione completata da ${p.nome}!\n
Risultati:\n` +
        `• Materiali alchemici: +${alchemici} (d20 ${alchemiciTiro})\n` +
        `• Ingranaggi: +${ingranaggi} (d20 ${ingranaggiTiro})\n` +
        `• Materiali medici: base +${medici.base}, avanzati +${medici.avanzati}, critici +${medici.critici} (d20 ${mediciTiro})\n` +
        `• Cibo: +${cibo} (d20 ${ciboTiro})\n` +
        `• Acqua: +${acqua} (d20 ${acquaTiro})\n` +
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
    p.fame = Math.min(16, p.fame + qty); // 1 Unità = 1 Tacca
    p.timers.fameSoddisfatta = 6;
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

function disseta(idx) {
    const p = party[idx];
    let qty = prompt(`Quanta acqua dare a ${p.nome}? (Disponibile: ${magazzino.acqua})`, "1");
    qty = parseFloat(qty);
    if (isNaN(qty) || qty <= 0 || qty > magazzino.acqua) return;

    magazzino.acqua -= qty;
    if (p.sete >= 4) p.timers.buffSete = 6;
    p.sete = Math.min(5, p.sete + qty); // 1 Unità = 1 Tacca
    p.timers.seteSoddisfatta = 3;
    aggiornaInterfaccia();
}

// --- CREAZIONE E SCHEDA (Invariate ma integrate) ---
function avviaCreazione() {
    const nomeInput = document.getElementById('crea-nome');
    if (nomeInput) nomeInput.value = ""; 

    // Inizializziamo il personaggio con i tuoi 30 punti
    tempP = new Personaggio("Nuovo", Math.floor(oreTotali / 24));
    tempP.puntiCreazione = 30; 

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

function renderSetupPerks() {
    const container = document.getElementById('perks-setup-container');
    if (!container) return;

    // 1. Generiamo i tasti delle categorie (Uniformi allo stile Hero)
    let html = `<div class="categoria-tabs" style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; margin-bottom:10px;">`;
    Object.keys(DATABASE_PERK).forEach(cat => {
        const attiva = (cat === categoriaCorrente);
        html += `<button onclick="cambiaCategoriaPerk('${cat}')" 
                 style="background:${attiva ? '#e74c3c !important' : '#111 !important'}; 
                        color:${attiva ? '#111 !important' : '#e74c3c !important'};">
                 ${cat.toUpperCase()}</button>`;
    });
    html += `</div>`;

    // 2. Generiamo la lista dei perk per la categoria selezionata
    html += `<div class="perks-list" style="max-height:200px; overflow-y:auto; text-align:left;">`;
    DATABASE_PERK[categoriaCorrente].forEach(p => {
        // Controlliamo se il personaggio ha già questo perk nella lista temporanea
        const giaPreso = tempP.perks.some(perk => perk.nome === p.nome);
        
        html += `
            <div class="stat-row" style="font-size:0.8rem; padding:10px;">
                <div style="flex-grow:1;">
                    <b style="color:#f1c40f;">${p.nome}</b> <small>(${p.costo} PT)</small><br>
                    <span style="color:#888; font-size:0.7rem;">${p.desc}</span>
                </div>
                <button onclick="togglePerk('${p.nome}')" 
                        style="padding:5px 10px !important; min-width:80px; 
                        background:${giaPreso ? '#c0392b !important' : '#27ae60 !important'};
                        color:white !important; border:none !important;">
                    ${giaPreso ? 'RIMUOVI' : 'PRENDI'}
                </button>
            </div>`;
    });
    html += `</div>`;

    container.innerHTML = html;
}

function cambiaCategoriaPerk(nuovaCat) {
    categoriaCorrente = nuovaCat;
    renderSetupPerks();
}

function toggleSezionePerk() {
    const cont = document.getElementById('perks-setup-container');
    cont.style.display = (cont.style.display === 'none') ? 'block' : 'none';
    if(cont.style.display === 'block') renderSetupPerks();
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