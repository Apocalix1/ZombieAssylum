import { aggiornaInterfaccia } from "./ui.js";
import { party } from '../state.js';

function openRisorsaModal(idx, tipo) {
    const p = party[idx];
    if (!p) return;
    const modal = document.getElementById('modal-risorse');
    const title = tipo === 'fame' ? 'NUTRI' : tipo === 'sete' ? 'BEVI' : 'DORMI';
    const content = document.getElementById('risorse-content');
    const labels = {
        fame: { resource: 'Cibo', available: magazzino.cibo, stat: p.fame, max: 14, unit: 'unità' },
        sete: { resource: 'Acqua', available: magazzino.acqua, stat: p.sete, max: 4, unit: 'unità' },
        sonno: { resource: 'Sonno', available: null, stat: p.sonno, max: 8, unit: 'ore' }
    };
    const info = labels[tipo];
    const autoSetting = p.autoRisorse[tipo] ? p.autoRisorse[tipo] : 'Nessuna impostazione';
    const user = getCurrentUser();
    const isMaster = user && user.role === 'master';

    let html = `<div style="margin-bottom:12px; color:#ddd;">
        <p><strong>${p.nome}</strong></p>
        <p>${title} - Stato attuale: ${info.stat.toFixed(1)} / ${info.max}</p>
        <p>Impostazione automatica: <strong>${autoSetting}</strong></p>
    </div>`;

    if (tipo === 'fame') {
        html += `<div style="margin-bottom:12px; color:#ddd;"><p>Piatti deliziosi: <strong>${magazzino.piattiDeliziosi}</strong></p></div>`;
    }

    if (isMaster) {
        html += `<div style="margin-bottom:12px; padding: 10px; border: 1px solid #c0392b; background: rgba(192, 57, 43, 0.1);">
            <p style="color:#e74c3c; font-weight:bold; margin-top:0;">AZIONI MASTER</p>
            <button class="btn-big" style="background:#c0392b; margin-bottom: 5px;" onclick="riduciRisorsaMaster(${idx}, '${tipo}')">Riduci ${tipo} (-1)</button>
        </div>`;
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

export function processAutomaticActions(p) {
      if (!p) return;                              // evita undefined
    if (!p.autoRisorse) p.autoRisorse = {};  
    const inEsplorazione = p.azioneCorrente && p.azioneCorrente.tipo === 'esplora';
    const stats = inEsplorazione ? ['fame', 'sete'] : ['fame', 'sete', 'sonno'];
    stats.sort((a, b) => {
        const sa = p[`stadio${a[0].toUpperCase()+a.slice(1)}`];
        const sb = p[`stadio${b[0].toUpperCase()+b.slice(1)}`];
        return sb - sa;
    });

    for (const tipo of stats) {
        const livello = p.autoRisorse[tipo];
        if (!livello) continue;
        const target = getAutoThreshold(tipo, livello);
        if (!target) continue;
        let current = tipo === 'fame' ? p.fame : tipo === 'sete' ? p.sete : p.sonno;
        if (current >= target) continue;

        // Evita di accodare due volte la stessa azione automatica
        const giaProgrammata = (p.azioneCorrente?.auto === tipo) || (p.codaAzioni || []).some(a => a.auto === tipo);
        if (giaProgrammata) continue;

        if (inEsplorazione) {
            // Fuori base: consuma le scorte personali, non il magazzino condiviso
            p.initInventarioBase();
            if (tipo === 'fame') {
                const disponibile = p.inventario.cibo || 0;
                const needed = Math.min(target - current, disponibile);
                if (needed > 0) {
                    p.inventario.cibo -= needed;
                    const gain = needed * getFoodEfficiency(p);
                    p.fame = Math.min(14, p.fame + gain);
                    if (p.fame > 14) p.timers.buffFame = (p.hasPerk && p.hasPerk('Adattamento alimentare')) ? 8 : 6;
                    if (gain >= 0.25) p.timers.fameSoddisfatta = (p.hasPerk && p.hasPerk('Adattamento alimentare')) ? 5 : 3;
                    mostraNotificaInAlto(`${p.nome} consuma ${needed.toFixed(1)} cibo dalle proprie scorte in esplorazione.`, 'info');
                }
            } else if (tipo === 'sete') {
                const disponibile = p.inventario.acqua || 0;
                const needed = Math.min(target - current, disponibile);
                if (needed > 0) {
                    p.inventario.acqua -= needed;
                    const gain = needed * getWaterEfficiency(p);
                    p.sete = Math.min(10, p.sete + gain);
                    if (p.sete > 4) p.timers.buffSete = 6;
                    if (gain >= 0.25) p.timers.seteSoddisfatta = 2;
                    mostraNotificaInAlto(`${p.nome} consuma ${needed.toFixed(1)} acqua dalle proprie scorte in esplorazione.`, 'info');
                }
            }
            continue;
        }

        if (tipo === 'fame') {
            const needed = Math.min(target - current, magazzino.cibo);
            if (needed > 0) { schedulaAzioneNutrizione(party.indexOf(p), { tipo: 'normale', qty: needed }, true); return; }
        }
        if (tipo === 'sete') {
            const needed = Math.min(target - current, magazzino.acqua);
            if (needed > 0) { bevi(party.indexOf(p), needed); return; }
        }
        if (tipo === 'sonno') {
            const oreNecessarie = Math.ceil(target - current);
            if (oreNecessarie > 0) {
                const nuovaAzione = {
                    tipo: 'dormi',
                    auto: 'sonno',
                    oreTotali: oreNecessarie,
                    oreRimanenti: oreNecessarie,
                    onComplete: () => {
                        if (typeof mostraNotificaInAlto === 'function') {
                            mostraNotificaInAlto(`${p.nome} si è svegliato dopo il riposo automatico.`, 'successo');
                        }
                    }
                };
                inserisciAzioneConPriorita(p, nuovaAzione);
                mostraNotificaInAlto(`${p.nome} si addormenta automaticamente per raggiungere '${livello}'.`, 'info');
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
    if (hasPerk(p, 'Conserva') || hasPerk(p, 'Bimbi')) {
        html += `<div style="display:grid; gap:10px; margin-top:14px;">
            <button class="btn-big" style="background:#8e44ad;" onclick="scheduleConserva(${idx})">Crea conserva 5 ore</button>
            <div style="color:#aaa; font-size:0.9rem;">5 ore, 4 materiali alchemici → 1 conserva</div>
        </div>`;
    }
    if (hasPerk(p, 'Cuoco miserabile')) {
        html += `<div style="display:grid; gap:10px; margin-top:14px;">
        <button class="btn-big" style="background:#795548;" onclick="scheduleCuocoMiserabile(${idx})">Ricicla cibo avariato (2h)</button>
        <div style="color:#aaa; font-size:0.9rem;">2 ore, 15 cibo avariato → 1 cibo sano</div>
    </div>`;
    }
    //test git e odio i re
    if (hasPerk(p, 'Alchimista disperato')) {
        html += `<div style="display:grid; gap:10px; margin-top:14px;">
        <button class="btn-big" style="background:#6a1b9a;" onclick="scheduleAlchimistaDisperato(${idx})">Trasforma in alchemici (3h)</button>
        <div style="color:#aaa; font-size:0.9rem;">3 ore, 10 cibo avariato → 1d4+mod Saggezza alchemici</div>
    </div>`;
    }
    content.innerHTML = html;
    modal.style.display = 'block';
}

function scheduleCuocoMiserabile(idx) {
    const p = party[idx];
    if (!p || !hasPerk(p, 'Cuoco miserabile')) return alert('Non hai il perk Cuoco miserabile.');
    if (magazzino.ciboAvariato < 15) return alert('Servono 15 unità di cibo avariato.');
    magazzino.ciboAvariato -= 15;
    if (typeof window.updateMagazzinoFields === 'function') window.updateMagazzinoFields({ ciboAvariato: magazzino.ciboAvariato });
    const nuovaAzione = {
        tipo: 'cuoco_miserabile',
        oreTotali: 2, oreRimanenti: 2,
        onComplete: () => {
            magazzino.cibo = (magazzino.cibo || 0) + 1;
            if (typeof window.updateMagazzinoFields === 'function') window.updateMagazzinoFields({ cibo: magazzino.cibo });
            mostraNotificaInAlto(`${p.nome} ha riciclato cibo avariato: +1 cibo sano.`, 'successo');
            aggiornaInterfaccia();
        }
    };
    if (p.azioneCorrente) {
        if (confirm(`${p.nome} sta già facendo altro. Metterlo in coda?`)) p.codaAzioni.push(nuovaAzione);
        else { magazzino.ciboAvariato += 15; return; }
    } else p.azioneCorrente = nuovaAzione;
    salvaPersonaggio(p);
    document.getElementById('modal-cucina').style.display = 'none';
    aggiornaInterfaccia();
}
window.scheduleCuocoMiserabile = scheduleCuocoMiserabile;

function scheduleAlchimistaDisperato(idx) {
    const p = party[idx];
    if (!p || !hasPerk(p, 'Alchimista disperato')) return alert('Non hai il perk Alchimista disperato.');
    if (magazzino.ciboAvariato < 10) return alert('Servono 10 unità di cibo avariato.');
    magazzino.ciboAvariato -= 10;
    if (typeof window.updateMagazzinoFields === 'function') window.updateMagazzinoFields({ ciboAvariato: magazzino.ciboAvariato });
    const nuovaAzione = {
        tipo: 'alchimista_disperato',
        oreTotali: 3, oreRimanenti: 3,
        onComplete: () => {
            const modSag = p.getStatDettagliata('Saggezza').mod;
            const guadagno = Math.max(0, rollDice(1, 4) + modSag);
            magazzino.materialiAlchemici = (magazzino.materialiAlchemici || 0) + guadagno;
            if (typeof window.updateMagazzinoFields === 'function') window.updateMagazzinoFields({ materialiAlchemici: magazzino.materialiAlchemici });
            mostraNotificaInAlto(`${p.nome} ha trasformato cibo avariato: +${guadagno} materiali alchemici.`, 'successo');
            aggiornaInterfaccia();
        }
    };
    if (p.azioneCorrente) {
        if (confirm(`${p.nome} sta già facendo altro. Metterlo in coda?`)) p.codaAzioni.push(nuovaAzione);
        else { magazzino.ciboAvariato += 10; return; }
    } else p.azioneCorrente = nuovaAzione;
    salvaPersonaggio(p);
    document.getElementById('modal-cucina').style.display = 'none';
    aggiornaInterfaccia();
}
window.scheduleAlchimistaDisperato = scheduleAlchimistaDisperato;


function scheduleCucina(idx) {
    const p = party[idx];
    if (!p) return;
    if (!p.hasCompetenza || !p.hasCompetenza('Cucina')) {
        alert('Non hai passato abbastanza ore in cucina da giustificare l\'uso delle risorse.');
        return;
    }
    const cucinaCost = hasPerk(p, 'Casalinga esperta') ? { ore: 2, cibo: 4, acqua: 0.5 } : { ore: 3, cibo: 5, acqua: 1 };
    const oreFinali = Math.ceil(cucinaCost.ore * p.getModificatoreTempoAzione('cucina'));
    if (magazzino.cibo < cucinaCost.cibo || magazzino.acqua < cucinaCost.acqua) {
        alert(`Non hai risorse sufficienti per cucinare. Servono ${cucinaCost.cibo} cibo e ${cucinaCost.acqua} acqua.`);
        return;
    }
    magazzino.cibo = Math.max(0, magazzino.cibo - cucinaCost.cibo);
    magazzino.acqua = Math.max(0, magazzino.acqua - cucinaCost.acqua);
    if (typeof window.updateMagazzinoFields === 'function') {
        window.updateMagazzinoFields({ cibo: magazzino.cibo, acqua: magazzino.acqua });
    }
    const nuovaAzione = {
        tipo: 'cucina',
        oreTotali: cucinaCost.ore,
        oreRimanenti: cucinaCost.ore,
        costoCibo: cucinaCost.cibo,
        costoAcqua: cucinaCost.acqua,
        onComplete: () => completeCucina(p)
    };
    if (p.azioneCorrente) {
        if (confirm(`${p.nome} sta già facendo un'altra azione. Vuoi mettere la cucina in coda?`)) {
            p.codaAzioni.push(nuovaAzione);
        }
    } else {
        p.azioneCorrente = nuovaAzione;
    }
    salvaPersonaggio(p);
    document.getElementById('modal-cucina').style.display = 'none';
    aggiornaInterfaccia();
}

function scheduleConserva(idx) {
    const p = party[idx];
    if (!p) return;
    if (!hasPerk(p, 'Conserva') || !p.hasPerk(p,'Bimbi')) {
        alert('Questo personaggio non ha il perk Conserva.');
        return;
    }
    if (magazzino.materialiAlchemici < 4) {
        alert('Non hai abbastanza materiali alchemici per creare una conserva. Servono 4 materiali.');
        return;
    }
    magazzino.materialiAlchemici -= 4;
    if (typeof window.updateMagazzinoFields === 'function') {
        window.updateMagazzinoFields({ materialiAlchemici: magazzino.materialiAlchemici });
    }
    const nuovaAzione = {
        tipo: 'conserva',
        oreTotali: 5,
        oreRimanenti: 5,
        costoMateriali: 4,
        onComplete: () => completeConserva(p)
    };
    if (p.azioneCorrente) {
        if (confirm(`${p.nome} sta già facendo un'altra azione. Vuoi mettere la creazione della conserva in coda?`)) {
            p.codaAzioni.push(nuovaAzione);
        }
    } else {
        p.azioneCorrente = nuovaAzione;
    }
    salvaPersonaggio(p);
    document.getElementById('modal-cucina').style.display = 'none';
    aggiornaInterfaccia();
}

window.consumaConsumabilePersonaggio = function(idx, itemIdx) {
    const p = party[idx];
    if (!p || !p.inventario || !p.inventario.consumabili || !p.inventario.consumabili[itemIdx]) return;
    const item = p.inventario.consumabili[itemIdx];
    p.inventario.consumabili.splice(itemIdx, 1);
    p.registraConsumoConsumabile(item.nome || item);
    mostraNotificaInAlto(`${p.nome} ha consumato: ${item.nome || item}.`, 'info');
    salvaPersonaggioCloud(p);
    aggiornaInterfaccia();
    // riapre la modale se era l'inventario ad essere aperto
    if (document.getElementById('modal-inventario')?.style.display === 'block') window.apriInventario(idx);
};



function completeCucina(p) {
    const piattiFinali = 12;
    const isOttimo = p.hasPerk && p.hasPerk('Ottimo cuoco');
    if (isOttimo) {
        magazzino.piattiDeliziosiPotenziati = (magazzino.piattiDeliziosiPotenziati || 0) + piattiFinali;
        alert(`${p.nome} ha completato la cucina: +${piattiFinali} piatti deliziosi potenziati (+20% nutrimento).`);
        if (typeof window.updateMagazzinoFields === 'function') window.updateMagazzinoFields({ piattiDeliziosiPotenziati: magazzino.piattiDeliziosiPotenziati });
    } else {
        magazzino.piattiDeliziosi += piattiFinali;
        alert(`${p.nome} ha completato la cucina: +${piattiFinali} piatti deliziosi.`);
        if (typeof window.updateMagazzinoFields === 'function') window.updateMagazzinoFields({ piattiDeliziosi: magazzino.piattiDeliziosi });
    }

    // ARTIGIANO ALIMENTARE: buff velocità azioni +20% per 2 ore
    if (p.hasPerk && p.hasPerk('Artigiano Alimentare')) {
        p.timers.buffArtigianoAlimentare = 2;
        mostraNotificaInAlto(`${p.nome} (Artigiano Alimentare): le azioni in corso sono accelerate del 20% per 2 ore.`, 'successo');
    }

    aggiornaInterfaccia();
}

function completeConserva(p) {
    magazzino.conserve = (magazzino.conserve || 0) + 1;
    alert(`${p.nome} ha completato la conserva: +1 conserva disponibile.`);
    if (typeof window.updateMagazzinoFields === 'function') {
        window.updateMagazzinoFields({ conserve: magazzino.conserve });
    }
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
    window.consumiGlobali += qty;
    checkRazionamento();

    // Calcola l'effettivo guadagno con efficienza
    const eff = getWaterEfficiency(p);
    const effectiveGain = qty * eff;
    p.sete += effectiveGain;
    if (p.sete > 4) {
        p.timers.buffSete = 6;
        p.sete = Math.min(10, p.sete);
    }
    if (effectiveGain >= 0.25) {
        p.timers.seteSoddisfatta = 2;
    }

    if (typeof window.updateMagazzinoFields === 'function') {
        window.updateMagazzinoFields({ acqua: magazzino.acqua });
    }
    aggiornaInterfaccia();
}

function prepareNutriData(p, tipo, qty) {
    if (tipo === 'delizioso') {
        if ((magazzino.piattiDeliziosi + (magazzino.piattiDeliziosiPotenziati || 0)) <= 0) { alert('Nessun pasto delizioso disponibile.'); return null; }
        return { tipo: 'delizioso', qty: 1 };
    }
    if (tipo === 'avariato') {
        if (qty === null) {
            qty = parseFloat(prompt(`Quanto cibo AVARIATO dare a ${p.nome}? (Disponibile: ${magazzino.ciboAvariato})`, "1"));
        }
        if (isNaN(qty) || qty <= 0) return null;
        qty = Math.min(qty, magazzino.ciboAvariato);
        return qty > 0 ? { tipo: 'avariato', qty } : null;
    }
    if (qty === null) {
        qty = parseFloat(prompt(`Quanto cibo dare a ${p.nome}? (Normale: ${magazzino.cibo} | Avariato: ${magazzino.ciboAvariato})`, "1"));
    }
    if (isNaN(qty) || qty <= 0) return null;
    qty = Math.min(qty, magazzino.cibo);
    return qty > 0 ? { tipo: 'normale', qty } : null;
}

function nutri(idx, tipo = 'normale', qty = null) {
    const p = party[idx];
    if (!p) return;
    const dati = prepareNutriData(p, tipo, qty);
    if (!dati) return;
    schedulaAzioneNutrizione(idx, dati);
}

function inserisciAzioneConPriorita(p, azione, forzaPrimo = false) {
    if (!p.azioneCorrente) { p.azioneCorrente = azione; return; }
    if (forzaPrimo) p.codaAzioni.unshift(azione);
    else p.codaAzioni.push(azione);
}
window.inserisciAzioneConPriorita = inserisciAzioneConPriorita;

function schedulaAzioneNutrizione(idx, dati, isAuto = false) {
    const p = party[idx];
    if (!p) return;
    if (dati.tipo === 'delizioso') {
        const usaPotenziato = (magazzino.piattiDeliziosiPotenziati || 0) > 0;
        dati.potenziato = usaPotenziato;
        if (usaPotenziato) magazzino.piattiDeliziosiPotenziati -= dati.qty;
        else magazzino.piattiDeliziosi -= dati.qty;
    }
    else if (dati.tipo === 'avariato') {
        magazzino.ciboAvariato -= dati.qty;
        applicaFollia(idx,'cibo_avariato');
    }
    else magazzino.cibo -= dati.qty;

    const nuovaAzione = {
        tipo: 'nutri',
        auto: isAuto ? 'fame' : undefined,
        oreTotali: 0.5,
        oreRimanenti: 0.5,
        onComplete: () => eseguiNutrizione(p, dati)
    };
    // Fame stadio 3+ (tacche <=6): l'azione salta in cima alla coda
    inserisciAzioneConPriorita(p, nuovaAzione, p.stadioFame >= 3);
    if (typeof window.updateMagazzinoFields === 'function') {
        window.updateMagazzinoFields({
            cibo: magazzino.cibo,
            ciboAvariato: magazzino.ciboAvariato,
            piattiDeliziosi: magazzino.piattiDeliziosi
        });
    }
    salvaPersonaggio(p);
    aggiornaInterfaccia();
}

function eseguiNutrizione(p, dati) {
    const durataFameSoddisfatta = p.hasPerk && p.hasPerk('Adattamento alimentare') ? 5 : 3;
    const qty = dati.qty;

    if (dati.tipo === 'delizioso') {
        recordResourceConsumption(p, 1);
        window.consumiGlobali++; checkRazionamento();
        const eff = getFoodEfficiency(p);
        const gain = (dati.potenziato ? 0.36 : 0.3) * eff;
        p.fame = Math.min(14, p.fame + gain);
        const hasAngelo = p.hasPerk && p.hasPerk('Angelo di casa');
        const eraGiaBenNutrito = p.timers.buffFame > 0;
        if (p.fame >= 14 || hasAngelo) {
            p.timers.buffFame = (p.hasPerk && p.hasPerk('Adattamento alimentare')) ? 8 : 6;
            if (p.nutriSpeciale) p.nutriSpeciale('delizioso');
        }
        if (hasAngelo && eraGiaBenNutrito) p._angeloCasaBonus = true;
        if (gain >= 0.25) p.timers.fameSoddisfatta = durataFameSoddisfatta;
        p.follia = Math.max(0, p.follia - 1);
        if (p.masteries && p.masteries.map(m => m.toLowerCase()).includes('cucina')) {
            p.puntiFortuna = Math.min(p.puntiFortunaMax, p.puntiFortuna + 1);
        }
        mostraNotificaInAlto(`${p.nome} ha mangiato un pasto delizioso: fame +${gain.toFixed(2)}.`, 'successo');
    } else if (dati.tipo === 'avariato') {
        recordResourceConsumption(p, qty);
        window.consumiGlobali += qty; checkRazionamento();
        let mult = 1;
        if (p.hasPerk && p.hasPerk('Stomaco di ferro')) mult = 2;
        if (p.hasPerk && p.hasPerk('Stomaco sensibile')) mult = 0.5;
        const gain = qty * 0.15 * getFoodEfficiency(p) * mult;
        p.fame += gain;
        if (p.fame > 14) { p.timers.buffFame = (p.hasPerk && p.hasPerk('Adattamento alimentare')) ? 8 : 6;}
        if (gain >= 0.25) p.timers.fameSoddisfatta = durataFameSoddisfatta;
        const dannoFollia = (p.hasPerk && p.hasPerk('Schizzinoso')) ? 2 : 1;
        p.follia += dannoFollia;
        if (p.nutriSpeciale) p.nutriSpeciale('avariato');
        mostraNotificaInAlto(`${p.nome} ha mangiato cibo avariato. Fame +${gain.toFixed(2)}, follia +${dannoFollia}.`, 'avviso');
        let costMod = p.getStatDettagliata('Costituzione').mod;
        if (p.hasPerk && p.hasPerk('Stomaco di ferro')) costMod += 2;
        if (p.hasPerk && p.hasPerk('Stomaco sensibile')) costMod -= 2;
        if (p.hasPerk && p.hasPerk('Cagionevole')) costMod -= 3;
        if (p.hasPerk && p.hasPerk('Fisico perfetto')) costMod += 3;
        const totaleTS_base = () => rollDice(1, 20) + costMod;
        let totaleTS = totaleTS_base();
        if (p.hasDisadvantageCostituzioneTS && p.hasDisadvantageCostituzioneTS()) {
            totaleTS = Math.min(totaleTS, totaleTS_base());
        }
        if (totaleTS < 14) {
            p.contraiMalattia(1);
            mostraNotificaInAlto(`${p.nome} ha fallito il TS Costituzione (${totaleTS} vs 14) ed è rimasto intossicato.`, 'pericolo');
        }
        if (totaleTS < 14) {
            p.contraiMalattia(1);
            mostraNotificaInAlto(`${p.nome} ha fallito il TS Costituzione (${totaleTS} vs 14) ed è rimasto intossicato.`, 'pericolo');
        }
    } else {
        recordResourceConsumption(p, qty);
        window.consumiGlobali += qty; checkRazionamento();
        const gain = qty * getFoodEfficiency(p);
        p.fame += gain;
        if (p.fame > 14) { p.timers.buffFame = (p.hasPerk && p.hasPerk('Adattamento alimentare')) ? 8 : 6; p.fame = Math.min(20, p.fame); }
        if (gain >= 0.25) p.timers.fameSoddisfatta = durataFameSoddisfatta;
        mostraNotificaInAlto(`${p.nome} ha mangiato: fame +${gain.toFixed(2)}.`, 'successo');
    }
    p.registraPasto && p.registraPasto();
    if (typeof window.updateMagazzinoFields === 'function') {
        window.updateMagazzinoFields({
            cibo: magazzino.cibo,
            acqua: magazzino.acqua,
            ciboAvariato: magazzino.ciboAvariato,
            piattiDeliziosi: magazzino.piattiDeliziosi
        });
    }
    salvaPersonaggio(p);
    aggiornaInterfaccia();
}


function checkRazionamento() {
    if (window.consumiGlobali >= 15) {
        window.consumiGlobali -= 15;
        party.forEach(p => {
            if (p.hasPerk && p.hasPerk('Razionamento')) {
                p.fame = Math.min(14, p.fame + 0.25);
                p.sete = Math.min(4, p.sete + 0.25);
            }
        });
        if (typeof mostraNotificaInAlto === 'function') {
            mostraNotificaInAlto(`📦 Razionamento attivato! I personaggi con il perk hanno recuperato 0.25 di fame e sete.`, "successo");
        }
    }
}

function puoIniziareAzione(p, tipo) {
    if (!p) return false;
    if (p._asmaCrisi) {
        alert(`${p.nome} è in crisi respiratoria (Incapacitato) e non può agire finché non recupera almeno 1 tacca di Stamina.`);
        return false;
    }
    const azioniConsentite = ['dormi', 'nutri', 'disseta'];
    if (p.staminaAttuale <= 0 && !azioniConsentite.includes(tipo)) {
        alert(`${p.nome} è troppo esausto per farlo. Deve riposare, bere o mangiare prima.`);
        return false;
    }
    return true;
}

window.attivaModalitaRiposo = function(idx) {
    const p = party[idx];
    if (!p || !p.isRobot || !hasPerk(p, 'Modalità riposo')) return;
    if (!puoIniziareAzione(p, 'modalita_riposo')) return;
    const oreInput = prompt('Per quante ore vuoi far riposare il robot?', '4');
    const ore = parseFloat(oreInput);
    if (isNaN(ore) || ore <= 0) return;
    p.azioneCorrente = {
        tipo: 'modalita_riposo',
        oreTotali: ore,
        oreRimanenti: ore,
        onComplete: () => {
            mostraNotificaInAlto(`${p.nome} esce dalla Modalità Riposo.`, 'successo');
            salvaPersonaggio(p);
        }
    };
    salvaPersonaggio(p);
    aggiornaInterfaccia();
};

window.consumiGlobali = window.consumiGlobali || 0;
function riduciRisorsaMaster(idx, tipo, quantitaDefault = 1) {
    const p = party[idx];
    if (!p) return;
    const input = prompt(`Quanto vuoi far consumare a ${p.nome} (${tipo})?`, String(quantitaDefault));
    const quantita = parseFloat(input);
    if (isNaN(quantita) || quantita <= 0) return;
    if (tipo === 'fame') p.fame = Math.max(0, p.fame - quantita);
    else if (tipo === 'sete') p.sete = Math.max(0, p.sete - quantita);
    else if (tipo === 'sonno') p.sonno = Math.max(0, p.sonno - quantita);
    if (typeof mostraNotificaInAlto === 'function') {
        mostraNotificaInAlto(`${p.nome}: ${tipo} consumato manualmente di ${quantita} dal Master.`, 'avviso');
    }

    // Aggiorna la modale aperta per riflettere il nuovo stato
    openRisorsaModal(idx, tipo);
}


window.riduciRisorsaMaster = riduciRisorsaMaster;
window.openRisorsaModal = openRisorsaModal;
window.manualRisorsa = manualRisorsa;
window.setAutoRisorsa = setAutoRisorsa;
window.clearAutoRisorsa = clearAutoRisorsa;
window.openCucinaModal = openCucinaModal;
window.nutri = nutri;
window.bevi = bevi;
window.scheduleCucina = scheduleCucina;
window.scheduleConserva = scheduleConserva;
window.processAutomaticActions = processAutomaticActions;
