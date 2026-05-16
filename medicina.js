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
    const data = {
        'Ferita lieve': { cd: 12, pm: 1, base: 5, avanzati: 0, critici: 0, lvReq: 0 },
        'Ferita profonda': { cd: 16, pm: 3, base: 10, avanzati: 2, critici: 0, lvReq: 2 },
        'Funzionalità a rischio': { cd: 20, pm: 7, base: 15, avanzati: 8, critici: 1, lvReq: 3 },
        'Rischio di morte': { cd: 24, pm: 10, base: 30, avanzati: 16, critici: 5, lvReq: 4 }
    };
    return data[woundState] || null;
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
    const req = getMedicalData(target.woundState);

    if (!req) return;
    if (medico.livelloMedicina < req.lvReq) {
        alert(`Livello Medicina insufficiente! Richiesto: ${req.lvReq}`);
        return;
    }
    if (!hasEnoughMedicalMaterials(req)) {
        alert('Risorse insufficienti.');
        return;
    }

    // NUOVO: Calcolo CD influenzato dalla Costituzione del paziente
    // Se mod positivo -> sottrae (es 24 - 3). Se mod negativo -> somma (es 24 + 2)
    const modCostPaziente = target.getStatDettagliata('Costituzione').mod;
    const dcFinale = req.cd - modCostPaziente;

    // NUOVO: Tiro d20 + INT + Bonus Livello
    const bonusLivello = getMedicineLevelBonus(medico.livelloMedicina);
    const modInt = medico.getStatDettagliata('Intelligenza').mod;
    const tiroDado = Math.floor(Math.random() * 20) + 1;
    const totale = tiroDado + modInt + bonusLivello;
    
    const successo = totale >= dcFinale;
    const scarto = dcFinale - totale; // Quanto è mancato per riuscire

    if (successo) {
        takeMedicalMaterials(req, false);
        target.receiveMedicalTreatment(true);
        medico.pmMedicina += req.pm;
        checkMedicineLevelUp(medico); // Controlla se sale di livello
        alert(`SUCCESSO! ${medico.nome} cura ${target.nome}. (Tiro: ${totale} vs CD: ${dcFinale})`);
    } else {
        // FALLIMENTO: perdi 50% materiali
        takeMedicalMaterials(req, true);
        alert(`FALLIMENTO! ${medico.nome} non riesce a curare ${target.nome}. Perso il 50% dei materiali.`);
        
        // NUOVO: Se scarto >= 5, la ferita peggiora
        if (scarto >= 5) {
            target.puntiFeritaReali = Math.max(0, target.puntiFeritaReali - 1);
            target.resetWoundTimer();
            alert(`GRAVE: Le condizioni di ${target.nome} sono peggiorate a causa dell'intervento errato!`);
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