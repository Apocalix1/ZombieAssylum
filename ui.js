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
    }
};
let tempP = null;

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

    for (let h = 0; h < ore; h++) {
        oreTotali += 1;
        // Eseguiamo il tick orario per ogni personaggio nel party
        for (let i = party.length - 1; i >= 0; i--) {
            const p = party[i];
            const causaMorte = p.tickOra(); // Questa funzione deve esistere in logic.js
            
            if (causaMorte) {
                alert(`CONDOGLIANZE: ${p.nome} è morto per ${causaMorte}.`);
                cimitero.push({
                    nome: p.nome,
                    causa: causaMorte,
                    giorni: Math.floor(oreTotali/24) - p.giornoInizio,
                    data: `${Math.floor(oreTotali/24)}° Giorno`
                });
                party.splice(i, 1);
            }
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
function pianificaAzione(idx, tipo) {
    const p = party[idx];
    let ore = prompt(`Quante ore vuoi dedicare a: ${tipo.toUpperCase()}?`, tipo === 'dormi' ? "8" : "1");
    ore = parseFloat(ore);
    if (isNaN(ore) || ore <= 0) return;

    const nuovaAzione = { tipo: tipo, oreTotali: ore, oreRimanenti: ore };
    if (tipo === 'studio') {
        nuovaAzione.onComplete = () => {
            const guadagno = awardStudyPM(p, ore);
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

function toggleSpedizione(idx) {
    party[idx].inSpedizione = !party[idx].inSpedizione;
    aggiornaInterfaccia();
}

let medicoCorrente = null;

function apriMedica(idxMedico) {
    medicoCorrente = idxMedico;
    const feriti = party.filter(p => p.puntiFeritaReali < p.puntiFeritaRealiMax);
    if (feriti.length === 0) {
        alert('Tutti in perfetta salute per ora');
        return;
    }
    renderMedicaModal();
    const modal = document.getElementById('modal-medica');
    if (modal) modal.style.display = 'block';
}

function renderMedicaModal() {
    const container = document.getElementById('medica-content');
    if (!container) return;
    const medico = party[medicoCorrente];
    const feriti = party.filter(p => p.puntiFeritaReali < p.puntiFeritaRealiMax);
    if (!medico || feriti.length === 0) {
        container.innerHTML = `<p>Tutti in perfetta salute per ora.</p>`;
        return;
    }
    container.innerHTML = `
        <div style="margin-bottom:12px; font-size:0.9rem; color:#ddd;">
            <strong>Medico:</strong> ${medico.nome} (Int +${medico.getStatDettagliata('Intelligenza').mod})<br>
            Risorse mediche: base ${magazzino.materialiMedici.base}, avanzati ${magazzino.materialiMedici.avanzati}, critici ${magazzino.materialiMedici.critici}<br>
            Scegli il personaggio da curare:
        </div>
        ${feriti.map((p, idx) => {
            const targetIdx = party.indexOf(p);
            const req = getMedicalData(p.woundState);
            const available = hasEnoughMedicalMaterials(req);
            return `
                <div class="stat-row" style="margin-bottom:8px; background:#111;">
                    <div style="flex:1; text-align:left;">
                        <strong>${p.nome}</strong><br>
                        <small>${p.woundState} - PF Reali ${p.puntiFeritaReali}/${p.puntiFeritaRealiMax}</small><br>
                        <small>Costituzione: ${p.costituzione} (mod ${p.getStatDettagliata('Costituzione').mod >= 0 ? '+' : ''}${p.getStatDettagliata('Costituzione').mod})</small><br>
                        <small>CD base: ${req.cd}, PM: ${req.pm}, Materiali: ${req.base} base, ${req.avanzati} avanzati, ${req.critici} critici</small>
                    </div>
                    <button onclick="curaTarget(${targetIdx})" style="min-width:100px; background:${available ? '#27ae60 !important' : '#555 !important'}; color:white !important;" ${available ? '' : 'disabled'}>Cura</button>
                </div>`;
        }).join('')}
    `;
}

function getMedicalData(woundState) {
    switch (woundState) {
        case 'Ferita lieve': return { cd: 12, pm: 1, base: 5, avanzati: 0, critici: 0 };
        case 'Ferita profonda': return { cd: 16, pm: 3, base: 10, avanzati: 2, critici: 0 };
        case 'Funzionalità a rischio': return { cd: 20, pm: 7, base: 15, avanzati: 8, critici: 1 };
        case 'Rischio di morte': return { cd: 24, pm: 10, base: 30, avanzati: 16, critici: 5 };
        default: return { cd: 12, pm: 0, base: 0, avanzati: 0, critici: 0 };
    }
}

function hasEnoughMedicalMaterials(req) {
    return magazzino.materialiMedici.base >= req.base &&
           magazzino.materialiMedici.avanzati >= req.avanzati &&
           magazzino.materialiMedici.critici >= req.critici;
}

function takeMedicalMaterials(req, half = false) {
    const divisor = half ? 2 : 1;
    magazzino.materialiMedici.base = Math.max(0, magazzino.materialiMedici.base - Math.ceil(req.base / divisor));
    magazzino.materialiMedici.avanzati = Math.max(0, magazzino.materialiMedici.avanzati - Math.ceil(req.avanzati / divisor));
    magazzino.materialiMedici.critici = Math.max(0, magazzino.materialiMedici.critici - Math.ceil(req.critici / divisor));
}

function getMedicineLevelBonus(level) {
    switch (level) {
        case 2: return 1;
        case 3: return 2;
        case 5: return 3;
        default: return 0;
    }
}

function curaTarget(targetIdx) {
    const medico = party[medicoCorrente];
    const target = party[targetIdx];
    if (!medico || !target) return;
    const req = getMedicalData(target.woundState);
    if (!hasEnoughMedicalMaterials(req)) {
        alert('Risorse mediche insufficienti per questo intervento.');
        return;
    }

    const modCost = target.getStatDettagliata('Costituzione').mod;
    const dc = Math.max(5, req.cd - modCost);
    const tiro = Math.floor(Math.random() * 20) + 1 + medico.getStatDettagliata('Intelligenza').mod + getMedicineLevelBonus(medico.livelloMedicina);
    const successo = tiro >= dc;
    const scarto = tiro - dc;

    if (successo) {
        takeMedicalMaterials(req, false);
        target.receiveMedicalTreatment(true);
        target.pmMedicina += req.pm;
        alert(`${medico.nome} cura ${target.nome}! Tiro ${tiro} vs DC ${dc}. PM +${req.pm}.`);
    } else {
        takeMedicalMaterials(req, true);
        alert(`${medico.nome} fallisce a curare ${target.nome}. Tiro ${tiro} vs DC ${dc}. Perdita 50% materiali.`);
        if (scarto <= -5) {
            infestazioneWound(target);
            alert(`Fallimento critico: la ferita di ${target.nome} peggiora di grado.`);
        }
    }
    renderMedicaModal();
    aggiornaInterfaccia();
}

function infestazioneWound(target) {
    if (!target || target.puntiFeritaReali <= 0) return;
    target.puntiFeritaReali = Math.max(0, target.puntiFeritaReali - 1);
    target.resetWoundTimer();
}

function alchimiaPersonaggio(idx) {
    alert('Funzione Alchimia per il personaggio in sviluppo.');
}

function artificeriaPersonaggio(idx) {
    alert('Funzione Artificeria per il personaggio in sviluppo.');
}

function allenamento(idx) {
    alert('Funzione Allenamento in sviluppo.');
}

function studio(idx) {
    const p = party[idx];
    if (!p) return;
    pianificaAzione(idx, 'studio');
}

function getStudyPMCap(p) {
    const livelli = [8, 24, 40, 56, 72];
    const next = livelli[p.livelloMedicina] || 72;
    return Math.floor(next * 0.4);
}

function awardStudyPM(p, ore) {
    const guadagno = Math.floor(ore / 2);
    if (guadagno <= 0) return 0;
    const cap = getStudyPMCap(p);
    const nuovoTotale = Math.min(cap, p.pmMedicina + guadagno);
    const effettivo = nuovoTotale - p.pmMedicina;
    p.pmMedicina = nuovoTotale;
    return effettivo;
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
    chiudiSpedizione();
    aggiornaInterfaccia();
}

function ritiraPersonaggio(idx) {
    party[idx].inSpedizione = false;
    renderSpedizioneModal();
    aggiornaInterfaccia();
}

function degradaInCombat(idx) {
    const p = party[idx];
    p.puntiFeritaReali = Math.max(0, p.puntiFeritaReali - 1);
    if (p.puntiFeritaReali <= 0) {
        alert(`Condoglianze ${p.nome} è morto in combattimento`);
        party.splice(idx, 1);
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
    }
    renderSpedizioneModal();
    aggiornaInterfaccia();
}

function registraColpo(idx) {
    alert('Registra un colpo: funzione in sviluppo.');
}

function segnaVittoria(idx) {
    const p = party[idx];
    const oldMax = p.puntiFeritaRealiMax;
    p.vittorieCombattimento += 1;
    const newMax = p.puntiFeritaRealiMax;
    if (newMax > oldMax) {
        p.puntiFeritaReali = Math.min(newMax, p.puntiFeritaReali);
    }
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
                </div>
                <div class="combat-buttons" style="display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:8px; margin-bottom:12px;">
                    <button onclick="degradaInCombat(${idx})">Degrada</button>
                    <button onclick="ferisciInCombat(${idx})">Ferisci</button>
                    <button onclick="registraColpo(${idx})">Registra un colpo</button>
                    <button onclick="segnaVittoria(${idx})">Segna vittoria</button>
                </div>
                <details style="background:#111; border:1px solid #333; padding:10px; border-radius:6px;">
                    <summary style="cursor:pointer; font-weight:bold;">Mostra perks di combattimento</summary>
                    <div style="margin-top:8px; color:#eee; font-size:0.9rem;">${perkList}</div>
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

    const mediciTiro = Math.min(20, rollD20() + bonus);
    const ingranaggiTiro = Math.min(20, rollD20() + bonus);
    const alchemiciTiro = Math.min(20, rollD20() + bonus);
    const ciboTiro = Math.min(20, rollD20() + bonus);
    const acquaTiro = Math.min(20, rollD20() + bonus);

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

    alert(`Esplorazione completata da ${p.nome}!\n
Risultati:\n` +
        `• Materiali alchemici: +${alchemici} (d20 ${alchemiciTiro})\n` +
        `• Ingranaggi: +${ingranaggi} (d20 ${ingranaggiTiro})\n` +
        `• Materiali medici: base +${medici.base}, avanzati +${medici.avanzati}, critici +${medici.critici} (d20 ${mediciTiro})\n` +
        `• Cibo: +${cibo} (d20 ${ciboTiro})\n` +
        `• Acqua: +${acqua} (d20 ${acquaTiro})\n` +
        `Bonus esplorazione: ${bonus >= 0 ? '+' : ''}${bonus}`);
    aggiornaInterfaccia();
}

function rollD20() {
    return Math.floor(Math.random() * 20) + 1;
}

function rollDice(count, faces) {
    let total = 0;
    for (let i = 0; i < count; i++) {
        total += Math.floor(Math.random() * faces) + 1;
    }
    return total;
}

function getExplorationBonus(p) {
    let bonus = p.getStatDettagliata('Saggezza').mod;
    if (p.hasCompetenza('Sopravvivenza')) bonus += p.getBonusCompetenza();
    return bonus;
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

    tempP.nome = nome;
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
        if (tempP.puntiCreazione >= perkDati.costo) {
            tempP.perks.push(perkDati);
            tempP.puntiCreazione -= perkDati.costo;
        } else {
            alert("Punti insufficienti!");
            return;
        }
    }

    document.querySelector('#punti-residui b').innerText = tempP.puntiCreazione;
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
                <p>❤️ <b>PF Reali:</b> ${p.puntiFeritaReali} / ${p.puntiFeritaRealiMax} - ${p.woundState}</p>
                ${getBarra(p.puntiFeritaReali, p.puntiFeritaRealiMax, '#c0392b')}
                <p>✨ <b>PF Fortuna:</b> ${p.puntiFortuna} / ${p.puntiFortunaMax}</p>
                ${getBarra(p.puntiFortuna, p.puntiFortunaMax, '#f1c40f')}
                <p style="font-size:0.85em; color:#aaa;">${p.woundEffectText}</p>
                <p>🏅 <b>COMPETENZA:</b> <span style="color:#f1c40f">+${p.getBonusCompetenza()}</span></p>
                <p>⚡ <b>STAMINA:</b> <span style="color:#3498db">${p.staminaAttuale} / ${p.staminaMax}</span></p>
                <p>🏃 <b>FATICA TOTALE:</b> <span style="color:#e74c3c">${p.faticaTotale}</span></p>
                <p style="font-size:0.75em; color:#888;">${p.malusFaticaDettagliati.join(" • ")}</p>
                <hr style="border:0; border-top:1px solid #444; margin:15px 0;">
                <p style="font-size:0.85em; color:#aaa;"><b>COMPETENZE:</b></p>
                <div style="font-size:0.85em; color:#eee; background:#111; padding:8px;">
                    ${p.competenze.length > 0 ? p.competenze.join(' • ') : 'Nessuna'}
                </div>
                <p style="font-size:0.85em; color:#aaa; margin-top:12px;"><b>LIVELLO MEDICINA:</b> ${p.livelloMedicina} • <b>PM MEDICINA:</b> ${p.pmMedicina}</p>
                <p style="font-size:0.85em; color:#aaa; margin-top:12px;"><b>MAESTRIE:</b></p>
                <div style="font-size:0.85em; color:#eee; background:#111; padding:8px; text-align:left;">
                    ${p.competenze.filter(skill => SKILL_SYSTEM.masteryDescriptions[skill])
                        .map(skill => `<strong>${skill}:</strong> ${SKILL_SYSTEM.masteryDescriptions[skill]}`)
                        .join('<br>') || 'Nessuna maestria acquisita.'}
                </div>
            </div>
            ${effettiHtml}
        </div>
        <div class="modal-footer" style="margin-top:20px;">
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