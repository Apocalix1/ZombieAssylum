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

function nutri(idx, tipo = 'normale', qty = null) {
    const p = party[idx];
    if (!p) return;

    // --- OPZIONE 1: PASTO DELIZIOSO ---
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

    // --- OPZIONE 2: CIBO AVARIATO ---
    if (tipo === 'avariato') {
        if (qty === null) {
            qty = prompt(`Quanto cibo AVARIATO dare a ${p.nome}? (Disponibile: ${magazzino.ciboaviarto})`, "1");
            qty = parseFloat(qty);
        }
        if (isNaN(qty) || qty <= 0) return;
        if (qty > magazzino.ciboaviarto) qty = magazzino.ciboaviarto;
        if (qty <= 0) return;

        magazzino.ciboaviarto -= qty;
        recordResourceConsumption(p, qty);
        
        // Ogni unità dà un valore nutrizionale fisso di 0.15 tacche (moltiplicato per l'efficienza del PG)
        const avariatoGain = qty * 0.15 * getFoodEfficiency(p);
        p.fame = Math.min(16, p.fame + avariatoGain);
        p.timers.fameSoddisfatta = 3;
        if (p.fame >= 14) p.timers.buffFame = 6;

        // Mangiare cibo avariato aumenta la follia (1 punto fisso per sessione di pasto avariato)
        p.follia += 1;

        alert(`${p.nome} ha mangiato del cibo avariato. Fame +${avariatoGain.toFixed(2)}, la follia aumenta!`);

        // TIRO SALVEZZA SU COSTITUZIONE (CD 14) per non ammalarsi
        // Usiamo il metodo del personaggio per calcolare i dettagli passandogli 'Costituzione'
        const costMod = p.getStatDettagliata ? p.getStatDettagliata('Costituzione').mod : 0;
        const dado = rollDice(1, 20);
        const totaleTS = dado + costMod;

        alert(`Tiro Salvezza su Costituzione per ${p.nome}: ${dado} + (${costMod}) = ${totaleTS} (CD 14)`);

        if (totaleTS < 14) {
            alert(`Malus! ${p.nome} ha fallito il tiro salvezza ed è rimasto intossicato/ammalato dal cibo marcio.`);
            // Qui puoi inserire il flag della malattia del tuo sistema, ad esempio:
            // p.ammalato = true; o p.aggiungiStato('Ammalato');
        } else {
            alert(`${p.nome} ha uno stomaco d'acciaio! Ha resistito all'infezione.`);
        }

        aggiornaInterfaccia();
        return;
    }

    // --- OPZIONE 3: CIBO NORMALE ---
    if (qty === null) {
        qty = prompt(`Quanto cibo dare a ${p.nome}? (Disponibile Normale: ${magazzino.cibo} | Avariato: ${magazzino.ciboaviarto})`, "1");
        qty = parseFloat(qty);
    }
    if (isNaN(qty) || qty <= 0) return;
    if (qty > magazzino.cibo) qty = magazzino.cibo;
    if (qty <= 0) return;

    magazzino.cibo -= qty;
    recordResourceConsumption(p, qty);
    if (p.fame >= 14) p.timers.buffFame = 6;
    p.fame = Math.min(16, p.fame + qty * getFoodEfficiency(p)); 
    p.timers.fameSoddisfatta = 3;
    aggiornaInterfaccia();
}
