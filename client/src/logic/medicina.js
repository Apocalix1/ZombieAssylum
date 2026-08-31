import { Personaggio } from '../logic/logic.js';
if (typeof window.party === 'undefined') window.party = [];
if (typeof window.magazzino === 'undefined') window.magazzino = { materialiMedici: { base: 0, avanzati: 0, critici: 0 } };
if (typeof window.assistenzaSelezionata === 'undefined') window.assistenzaSelezionata = null;
window.party = party;
window.magazzino = magazzino;
// Variabili locali (non globali) per lo stato interno
let medicoCorrente = -1;

// Funzioni helper (devono essere globali)
function rollDice(n, sides) {
    let total = 0;
    for (let i = 0; i < n; i++) {
        total += Math.floor(Math.random() * sides) + 1;
    }
    return total;
}


// Funzioni principali (esposte globalmente per essere chiamate da HTML)
window.apriMedica = function(idxMedico) {
    medicoCorrente = idxMedico;
    const feriti = window.party.filter(p => p.puntiFeritaReali < p.puntiFeritaRealiMax);
    if (feriti.length === 0) {
        alert('Tutti in perfetta salute per ora');
        return;
    }
    renderMedicaModal();
    const modal = document.getElementById('modal-medica');
    if (modal) modal.style.display = 'block';
};

// ========================= MEDICINA =========================

function renderMedicaModal() {
    const container = document.getElementById('medica-content');
    if (!container) return;
    const medico = window.party[medicoCorrente];
    const feriti = window.party.filter(p => p.puntiFeritaReali < p.puntiFeritaRealiMax);
    const malati = window.party.filter(p => p.isMalato && p.isMalato());

    if (!medico || (feriti.length === 0 && malati.length === 0)) {
        container.innerHTML = `<p>Tutti in perfetta salute per ora.</p>`;
        return;
    }

    let html = `
        <div style="margin-bottom:12px; font-size:0.9rem; color:#ddd;">
            <strong>Medico:</strong> ${medico.nome} (Int +${medico.getStatDettagliata('Intelligenza').mod})<br>
            Risorse mediche: base ${window.magazzino.materialiMedici.base}, avanzati ${window.magazzino.materialiMedici.avanzati}, critici ${window.magazzino.materialiMedici.critici}
        </div>
    `;

    if (feriti.length > 0) {
        html += `<h4 style="color:#e74c3c; margin-top:10px;">🩸 Feriti</h4>`;
        feriti.forEach(p => {
            const targetIdx = window.party.indexOf(p);
            const reqCura = getMedicalData(p.woundState, 'cura', p);
            const reqPronto = getMedicalData(p.woundState, 'pronto_soccorso', p);
            const availableCura = reqCura && hasEnoughMedicalMaterials(reqCura) && medico.livelloMedicina >= reqCura.lvReq;
            const availablePronto = reqPronto && hasEnoughMedicalMaterials(reqPronto) && medico.livelloMedicina >= reqPronto.lvReq;
            const isLieve = p.woundState === 'Ferita lieve';

            html += `
                <div class="stat-row" style="margin-bottom:8px; background:#111;">
                    <div style="flex:1; text-align:left;">
                        <strong>${p.nome}</strong><br>
                        <small>${p.woundState} - PF Reali ${p.puntiFeritaReali}/${p.puntiFeritaRealiMax}</small><br>
                        <small>${reqCura ? `CD: ${reqCura.cd}, PM: ${reqCura.pm}, Mat.: ${reqCura.base} base, ${reqCura.avanzati} avz, ${reqCura.critici} crit` : ''}</small>
                    </div>
                    <div style="display:flex; gap:4px; flex-wrap:wrap;">
                        <button onclick="curaTarget(${targetIdx}, 'cura')" 
                                style="min-width:80px; background:${availableCura ? '#27ae60' : '#555'} !important; color:white !important;"
                                ${availableCura ? '' : 'disabled'}>
                            Cura
                        </button>
                        ${isLieve ? `
                            <button onclick="curaTarget(${targetIdx}, 'pronto_soccorso')" 
                                    style="min-width:80px; background:${availablePronto ? '#2980b9' : '#555'} !important; color:white !important;"
                                    ${availablePronto ? '' : 'disabled'}>
                                Pronto Soccorso
                            </button>
                        ` : ''}
                    </div>
                </div>`;
        });
    }
    if (malati.length > 0) {
        html += `<h4 style="color:#f39c12; margin-top:15px;">🤒 Malati</h4>`;
        malati.forEach(p => {
            const targetIdx = window.party.indexOf(p);
            const grado = p.getGradoMalattia();
            const haDiagnosi = p.malattia.diagnosiCorretta;
            const inCura = p.malattia.inCura;
            const debuff = p.getMalattiaDebuff();

            let stato = `Grado ${grado}`;
            if (haDiagnosi && inCura) {
                const fatte = p.malattia.oreCuraAccumulate;
                const totali = p.malattia.oreCureNecessarie;
                stato += ` (In cura: ${fatte.toFixed(1)}/${totali}h)`;
            } else if (haDiagnosi) {
                stato += ` (Diagnosi corretta, in attesa di cura)`;
            } else if (p.malattia.diagnosiEffettuata) {
                stato += ` (Diagnosi errata!)`;
            } else {
                stato += ` (Da diagnosticare)`;
            }

            html += `
                <div class="stat-row" style="margin-bottom:8px; background:#111;">
                    <div style="flex:1; text-align:left;">
                        <strong>${p.nome}</strong><br>
                        <small>${stato}</small><br>
                        <small style="color:#aaa;">${debuff.desc}</small>
                    </div>
                    <div style="display:flex; gap:4px; flex-wrap:wrap;">
                        <button onclick="window.diagnosticaMalattia(${medicoCorrente}, ${targetIdx})" 
                                style="min-width:80px; background:${haDiagnosi ? '#555' : '#2980b9'} !important; color:white !important;"
                                ${haDiagnosi ? 'disabled' : ''}>
                            ${haDiagnosi ? 'Diagnosticato' : 'Diagnostica'}
                        </button>
                        <button onclick="window.iniziaCuraMalattia(${medicoCorrente}, ${targetIdx})" 
                                style="min-width:80px; background:${(haDiagnosi && !inCura) ? '#27ae60' : '#555'} !important; color:white !important;"
                                ${(haDiagnosi && !inCura) ? '' : 'disabled'}>
                            ${inCura ? 'In cura' : 'Cura'}
                        </button>
                    </div>
                </div>`;
        });
    }

    container.innerHTML = html;
}

function getMedicalData(woundState, tipo = 'cura', personaggio = null) {
    const baseData = {
        'Ferita lieve': { cd: 12, pm: 1, base: 5, avanzati: 0, critici: 0, lvReq: 0 },
        'Ferita profonda': { cd: 16, pm: 3, base: 10, avanzati: 2, critici: 0, lvReq: 2 },
        'Funzionalità a rischio': { cd: 20, pm: 7, base: 15, avanzati: 8, critici: 1, lvReq: 3 },
        'Rischio di morte': { cd: 24, pm: 10, base: 30, avanzati: 16, critici: 5, lvReq: 4 }
    };

    let data;
    if (woundState === 'Ferita lieve' && tipo === 'pronto_soccorso') {
        data = { ...baseData['Ferita lieve'], pm: 2, tipo: 'pronto_soccorso' };
    } else {
        data = baseData[woundState] ? { ...baseData[woundState] } : null;
    }
    if (!data) return null; // FIX: esce subito se woundState non riconosciuto

    if (personaggio && personaggio.hasPerk) {
        if (personaggio.hasPerk('Fragile')) data.cd += 3;
        if (personaggio.hasPerk('Agofobico')) data.cd += 2; // FIX: prima chiamava personaggio.hasPerk senza controllare che personaggio esistesse
    }
    if (window.magazzino && window.magazzino.igienizzazioneMagicaFinoA && (window.oreTotali || 0) < window.magazzino.igienizzazioneMagicaFinoA) {
        // Igienizzatore magico: -4, prevale (non si somma) sul -1 di Ossessione del Pulito
        data.cd = Math.max(1, data.cd - 4);
    } else if (window.magazzino && window.magazzino.baseIgienizzataGiorno === Math.floor((window.oreTotali || 0) / 24)) {
        data.cd = Math.max(1, data.cd - 1);
    }
    return data;
}

export function getRestMultiplier() {
    if (!this.isRestAction()) return 0;
    let multiplier = 1;
    const halfRestActions = ['cucina', 'conserva', 'studio', 'studio-libro', 'alchimia', 'alchimia-assistenza', 'artificeria', 'artificeria-smontaggio', 'artificeria-assistenza'];
    if (this.azioneCorrente && halfRestActions.includes(this.azioneCorrente.tipo)) multiplier *= 0.5;
    if (this.azioneCorrente && this.azioneCorrente.tipo === 'dormi') multiplier *= 1.5;
    if (this.hasPerk && this.hasPerk('Rigenerazione molto veloce')) multiplier += 0.25;
     if (this._bendaAccellerataFinoA && (window.oreTotali || 0) < this._bendaAccellerataFinoA) ore *= 0.85;
    if (this._angeloCasaBonus) {
        multiplier += 0.1;
        this._angeloCasaBonus = false;
    }

    if (this.timers.buffFame > 0) multiplier += 0.2;
    if (this.timers.buffSete > 0) multiplier += 0.2;
    if (this.timers.buffSonno > 0) multiplier += 0.2;
    multiplier -= 0.2 * this.faticaTotale;

    if (this.hasPerk && this.hasPerk('CroceRossina') && this.senseDiColpaStack > 0) {
        multiplier *= (1 - 0.2 * this.senseDiColpaStack);
    }
    return Math.max(0, multiplier);
}

function getOreNecessarieGuarigione() {
    const base = 8;
    const moltiplicatore = {
        'Ferita lieve': 1, 'Ferita profonda': 2,
        'Funzionalità a rischio': 4, 'Rischio di morte': 8
    };
    let ore = base * (moltiplicatore[this.woundState] || 1);
    if (this.hasPerk && this.hasPerk('Guaritore lento')) ore *= 1.25;
    if (this.hasPerk && this.hasPerk('Rigenerazione molto veloce')) ore *= 0.75;
    const presenteUccello = !this.inSpedizione && window.party &&
        window.party.some(m => m !== this && !m.inSpedizione && m.hasPerk && m.hasPerk('Uccello del malaugurio'));
    if (presenteUccello) ore *= 1.1;
    return ore;
}

function checkInfectionRisk() {
    if (this.woundState !== 'Ferita lieve') return true;
    if (this.woundTreated) return true; // medicato → nessun rischio

    const modCon = this.getStatDettagliata('Costituzione').mod || 0;
    const tiro = Math.floor(Math.random() * 20) + 1 + modCon;
    if (tiro >= 14) return true; // supera la CD → nessuna infezione

    // Infezione: la ferita peggiora
    this.puntiFeritaReali = Math.max(0, this.puntiFeritaReali - 1);
    this.resetWoundTimer();
    mostraNotificaInAlto(`${this.nome} ha contratto un'infezione! La ferita è peggiorata.`, 'pericolo');
    return false;
}

function hasEnoughMedicalMaterials(req) {
    return window.magazzino.materialiMedici.base >= req.base &&
        window.magazzino.materialiMedici.avanzati >= req.avanzati &&
        window.magazzino.materialiMedici.critici >= req.critici;
}

function takeMedicalMaterials(req, opts = {}) {
    const { divisorAll = 1, divisorAvanzati = 1, dimezzaBase = false } = opts;
    const baseDivisor = dimezzaBase ? 2 : divisorAll;
    const usedBase = Math.ceil(req.base / baseDivisor);
    const avzDivisor = divisorAll * divisorAvanzati;
    const usedAvanzati = Math.ceil(req.avanzati / avzDivisor);
    window.magazzino.materialiMedici.base = Math.max(0, window.magazzino.materialiMedici.base - usedBase);
    window.magazzino.materialiMedici.avanzati = Math.max(0, window.magazzino.materialiMedici.avanzati - usedAvanzati);
    window.magazzino.materialiMedici.critici = Math.max(0, window.magazzino.materialiMedici.critici - Math.ceil(req.critici / divisorAll));

    window.magazzino.materialiConsumatiLog = window.magazzino.materialiConsumatiLog || [];
    window.magazzino.materialiConsumatiLog.push({ ora: window.oreTotali || 0, base: usedBase, avanzati: usedAvanzati });
    if (window.magazzino.materialiConsumatiLog.length > 200) window.magazzino.materialiConsumatiLog.shift();
}

function getMedicineLevelBonus(level) {
    switch (level) {
        case 2: return 1;
        case 3: return 2;
        case 5: return 3;
        default: return 0;
    }
}

window.gestisciAiutoMedicoConSospensione = function(helper, medicoRichiedente) {
    const idxHelper = party.indexOf(helper);
    if (!helper.azioneCorrente) {
        window.assistenzaSelezionata = { idx: idxHelper, tipo: 'medicina' };
        mostraNotificaInAlto(`${helper.nome} è libero e assiste subito ${medicoRichiedente.nome}.`, 'successo');
        aggiornaInterfaccia();
        return;
    }

    const azioneSospesa = helper.azioneCorrente;
    let modal = document.getElementById('modal-sospendi-azione');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-sospendi-azione';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    const altriCandidati = party.filter(q => q !== helper && q !== medicoRichiedente && q.livelloMedicina >= 1 && !q.inSpedizione);

    modal.innerHTML = `
        <div class="modal-content">
            <h2 style="color:#f1c40f;">⏸️ Azione in corso</h2>
            <p style="color:#ddd;">${helper.nome} sta facendo <strong>${azioneSospesa.tipo.toUpperCase()}</strong> (${azioneSospesa.oreRimanenti}h rimanenti).<br>
            ${medicoRichiedente.nome} chiede aiuto per medicare.</p>
            <div style="display:grid; gap:10px; margin-top:14px;">
                <button class="btn-big" style="background:#2980b9;" onclick="window.aiutoMedico_Aspetta(${idxHelper})">
                    Aspetta (${helper.nome} finisce prima, poi assiste)
                </button>
                <button class="btn-big" style="background:#27ae60;" onclick="window.aiutoMedico_IniziaSenzaAiuto()">
                    Inizia senza aiuti
                </button>
                <button class="btn-big" style="background:#8e44ad;" id="btn-chiedi-altro" ${altriCandidati.length === 0 ? 'disabled style="opacity:0.4;"' : ''} onclick="window.aiutoMedico_ChiediAltro()">
                    Chiedi aiuto a qualcun altro
                </button>
            </div>
        </div>`;
    modal.style.display = 'block';
};

window.aiutoMedico_Aspetta = function(idxHelper) {
    const helper = party[idxHelper];
    helper.codaAzioni.push({
        tipo: 'assistenza-medica',
        oreTotali: 0.5,
        oreRimanenti: 0.5,
        onComplete: () => {
            window.assistenzaSelezionata = { idx: idxHelper, tipo: 'medicina' };
            mostraNotificaInAlto(`${helper.nome} è ora libero per assistere alla medicazione.`, 'successo');
        }
    });
    mostraNotificaInAlto(`${helper.nome} finirà l'azione corrente prima di assistere.`, 'info');
    chiudiModal('modal-sospendi-azione');
    salvaPersonaggio(helper);
    aggiornaInterfaccia();
};

window.aiutoMedico_IniziaSenzaAiuto = function() {
    mostraNotificaInAlto(`Si procede senza assistenza.`, 'info');
    chiudiModal('modal-sospendi-azione');
};

window.aiutoMedico_ChiediAltro = function() {
    chiudiModal('modal-sospendi-azione');
    if (typeof window.apriAiutoModal === 'function') window.apriAiutoModal();
};

window.curaTarget = function(targetIdx, tipo = 'cura') {
    const medico = window.party[medicoCorrente];
    const target = window.party[targetIdx];
    const req = getMedicalData(target.woundState, tipo, target);
    if (!req) return;
    if (medico.livelloMedicina < req.lvReq) {
        alert(`Livello Medicina insufficiente! Richiesto: ${req.lvReq}`);
        return;
    }
    if (!hasEnoughMedicalMaterials(req)) {
        alert('Risorse insufficienti.');
        return;
    }

    let bonusOggettoMagico = 0;
    if (['Funzionalità a rischio', 'Rischio di morte'].includes(target.woundState) && typeof window.chiediUsoOggettoMagico === 'function') {
        const effetto = window.chiediUsoOggettoMagico(medico, 'bonus_medicina', `Curare ${target.nome} (${target.woundState})`);
        if (effetto) bonusOggettoMagico = effetto.bonus || 0;
    }

    // PERFEZIONISTA: tira PRIMA, poi il tempo dipende dal risultato
    let oreAzione = 0.5;
    let rollPrecalcolato = null;
    if (medico.hasPerk && medico.hasPerk('Perfezionista')) {
        const totale = rollDice(1, 20) + medico.getStatDettagliata('Intelligenza').mod + getMedicineLevelBonus(medico.livelloMedicina);
        rollPrecalcolato = totale;
        const modTempo = medico.getPerfezionistaTimeModifier(totale);
        oreAzione = Math.max(0.1, +(oreAzione * modTempo).toFixed(2));
        if (typeof window.mostraNotificaInAlto === 'function') {
            window.mostraNotificaInAlto(
                `${medico.nome} (Perfezionista): tiro anticipato ${totale}, tempo medicazione ${modTempo < 1 ? 'ridotto' : 'aumentato'} a ${oreAzione}h.`,
                modTempo < 1 ? 'successo' : 'avviso'
            );
        }
    }

    const azione = {
        tipo: 'medicina',
        oreTotali: oreAzione,
        oreRimanenti: oreAzione,
        onComplete: () => eseguiCuraTarget(medicoCorrente, targetIdx, tipo, rollPrecalcolato, bonusOggettoMagico)
    };
    if (!medico.azioneCorrente) medico.azioneCorrente = azione;
    else medico.codaAzioni.unshift(azione);

    mostraNotificaInAlto(`${medico.nome} inizia a medicare ${target.nome} (${oreAzione}h).`, 'info');
    renderMedicaModal();
    window.aggiornaInterfaccia();
};
function eseguiCuraTarget(medicoIdx, targetIdx, tipo, rollPrecalcolato = null, bonusOggettoMagico = 0) {
    const medico = window.party[medicoIdx];
    const target = window.party[targetIdx];
    if (!medico || !target) return;
    const req = getMedicalData(target.woundState, tipo, target);
    if (!req || !hasEnoughMedicalMaterials(req)) {
        alert(`${medico?.nome || '??'} non ha più risorse sufficienti.`);
        return;
    }
    const helper = (window.assistenzaSelezionata && window.assistenzaSelezionata.tipo === 'medicina')
        ? window.party[window.assistenzaSelezionata.idx] : null;
    const assistAvailable = helper && helper !== medico && helper.livelloMedicina >= 1;

    const modCost = target.getStatDettagliata('Costituzione').mod;
    let dcFinale = req.cd - modCost;
    let dimezzaBase = false;
    let materialiAssistDimezzati = false;
    if (assistAvailable) {
        dcFinale = Math.max(1, dcFinale - 2);
        if (helper.hasPerk && helper.hasPerk('Comunità medica')) {
            dcFinale = Math.max(1, dcFinale - 2);
            materialiAssistDimezzati = true;
        }
    }
    if (medico.rancoreTargetId === target.id) dcFinale += 2;
    if (medico.hasPerk && medico.hasPerk('Medico sprovveduto') && medico.livelloMedicina >= 2) {
        dcFinale += 2;
        dimezzaBase = true;
    }
     let divisorAllMedico = 1;
    if (medico.hasPerk && medico.hasPerk('Medico')) {
        dcFinale += 2;
        divisorAllMedico = 2;
    }
        if (bonusOggettoMagico > 0) {
        dcFinale = Math.max(1, dcFinale - bonusOggettoMagico);
    }
    if (medico.hasPerk('Nessuno muore sotto le mie mani') && medico.livelloMedicina >= 2 && target.woundState === 'Rischio di morte') {
        const criticiBase = window.magazzino.materialiMedici.critici || 0;
        const criticiInv = medico.inventario?.medCritici || 0;
        if (criticiBase > 0 || criticiInv > 0) {
            let fonte = null;
            if (criticiInv > 0 && criticiBase > 0) fonte = prompt('Usare 1 materiale critico da "base" o "inventario" per +4 al tiro? (vuoto = no)', 'base');
            else if (criticiInv > 0) fonte = confirm('Usare 1 materiale critico dal tuo inventario per +4 al tiro?') ? 'inventario' : null;
            else fonte = confirm('Usare 1 materiale critico dalla base per +4 al tiro?') ? 'base' : null;

            if (fonte === 'base') { window.magazzino.materialiMedici.critici--; dcFinale -= 4; }
            else if (fonte === 'inventario') { medico.inventario.medCritici--; dcFinale -= 4; }
        }
    }

    // PERFEZIONISTA: riusa il tiro fatto all'avvio, altrimenti tira ora come prima
    const totale = rollPrecalcolato !== null
        ? rollPrecalcolato
        : rollDice(1, 20) + medico.getStatDettagliata('Intelligenza').mod + getMedicineLevelBonus(medico.livelloMedicina);

    const cdConBonusMalus = dcFinale + medico.getIrascibileCDBonus() + medico.getPessimistaCDBonus();
    const scarto = cdConBonusMalus - totale;

    if (totale >= cdConBonusMalus) {
        medico.registraIrascibile(true);
        medico.registraPessimista(true);
        takeMedicalMaterials(req, { divisorAvanzati: materialiAssistDimezzati ? 2 : 1, divisorAll: divisorAllMedico });
        target.receiveMedicalTreatment(true);
        if (assistAvailable) { mostraNotificaInAlto(`${helper.nome} assiste ${medico.nome}.`, 'successo'); window.assistenzaSelezionata = null; }
        medico.pmMedicina += req.pm;
        checkMedicineLevelUp(medico);
        if (tipo === 'pronto_soccorso') target.woundTimer = target.woundTimeToWorsen * 2;
        mostraNotificaInAlto(`✅ ${medico.nome} ha curato ${target.nome} (${totale} vs CD ${cdConBonusMalus}).`, 'successo');
        } else {
        medico.registraIrascibile(false, scarto >= 5);
        medico.registraPessimista(false);
        takeMedicalMaterials(req, {
            divisorAvanzati: materialiAssistDimezzati ? 2 : 1,
            divisorAll: divisorAllMedico,
            dimezzaBase: dimezzaBase
        });
        if (assistAvailable) window.assistenzaSelezionata = null;
        mostraNotificaInAlto(`❌ Cura fallita su ${target.nome}. Persi 50% materiali.`, 'pericolo');
        if (scarto >= 5) {
            target.puntiFeritaReali = Math.max(0, target.puntiFeritaReali - 1);
            target.resetWoundTimer();
            mostraNotificaInAlto(`⚠️ Le condizioni di ${target.nome} sono peggiorate!`, 'pericolo');
        }
    }
    renderMedicaModal();
    window.aggiornaInterfaccia();
}
window.eseguiCuraTarget = eseguiCuraTarget;

function infestazioneWound(target) {
    if (!target || target.puntiFeritaReali <= 0) return;
    target.puntiFeritaReali = Math.max(0, target.puntiFeritaReali - 1);
    target.resetWoundTimer();
}

function checkMedicineLevelUp(p) {
    const soglie = { 1: 8, 2: 24, 3: 40, 4: 56, 5: 72 };
    let nuovoLivello = p.livelloMedicina;

    for (let lv = 1; lv <= 5; lv++) {
        if (p.pmMedicina >= soglie[lv]) {
            nuovoLivello = lv;
        }
    }

    if (nuovoLivello > p.livelloMedicina) {
        p.livelloMedicina = nuovoLivello;
        mostraNotificaInAlto(`${p.nome} è ora Livello ${nuovoLivello} in Medicina!`, "successo");
    }
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

window.diagnosticaMalattia = function(medicoIdx, pazienteIdx) {
    const medico = window.party[medicoIdx];
    const paziente = window.party[pazienteIdx];
    if (!medico || !paziente) return alert('Personaggio non trovato.');

    if (!paziente.isMalato()) {
        return alert(`${paziente.nome} non è malato.`);
    }

    // Calcola CD della diagnosi in base al grado
    const grado = paziente.getGradoMalattia();
    if (medico.hasPerk('Nessuno muore sotto le mie mani') && medico.livelloMedicina >= 2 && grado >= 9) {
        const criticiBase = window.magazzino.materialiMedici.critici || 0;
        const criticiInv = medico.inventario?.medCritici || 0;
        if (criticiBase > 0 || criticiInv > 0) {
            let fonte = (criticiInv > 0 && criticiBase > 0)
                ? prompt('Spendere 1 materiale critico per diagnosi CERTA? "base"/"inventario"/vuoto per no', 'base')
                : (criticiInv > 0 ? (confirm('Spendere 1 materiale critico (inventario) per diagnosi certa?') ? 'inventario' : null)
                    : (confirm('Spendere 1 materiale critico (base) per diagnosi certa?') ? 'base' : null));
            if (fonte === 'base' || fonte === 'inventario') {
                if (fonte === 'base') window.magazzino.materialiMedici.critici--;
                else medico.inventario.medCritici--;
                paziente.malattia.diagnosiCorretta = true;
                paziente.malattia.diagnosiEffettuata = true;
                paziente.malattia.oreCureNecessarie = paziente.calcolaOreCuraNecessarie(grado);
                mostraNotificaInAlto(`${medico.nome} ottiene una diagnosi CERTA per ${paziente.nome}.`, 'successo');
                aggiornaInterfaccia();
                return;
            }
        }
    }
};

window.iniziaCuraMalattia = function(medicoIdx, pazienteIdx) {
    const medico = window.party[medicoIdx];
    const paziente = window.party[pazienteIdx];
    if (!medico || !paziente) return alert('Personaggio non trovato.');

    if (!paziente.isMalato()) {
        return alert(`${paziente.nome} non è malato.`);
    }

    // Controlla se il medico ha competenze sufficienti? Per ora no.
    const risultato = paziente.iniziaCuraMalattia(medico, window.magazzino.materialiMedici);
    
    if (risultato.success) {
        mostraNotificaInAlto(`${medico.nome} ha iniziato la cura di ${paziente.nome}. L'esito si saprà al termine del riposo.`, 'successo', paziente.user_id);
    } else {
        alert(risultato.messaggio);
        mostraNotificaInAlto(`Cura fallita: ${risultato.messaggio}`, 'pericolo', medico.user_id);
    }
    aggiornaInterfaccia();
};
window.apriIgienizzaModal = function(idx) {
    const p = window.party[idx];
    if (!p || !p.hasPerk('Igenizzatore')) return;
    const log = (window.magazzino.materialiConsumatiLog || []).filter(e => (window.oreTotali || 0) - e.ora < 24);
    const totBase = log.reduce((s, e) => s + (e.base || 0), 0);
    const totAvanzati = log.reduce((s, e) => s + (e.avanzati || 0), 0);
    if (totBase <= 0 && totAvanzati <= 0) {
        alert('Nessun materiale medico di base o avanzato è stato consumato nelle ultime 24 ore.');
        return;
    }
    const totDisponibili = totBase + totAvanzati;
    const pezziStr = prompt(`Materiali consumati nelle ultime 24h: ${totBase} base, ${totAvanzati} avanzati.\nQuanti pezzi vuoi provare a igienizzare in totale? (max ${totDisponibili})`, `${Math.min(totDisponibili, 6)}`);
    const pezzi = parseInt(pezziStr);
    if (isNaN(pezzi) || pezzi <= 0 || pezzi > totDisponibili) return;

    const costoAlchemici = Math.ceil(pezzi / 3);
    if ((window.magazzino.materialiAlchemici || 0) < costoAlchemici) {
        alert(`Servono ${costoAlchemici} materiali alchemici, ne hai ${window.magazzino.materialiAlchemici || 0}.`);
        return;
    }

    // Ripartizione proporzionale tra base e avanzati in base a quanto consumato
    const propBase = totBase / totDisponibili;
    const pezziBase = Math.min(totBase, Math.round(pezzi * propBase));
    const pezziAvanzati = pezzi - pezziBase;

    window.magazzino.materialiAlchemici -= costoAlchemici;
    if (typeof window.updateMagazzinoFields === 'function') {
        window.updateMagazzinoFields({ materialiAlchemici: window.magazzino.materialiAlchemici });
    }

    const oreAzione = pezzi * (10 / 60);
    const azione = {
        tipo: 'igienizza',
        oreTotali: oreAzione,
        oreRimanenti: oreAzione,
        onComplete: () => completaIgienizza(p, pezziBase, pezziAvanzati)
    };
    if (p.azioneCorrente) {
        if (confirm(`${p.nome} sta già facendo altro. Metterlo in coda?`)) {
            p.codaAzioni.push(azione);
        } else {
            window.magazzino.materialiAlchemici += costoAlchemici;
            if (typeof window.updateMagazzinoFields === 'function') {
                window.updateMagazzinoFields({ materialiAlchemici: window.magazzino.materialiAlchemici });
            }
            return;
        }
    } else {
        p.azioneCorrente = azione;
    }
    salvaPersonaggio(p);
    mostraNotificaInAlto(`${p.nome} inizia a igienizzare ${pezzi} materiali (${oreAzione.toFixed(1)}h).`, 'info');
    aggiornaInterfaccia();
};

function completaIgienizza(p, pezziBase, pezziAvanzati) {
    let recuperatiBase = 0, recuperatiAvanzati = 0;
    for (let i = 0; i < pezziBase; i++) if (Math.random() < 0.40) recuperatiBase++;
    for (let i = 0; i < pezziAvanzati; i++) if (Math.random() < 0.40) recuperatiAvanzati++;

    window.magazzino.materialiMedici.base = (window.magazzino.materialiMedici.base || 0) + recuperatiBase;
    window.magazzino.materialiMedici.avanzati = (window.magazzino.materialiMedici.avanzati || 0) + recuperatiAvanzati;
    if (typeof window.updateMagazzinoFields === 'function') {
        window.updateMagazzinoFields({ materialiMedici: window.magazzino.materialiMedici });
    }
    mostraNotificaInAlto(`${p.nome} ha igienizzato i materiali: recuperati ${recuperatiBase} base e ${recuperatiAvanzati} avanzati.`, 'successo');
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
}

Personaggio.prototype.getOreNecessarieGuarigione = getOreNecessarieGuarigione;
Personaggio.prototype.checkInfectionRisk = checkInfectionRisk;
Personaggio.prototype.getRestMultiplier = getRestMultiplier;
window.lootMedici = lootMedici;
window.infestazioneWound = infestazioneWound;

