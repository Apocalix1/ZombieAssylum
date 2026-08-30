// spedizione-ui.js
import { party } from '../state.js';
import { magazzino, setMagazzino } from '../state.js'; // oppure importa da dove viene esportato
import { apiUrl, buildAuthHeaders, salvaPersonaggioCloud } from '../logic/logic.js';
import { mostraNotificaInAlto } from '../ui/ui.js';
import{puoIniziareAzione} from "./cibo_e_acqua-ui.js";

function chiudiSpedizione() {
    const panel = document.getElementById('side-spedizione');
    const overlay = document.getElementById('overlay');
    if (panel) panel.classList.remove('open');
    if (overlay) overlay.style.display = 'none';
}

function spedisciPersonaggio(idx) {
    const p = party[idx];
    p.inSpedizione = true;
    applyCucinaMaestriaBuffSeAttivo(p);
    salvaPersonaggioCloud(p);
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
    openSpedizioneModal();
}

window.eseguiScambioDai = function(fromId, toId, itemId) {
    let pgFrom = getCharacter(fromId);
    let pgTo = getCharacter(toId);

    // Entrambi devono esistere e trovarsi nello stesso stato (base o spedizione)
    if (pgFrom && pgTo && pgFrom.stato === pgTo.stato) {
        let itemIndex = pgFrom.inventario.findIndex(i => i.id === itemId);
        if (itemIndex !== -1) {
            let [item] = pgFrom.inventario.splice(itemIndex, 1);
            pgTo.inventario.push(item);
            saveAndRefresh(pgFrom);
            saveAndRefresh(pgTo);
        }
    } else {
        alert("Scambio non valido: i personaggi devono trovarsi entrambi in base o in spedizione.");
    }
};

function applicaDannoRealeConReattivita(p, colpi) {
    for (let i = 0; i < colpi; i++) {
        p.puntiFeritaReali = Math.max(0, p.puntiFeritaReali - 1);
        if (p.hasPerk && p.hasPerk('Reattività')) {
            const modDex = p.getStatDettagliata('Destrezza').mod;
            const temp = Math.max(0, rollDice(1, 6) + modDex);
            p.puntiFortunaTemp = (p.puntiFortunaTemp || 0) + temp;
            mostraNotificaInAlto(`${p.nome} (Reattività): +${temp} PF Fortuna temporanei.`, 'successo');
        }
    }
}

window.lasciaIndietro = function(pgId, itemId) {
    let pg = getCharacter(pgId);
    pg.inventario = pg.inventario.filter(i => i.id !== itemId);
    saveAndRefresh(pg);
};

function mandaTuttiInSpedizione() {
    const user = getCurrentUser();
    if (!user) return;
    party.forEach(p => {
        if (user.role === 'master' || p.user_id === user.id) {
            p.inSpedizione = true;
            applyCucinaMaestriaBuffSeAttivo(p);
        }
    });
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
    openSpedizioneModal();
}

function openSpedizioneModal() {
    renderSpedizioneModal();
    const panel = document.getElementById('side-spedizione');
    const overlay = document.getElementById('overlay');
    if (panel) {
        panel.classList.add('open');
        overlay.style.display = 'block';
    }
}

function ritiraTutti() {
    party.forEach(p => {
        p.inSpedizione = false;
        if (p.finoAllUltimoActive) {
            if (Math.random() < 0.6) {
                if (typeof p.worsenWoundDueToTime === 'function') p.worsenWoundDueToTime();
                if (typeof window.mostraNotificaInAlto === 'function') {
                    window.mostraNotificaInAlto(`${p.nome}: Penalità per Fino all'ultimo, la ferita peggiora.`, 'pericolo');
                }
            }
            p.finoAllUltimoActive = false;
        }
        p.puntiFortuna = p.puntiFortunaMax;
        p.puntiFortunaTemp = 0;
        salvaPersonaggioCloud(p); // Salva sul server
    });
    chiudiSpedizione();
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
}

function ritiraPersonaggio(idx) {
    const p = party[idx];
    p.inSpedizione = false;
    if (p.finoAllUltimoActive) {
        if (Math.random() < 0.4) {
            if (typeof p.worsenWoundDueToTime === 'function') p.worsenWoundDueToTime();
            if (typeof window.mostraNotificaInAlto === 'function') {
                window.mostraNotificaInAlto(`${p.nome}: Penalità per Fino all'ultimo, la ferita peggiora.`, 'pericolo');
            }
        }
        p.finoAllUltimoActive = false;
    }
    p.puntiFortuna = p.puntiFortunaMax;
    p.puntiFortunaTemp = 0;
    salvaPersonaggioCloud(p); // Salva sul server
    renderSpedizioneModal();
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
}

function applyCucinaMaestriaBuffSeAttivo(p) {
    if ((p.buffCucinaMaestriaOreRestanti || 0) > 0) {
        p.puntiFortunaTemp = (p.puntiFortunaTemp || 0) + 4;
        p.buffCucinaMaestriaOreRestanti = 0;
        mostraNotificaInAlto(`${p.nome} entra in spedizione ancora saziato dal piatto speciale: +4 PF Fortuna temporanei.`, 'successo');
    }
}


function useInizioCombattimento(idx) {
    const p = party[idx];
    if (!p) return;
    const modDex = p.getStatDettagliata('Destrezza').mod;
    const dado = p.perkFlags && p.perkFlags.natoPerCombattere ? 6 : 4;
    const roll = Math.floor(Math.random() * dado) + 1 + modDex;
    p.puntiFortuna = Math.min(p.puntiFortunaMax, p.puntiFortuna + roll);
    if (typeof window.mostraNotificaInAlto === 'function') {
        window.mostraNotificaInAlto(`${p.nome} rigenera ${roll} PF fortuna all'inizio del combattimento.`, 'successo');
    }
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
}

function useRigeneraCombattimento(idx) {
    const p = party[idx];
    if (!p) return;
    const modDex = p.getStatDettagliata('Destrezza').mod;
    const roll = Math.max(1, Math.floor(Math.random() * 4) + 1 + modDex);
    p.puntiFortuna = Math.min(p.puntiFortunaMax, p.puntiFortuna + roll);
    if (typeof window.mostraNotificaInAlto === 'function') {
        window.mostraNotificaInAlto(`${p.nome} rigenera ${roll} PF fortuna in combattimento.`, 'successo');
    }
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
}

function useGuerrieroRigenera(idx) {
    const p = party[idx];
    if (!p || !(p.perkFlags && p.perkFlags.guerriero)) return;
    const modCon = p.getStatDettagliata('Costituzione').mod;
    const roll = Math.max(1, Math.floor(Math.random() * 4) + 1 + modCon);
    p.puntiFortuna = Math.min(p.puntiFortunaMax, p.puntiFortuna + roll);
    p.guerrieroUses = (p.guerrieroUses || 0) + 1;
    if (typeof window.mostraNotificaInAlto === 'function') {
        window.mostraNotificaInAlto(`${p.nome} usa Guerriero e rigenera ${roll} PF fortuna.`, 'successo');
    }
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
}

function degradaInCombat(idx) {
    const p = party[idx];
    applicaDannoRealeConReattivita(p, 1);
    if (p.puntiFeritaReali <= 0) {
        alert(`Condoglianze ${p.nome} è morto in combattimento`);
        // Salva come morto sul server
        const giorniSopravvissuto = Math.floor(oreTotali / 24) - (p.giornoInizio || 0);
        p.causaMorte = 'combattimento';
        p.giorniSopravvissuto = giorniSopravvissuto;
        p.giornoMorte = Math.floor(oreTotali / 24);
        fetch(apiUrl(`/api/personaggi/${p.id}`), {
            method: 'PUT',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ data: JSON.stringify(p), status: 'morto' })
        }).catch(err => console.warn('Errore salvataggio morte:', err));
        party.splice(idx, 1);
        if (typeof window.chiudiScheda === 'function') window.chiudiScheda();
        renderSpedizioneModal();
        if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
        return;
    }
    renderSpedizioneModal();
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
}

function ferisciInCombat(idx) {
    const p = party[idx];
    let input = prompt(`Quanti danni vuoi infliggere a ${p.nome}?`, '1');
    let danno = parseInt(input);
    if (isNaN(danno) || danno <= 0) return;

    let residuo = danno;
    const assorbitoTemp = Math.min(p.puntiFortunaTemp || 0, residuo);
    p.puntiFortunaTemp = (p.puntiFortunaTemp || 0) - assorbitoTemp;
    residuo -= assorbitoTemp;

    const assorbito = Math.min(p.puntiFortuna, residuo);
    p.puntiFortuna -= assorbito;
    residuo -= assorbito;

    if (residuo > 0) {
        const colpiReali = Math.ceil(residuo / 5);
        applicaDannoRealeConReattivita(p, colpiReali);
    }
    if (p.puntiFeritaReali <= 0) {
        // Morte
        alert(`Condoglianze ${p.nome} è morto in combattimento`);
        const giorniSopravvissuto = Math.floor(oreTotali / 24) - (p.giornoInizio || 0);
        p.causaMorte = 'combattimento';
        p.giorniSopravvissuto = giorniSopravvissuto;
        p.giornoMorte = Math.floor(oreTotali / 24);
        fetch(apiUrl(`/api/personaggi/${p.id}`), {
            method: 'PUT',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ data: JSON.stringify(p), status: 'morto' })
        }).catch(err => console.warn('Errore salvataggio morte:', err));
        party.splice(idx, 1);
        if (typeof window.chiudiScheda === 'function') window.chiudiScheda();
        renderSpedizioneModal();
        aggiornaInterfaccia();
        return;
    }
    renderSpedizioneModal();
    aggiornaInterfaccia();
}

window.attivaOverclock = function(idx) {
    const p = party[idx];
    if (!p || !hasPerk(p, 'Protocollo Overclock')) return;
    if ((p.batteryHours || 0) < 5) return alert('Batteria Arcana insufficiente (servono 5h).');
    p.consumeBattery(5);
    mostraNotificaInAlto(`${p.nome} attiva il Protocollo Overclock: agisce di nuovo, poi entra in Paralisi per 1 turno.`, 'avviso');
    salvaPersonaggioCloud(p);
    aggiornaInterfaccia();
};
window.attivaScudoEnergetico = function(idx) {
    const p = party[idx];
    if (!p || !hasPerk(p, 'Scudo Energetico')) return;
    if ((p.batteryHours || 0) < 5) return alert('Batteria Arcana insufficiente (servono 5h).');
    p.consumeBattery(5);
    mostraNotificaInAlto(`${p.nome} attiva lo Scudo Energetico: -2d8 danno al prossimo colpo subito.`, 'successo');
    salvaPersonaggioCloud(p);
    aggiornaInterfaccia();
};

function useStressFisico(idx) {
    const p = party[idx];
    if (!p || !(window.hasPerk && window.hasPerk(p, 'Stress fisico'))) return;
    if (p.woundState === 'Funzionalità a rischio') {
        alert(`${p.nome} è a rischio funzionalità: non può usare Stress Fisico.`);
        return;
    }
    if (p.puntiFeritaReali <= 1) {
        alert(`${p.nome} non ha abbastanza PF reali per rischiare Stress Fisico.`);
        return;
    }
    if (p.faticaBase <= 0) {
        alert(`${p.nome} non ha fatica da ridurre.`);
        return;
    }
    p.puntiFeritaReali = Math.max(0, p.puntiFeritaReali - 1);
    p.faticaBase = Math.max(0, p.faticaBase - 2);
    p.resetWoundTimer();
    mostraNotificaInAlto(`${p.nome} usa Stress Fisico: -1 PF Reale, -2 Fatica.`, 'successo');
    salvaPersonaggioCloud(p);
    renderSpedizioneModal();
    aggiornaInterfaccia();
}
window.useStressFisico = useStressFisico;

function segnaVittoria(idx) {
    const p = party[idx];
    p.registraVittoriaCombattimento();
    renderSpedizioneModal();
    aggiornaInterfaccia();
}

function lootIngranaggi(tiro) {
    if (tiro <= 1) return 0;
    if (tiro <= 7) return rollDice(1, 4) + 1;
    if (tiro <= 13) return rollDice(1, 6) + 2;
    if (tiro <= 17) return rollDice(2, 6) + 4;
    if (tiro <= 19) return rollDice(2, 8) + 8;
    return rollDice(2, 12) + 16;
}
window.lootIngranaggi = lootIngranaggi;

// client/src/ui/spedizione-ui.js – renderSpedizioneModal (estratto modificato)

function getPerkCategory(nomePerk) {
    if (!window.DATABASE_PERK) return null;
    for (let [cat, perks] of Object.entries(window.DATABASE_PERK)) {
        if (perks.some(p => p.nome === nomePerk)) return cat;
    }
    return null;
}

window.toggleCombattimento = function() {
    window.combattimentoAttivo = !window.combattimentoAttivo;
    mostraNotificaInAlto(window.combattimentoAttivo ? '⚔️ Combattimento iniziato!' : '🏳️ Combattimento terminato.', window.combattimentoAttivo ? 'pericolo' : 'info');
    renderSpedizioneModal();
};

const EXTRA_PERK_COMBATTIMENTO = ['Stress fisico', "Fino all'ultimo", 'Guerriero', 'Nato per combattere','Flusso magico','Incantesimo preferito','Trasmettitore magico','Voce calma','Vendicativo', 'Mente ferrea', 'Vicinanza', 'Carapace/Esoscheletro duro', 'Sensibilità alle temperature', 'Guida', 'Lingua prensile', 'Produrre veleni', 'Termoregolazione', 'Scivolata(Pinguinosa)', 'Volo', 'Uniti siamo più forti', 'Protocollo Overclock', 'Scudo Energetico'];

async function renderSpedizioneModal() {
    const container = document.getElementById('spedizione-content');
    if (!container) return;

    const personaggiInSpedizione = party.filter(p => p.inSpedizione === true);
    const user = getCurrentUser();
    const isMaster = user && user.role === 'master';

    if (personaggiInSpedizione.length === 0) {
        container.innerHTML = `<p style="color:#aaa; text-align:center;">Nessun personaggio in spedizione.</p>`;
        return;
    }

    let toggleHtml = '';
    if (isMaster) {
        toggleHtml = `<div style="margin-bottom:12px; text-align:center;">
            <button class="btn-big" style="background:${window.combattimentoAttivo ? '#c0392b' : '#27ae60'};" onclick="toggleCombattimento()">
                ${window.combattimentoAttivo ? '🏳️ TERMINA COMBATTIMENTO' : '⚔️ INIZIA COMBATTIMENTO'}
            </button>
        </div>`;
    }

    const cardsHtml = personaggiInSpedizione.map(p => {
        const idx = party.indexOf(p);
        if (isMaster && window.combattimentoAttivo) return renderSchedaCombattimentoMaster(p, idx);
        return renderSchedaSpedizioneRidotta(p, idx);
    }).join('');

    container.innerHTML = toggleHtml + cardsHtml;
}

function renderSchedaCombattimentoMaster(p, idx) {
    const perkList = (p.perks || [])
        .filter(perk => {
            const nome = typeof perk === 'string' ? perk : perk.nome;
            const cat = getPerkCategory(nome);
            return cat === 'combattimento' || EXTRA_PERK_COMBATTIMENTO.includes(nome);
        })
        .map(perk => typeof perk === 'string' ? perk : perk.nome)
        .join(' • ') || 'Nessuno';

    if (p.isRobot) {
        const corazzatoCount = getPerkCount(p, 'Corazzato');
        const nuovoMax = 40 + (corazzatoCount * 5);
        if (p.robotPFMax !== nuovoMax) {
            const diff = nuovoMax - p.robotPFMax;
            p.robotPFMax = nuovoMax;
            if (diff > 0) p.robotPF = Math.min(p.robotPFMax, p.robotPF + diff);
            else p.robotPF = Math.min(p.robotPF, p.robotPFMax);
        }
    }

    return `
        <div class="combat-card">
            <div class="combat-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <strong>${p.nome}</strong>
                <button class="combat-retreat" onclick="ritiraPersonaggio(${idx})">RITIRA</button>
            </div>
            <div style="margin:10px 0; font-size:0.9rem;">
                ${p.isRobot ? `
                    <div>🤖 PF Robotici: ${p.robotPF} / ${p.robotPFMax}</div>
                    ${typeof getBarra === 'function' ? getBarra(p.robotPF, p.robotPFMax, '#c0392b') : ''}
                ` : `
                    <div>❤️ PF Reali: ${p.puntiFeritaReali} / ${p.puntiFeritaRealiMax}</div>
                    ${typeof getBarra === 'function' ? getBarra(p.puntiFeritaReali, p.puntiFeritaRealiMax, '#c0392b') : ''}
                    <div>✨ PF Fortuna: ${p.puntiFortuna} / ${p.puntiFortunaMax} ${p.puntiFortunaTemp > 0 ? `<span style="color:#3498db;">(+${p.puntiFortunaTemp} temp.)</span>` : ''}</div>
                    ${typeof getBarra === 'function' ? getBarra(p.puntiFortuna, p.puntiFortunaMax, '#f1c40f') : ''}
                `}
                <div style="margin-top:8px; font-size:0.85rem; color:#aaa;">Vittorie comb.: ${p.vittorieCombattimento || 0}</div>
            </div>
            <div class="combat-buttons" style="display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:8px; margin-bottom:12px;">
                <button onclick="degradaInCombat(${idx})">Degrada</button>
                <button onclick="ferisciInCombat(${idx})">Ferisci</button>
                <button onclick="registraAttaccoModal(${idx})">📈 Reg. Attacco</button>
                <button onclick="useRigeneraCombattimento(${idx})">Rigenera</button>
                <button onclick="segnaVittoria(${idx})">Segna vittoria</button>
                <button onclick="masterAggiungiOggetto(${idx})" style="background:#8e44ad;">🎁 Dai loot</button>
                ${(p.livelloMagia > 0 && Object.values(p.spellsKnown || {}).some(v => v > 0)) ? `<button onclick="apriConsumaIncantesimi(${idx})">🪄 Magia</button>` : ''}
                ${(p.inventario && p.inventario.composti && p.inventario.composti.length > 0) ? `<button onclick="apriConsumaComposti(${idx})">🧪 Composti</button>` : ''}
                ${(() => {
                    let extras = '';
                    if (p.hasPerk && p.hasPerk('Stress fisico') && p.faticaTotale > 0) extras += `<button style="background:#8e44ad;" onclick="useStressFisico(${idx})">⚡ Stress Fisico</button>`;
                    if (typeof hasPerk === 'function' && hasPerk(p, 'Nato per combattere')) extras += `<button onclick="useInizioCombattimento(${idx})">Rigenera inizio</button>`;
                    if (typeof hasPerk === 'function' && hasPerk(p, 'Guerriero')) extras += `<button onclick="useGuerrieroRigenera(${idx})">Rigenera Guerriero</button>`;
                    if (p.perks && p.perks.some(pp => (pp.nome||pp) === "Fino all'ultimo")) extras += `<button onclick="toggleFinoAllUltimo(${idx})">${p.finoAllUltimoActive ? 'Disattiva FinoAll' : "Usa Fino all'ultimo"}</button>`;
                    if (p.isRobot && hasPerk(p, 'Protocollo Overclock')) extras += `<button onclick="attivaOverclock(${idx})">⚡ Overclock (-5h batt.)</button>`;
                    if (p.isRobot && hasPerk(p, 'Scudo Energetico')) extras += `<button onclick="attivaScudoEnergetico(${idx})">🛡️ Scudo Energetico (-5h batt.)</button>`;
                    if (p.inventario?.armi?.includes('Taser')) {
                        extras += p.taserCaricato ? `<button onclick="useTaser(${idx})">⚡ Usa Taser</button>` : `<button onclick="ricaricaTaser(${idx})" ${((p.inventario?.batterie||0) > 0) ? '' : 'disabled'}>🔋 Ricarica Taser</button>`;
                    }
                    if (p.inventario?.proiettiliFrammentazione > 0) extras += `<button onclick="consumaProiettileFrammentazione(${idx})">💥 Proiettile Framment. (${p.inventario.proiettiliFrammentazione})</button>`;
                    if (p.inventario?.armi?.includes('Stivali a Molla') && p.stivaliCariche > 0) extras += `<button onclick="useStivaliMolla(${idx})">🦵 Usa Stivali (${p.stivaliCariche}/3)</button>`;
                    else if (p.inventario?.armi?.includes('Stivali a Molla')) extras += `<button onclick="ricaricaStivali(${idx})" ${((p.inventario?.batterie||0) > 0) ? '' : 'disabled'}>🔋 Ricarica Stivali</button>`;
                    return extras;
                })()}
            </div>
            <details style="background:#111; border:1px solid #333; padding:10px; border-radius:6px;">
                <summary style="cursor:pointer; font-weight:bold;">Mostra perks di combattimento</summary>
                <div style="margin-top:8px; color:#eee; font-size:0.9rem;">${perkList}</div>
            </details>
        </div>`;
}

function renderSchedaSpedizioneRidotta(p, idx) {
    const statiPerTS = ["Forza", "Destrezza", "Costituzione", "Intelligenza", "Saggezza", "Carisma"];
    const statsHtml = statiPerTS.map(s => {
        const mod = p.getStatDettagliata(s).mod;
        return `<span style="display:inline-block; min-width:60px; color:${mod>=0?'#2ecc71':'#e74c3c'};">${s.slice(0,3).toUpperCase()} ${mod>=0?'+':''}${mod}</span>`;
    }).join(' ');

    const perkConDesc = (p.perks || [])
        .filter(perk => {
            const nome = typeof perk === 'string' ? perk : perk.nome;
            const cat = getPerkCategory(nome);
            return cat === 'combattimento' || EXTRA_PERK_COMBATTIMENTO.includes(nome);
        })
        .map(perk => {
            const nome = typeof perk === 'string' ? perk : perk.nome;
            const dati = typeof window.findPerkData === 'function' ? window.findPerkData(nome) : null;
            return `<div style="margin-bottom:6px; padding-bottom:6px; border-bottom:1px solid #222;">
                <strong style="color:#e74c3c;">${nome}</strong><br>
                <span style="color:#aaa; font-size:0.82rem;">${dati?.desc || 'Nessuna descrizione.'}</span>
            </div>`;
        }).join('') || '<div style="color:#888;">Nessuno.</div>';

    return `
        <div class="combat-card">
            <div class="combat-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <strong>${p.nome}</strong>
                <button class="combat-retreat" onclick="ritiraPersonaggio(${idx})">RITIRA</button>
            </div>
            <div style="margin:10px 0; font-size:0.85rem; color:#ddd;">
                <div>🏃 Velocità: ${p.velocitaAttuale}m</div>
                ${p.isRobot ? `<div>🤖 PF: ${p.robotPF}/${p.robotPFMax}</div>` : `
                    <div>❤️ PF Reali: ${p.puntiFeritaReali}/${p.puntiFeritaRealiMax}</div>
                    <div>✨ PF Fortuna: ${p.puntiFortuna}/${p.puntiFortunaMax}${p.puntiFortunaTemp > 0 ? ` <span style="color:#3498db;">(+${p.puntiFortunaTemp} temp.)</span>` : ''}</div>
                `}
                <div style="margin-top:6px;">${statsHtml}</div>
            </div>
            <div style="display:flex; gap:6px; margin-bottom:10px;">
                <button class="btn-big" style="flex:1;" onclick="apriScheda(${idx})">📋 Scheda</button>
                <button class="btn-big" style="flex:1; background:#16a085;" onclick="apriInventario(${idx})">🎒 Inventario</button>
            </div>
            <details style="background:#111; border:1px solid #333; padding:10px; border-radius:6px;">
                <summary style="cursor:pointer; font-weight:bold;">Perk di combattimento</summary>
                <div style="margin-top:8px;">${perkConDesc}</div>
            </details>
        </div>`;
}

// AGGIUNGI dopo window.consumaIncantesimo
window.apriConsumaComposti = function(idx) {
    const p = party[idx];
    if (!p) return;
    let modal = document.getElementById('modal-consuma-composti');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-consuma-composti';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <h2 style="color:#9b59b6;">🧪 Consuma Composto</h2>
                <div id="consuma-composti-content"></div>
                <div class="modal-footer">
                    <button class="btn-big btn-cancel" onclick="chiudiModal('modal-consuma-composti')">CHIUDI</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }
    window.renderConsumaCompostiModal(idx);
    modal.style.display = 'block';
};

window.renderConsumaCompostiModal = function(idx) {
    const p = party[idx];
    const container = document.getElementById('consuma-composti-content');
    if (!container || !p) return;
    p.initInventarioBase();
    const composti = p.inventario.composti || [];

    if (composti.length === 0) {
        container.innerHTML = `<p style="color:#aaa;">Non hai composti alchemici con te.</p>`;
        return;
    }

    let html = `<div style="display:grid; gap:8px;">`;
    composti.forEach((c, ci) => {
        const colore = c.qualita === 'tossico' ? '#e74c3c' : c.qualita === 'instabile' ? '#f39c12' : '#2ecc71';
        html += `
            <div style="background:#111; padding:10px; border:1px solid #333; border-radius:4px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${c.nome}</strong>
                    <span style="color:${colore}; font-size:0.8rem;"> (${c.qualita})</span>
                </div>
                <button onclick="window.consumaCompostoDaSpedizione(${idx}, ${ci})" class="btn-hero" style="padding:6px 12px;">Consuma</button>
            </div>`;
    });
    html += `</div>`;
    container.innerHTML = html;
};

window.consumaCompostoDaSpedizione = function(idx, itemIdx) {
    window.consumaCompostoPersonaggio(idx, itemIdx);
    window.renderConsumaCompostiModal(idx);
    if (typeof renderSpedizioneModal === 'function') renderSpedizioneModal();
};


function rollArmiTrovate(diffLevel = 0) {
    const armi = [];
    const bonus = diffLevel * 5; // Bonus lineare alle probabilità base

    const check = (baseProb) => (Math.floor(Math.random() * 100) + 1) <= (baseProb + bonus);
    const d4 = () => Math.floor(Math.random() * 4) + 1;

    if (check(1))  armi.push({ nome: 'Pistola', qta: 1, tipo: 'arma' });
    if (check(4))  armi.push({ nome: 'Proiettili', qta: d4(), tipo: 'munizioni' });
    if (check(10)) armi.push({ nome: 'Arma con Asta', qta: 1, tipo: 'arma' });
    if (check(8))  armi.push({ nome: 'Lama leggera', qta: 1, tipo: 'arma' });
    if (check(6))  armi.push({ nome: 'Balestra', qta: 1, tipo: 'arma' });
    if (check(9))  armi.push({ nome: 'Quadrelli', qta: d4(), tipo: 'munizioni' });
    if (check(6))  armi.push({ nome: 'Arco', qta: 1, tipo: 'arma' });
    if (check(10)) armi.push({ nome: 'Frecce', qta: d4(), tipo: 'munizioni' });
    if (check(10)) armi.push({ nome: 'Mazza', qta: 1, tipo: 'arma' });

    return armi;
}

window.apriConsumaIncantesimi = function(idx) {
    const p = party[idx];
    if (!p) return;
    const modal = document.getElementById('modal-consuma-incantesimi');
    if (!modal) {
        const el = document.createElement('div');
        el.id = 'modal-consuma-incantesimi';
        el.className = 'modal';
        el.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <h2 style="color:#9b59b6;">🧙 Consuma Incantesimo</h2>
                <div id="consuma-incantesimi-content"></div>
                <div class="modal-footer">
                    <button class="btn-big btn-cancel" onclick="chiudiModal('modal-consuma-incantesimi')">CHIUDI</button>
                </div>
            </div>`;
        document.body.appendChild(el);
    }
    window.renderConsumaIncantesimiModal(idx);
    modal.style.display = 'block';
};

window.renderConsumaIncantesimiModal = function(idx) {
    const p = party[idx];
    const container = document.getElementById('consuma-incantesimi-content');
    if (!container || !p) return;

    // Elenco incantesimi conosciuti per livello
    const spellLevels = Object.keys(p.spellsKnown || {}).filter(lv => p.spellsKnown[lv] > 0);
    if (spellLevels.length === 0) {
        container.innerHTML = `<p style="color:#aaa;">Non conosci alcun incantesimo.</p>`;
        return;
    }

    let html = `
        <div style="margin-bottom:12px; color:#ddd;">
            <strong>${p.nome}</strong> - Mana: ${p.manaAttuale}/${p.manaMax} 
            ${p.manaAttuale < 0 ? `<span style="color:#e74c3c;">(Sovraccarico: ${Math.abs(p.manaAttuale)})</span>` : ''}
            ${p._arcaneFatigueApplied ? '<span style="color:#e74c3c;">⚠️ Affaticato arcano</span>' : ''}
            ${p._magicExhausted ? '<span style="color:#e74c3c;">⛔ Esaurito magicamente</span>' : ''}
        </div>
        <div style="display:grid; gap:8px;">`;

    spellLevels.forEach(lv => {
        const levelNum = parseInt(lv);
        const cost = p.getSpellCost(levelNum);
        const canCast = p.canCastSpell(levelNum);
        const disabled = !canCast.allowed ? 'disabled' : '';
        const reason = !canCast.allowed ? `title="${canCast.reason}"` : '';
        html += `
            <div style="background:#111; padding:10px; border:1px solid #333; border-radius:4px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>Livello ${lv}</strong> 
                    <span style="color:#aaa;">(${p.spellsKnown[lv]} incantesimi conosciuti)</span>
                    <span style="color:#888;">Costo: ${cost} mana</span>
                </div>
                <button onclick="window.consumaIncantesimo(${idx}, ${lv})" ${disabled} ${reason} class="btn-hero" style="padding:6px 12px;">
                    Lancia
                </button>
            </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
};

window.consumaIncantesimo = function(idx, level) {
    const p = party[idx];
    if (!p) return;
    const result = p.castSpell(level);
    alert(result.message);
    if (result.success) {
        window.renderConsumaIncantesimiModal(idx);
        if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
    } else {
        window.renderConsumaIncantesimiModal(idx);
    }
};


function rollZainoTrovato(diffLevel = 0) {
    const baseChance = 15;
    const finalChance = baseChance + (diffLevel * 5); // +0%, +5%, +10%, +15%

    if ((Math.floor(Math.random() * 100) + 1) > finalChance) return null;

    const roll = Math.floor(Math.random() * 100) + 1;
    if (roll <= 30) return { nome: 'Borsetta', bonus: 1, pesoUnEquipped: 0.1, grado: 1 };
    if (roll <= 56) return { nome: 'Tracolla', bonus: 2, pesoUnEquipped: 0.2, grado: 2 };
    if (roll <= 76) return { nome: 'Zaino Piccolo', bonus: 4, pesoUnEquipped: 0.3, grado: 3 };
    if (roll <= 90) return { nome: 'Zaino da Studente', bonus: 6, pesoUnEquipped: 0.4, grado: 4 };
    if (roll <= 98) return { nome: 'Zaino Capiente', bonus: 9, pesoUnEquipped: 0.5, grado: 5 };
    return { nome: 'Zaino da Esploratore', bonus: 12, pesoUnEquipped: 0.6, grado: 6 };
}


function lootOggettiMagici(diffLevel = 0) {
    const trovati = { comuni: 0, nonComuni: 0, rari: 0, superRari: 0 };
    const roll = () => Math.random() * 100;

    // Il livello di difficoltà fornisce un bonus base del 5% per livello.
    // Il bonus viene scalato per non rendere troppo facili i drop Super Rari.
    const bonusBase = diffLevel * 5;

    // Esempio a Difficoltà 3 (BonusBase = 15):
    // Comuni: 32 + 15 = 47%
    // Non Comuni: 16 + 7.5 = 23.5%
    // Rari: 8 + 3.75 = 11.75%
    // Super Rari: 2.5 + 1.5 = 4.0%

    if (roll() <= (32 + bonusBase))               trovati.comuni = 1;
    if (roll() <= (16 + (bonusBase * 0.5)))       trovati.nonComuni = 1;
    if (roll() <= (8  + (bonusBase * 0.25)))      trovati.rari = 1;
    if (roll() <= (2.5 + (bonusBase * 0.1)))      trovati.superRari = 1;

    return trovati;
}

function esplora(idx) {
    const leader = window.party[idx];
    if (!leader) return;
    if (leader.inSpedizione) {
        alert(`${leader.nome} è già segnato "in spedizione" (pannello combattimento). Ritiralo da lì prima di farlo esplorare.`);
        return;
    }
    if (leader.azioneCorrente) {
        alert(`${leader.nome} sta già facendo qualcos'altro (${leader.azioneCorrente.tipo}${leader.azioneCorrente.oreRimanenti !== undefined ? `, ${leader.azioneCorrente.oreRimanenti}h rimanenti` : ''}). Attendi che finisca prima di farlo esplorare di nuovo.`);
        return;
    }
    if (typeof window.puoIniziareAzione === 'function' && !window.puoIniziareAzione(leader, 'esplora')) return;
    if (typeof leader.initInventarioBase === 'function') leader.initInventarioBase();

    if (leader.pesoAttuale > leader.capacitaMax) {
        if (!confirm(`⚠️ Attenzione! ${leader.nome} ha lo zaino già pieno. Non potrà riportare alcun oggetto. Partire lo stesso?`)) return;
    }

    const livelliPericolo = [
        { nome: 'Sicura', bonus: 0, oreBase: 3, mult: 1 },
        { nome: 'Impegnativa', bonus: 1, oreBase: 5, mult: 2 },
        { nome: 'Pericolosa', bonus: 2, oreBase: 7, mult: 3 },
        { nome: 'Estremamente Rischiosa', bonus: 3, oreBase: 9, mult: 4 }
    ];
    let sceltaPericoloStr = prompt(`Scegli il livello di pericolosità:\n0: Sicura (3H, +0% Drop)\n1: Impegnativa (5H, +5% Drop)\n2: Pericolosa (7H, +10% Drop)\n3: Estremamente Rischiosa (9H, +15% Drop)`, "0");
    let pericoloIdx = parseInt(sceltaPericoloStr);
    if (isNaN(pericoloIdx) || pericoloIdx < 0 || pericoloIdx > 3) pericoloIdx = 0;
    const pericolo = livelliPericolo[pericoloIdx];

    const modRisposta = prompt(`Vuoi che ${leader.nome} esplori da solo o insieme ad altri?\nScrivi "SOLO" o "INSIEME"`, "SOLO");

    if (modRisposta && modRisposta.toUpperCase() === "INSIEME") {
        const disponibili = window.party.filter(p => p !== leader && p.id && !p.inSpedizione && !p.azioneCorrente);
        if (disponibili.length === 0) {
            alert("Non ci sono altri personaggi disponibili in questo momento. Parte da solo.");
            avviaEsplorazioneGruppo(leader, [], pericolo, pericoloIdx);
            return;
        }
        let candidatiNomi = disponibili.map((p, i) => `${i}: ${p.nome}`).join('\n');
        let scelti = prompt(`Chi vuoi invitare? Scrivi fino a 2 numeri separati da virgola (es. "0,2").\n${candidatiNomi}`);
        let indiciScelti = [...new Set((scelti || '').split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n >= 0 && n < disponibili.length))];
        if (indiciScelti.length > 2) {
            alert(`Puoi invitare al massimo 2 compagni. Verranno considerati solo: ${indiciScelti.slice(0, 2).map(i => disponibili[i].nome).join(', ')}.`);
            indiciScelti = indiciScelti.slice(0, 2);
        }
        const destinatari = indiciScelti.map(i => disponibili[i]).filter(p => p && p.id);
        if (destinatari.length === 0) {
            avviaEsplorazioneGruppo(leader, [], pericolo, pericoloIdx);
            return;
        }

        // Usa il sistema di inviti server invece delle proposte locali
        inviaInvitiEsplorazione(leader, destinatari, pericolo, pericoloIdx);
    } else {
        avviaEsplorazioneGruppo(leader, [], pericolo, pericoloIdx);
    }
}

async function inviaInvitiEsplorazione(leader, destinatari, pericolo, pericoloIdx) {
    const idSpedizione = `sped-${Date.now()}-${leader.id}`;
    try {
        const res = await fetch(apiUrl('/api/inviti'), {
            method: 'POST',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ idSpedizione, mittenteId: leader.id, destinatariIds: destinatari.map(d => d.id) })
        });
        if (!res.ok) throw new Error('Errore invio inviti');
        mostraNotificaInAlto(`${leader.nome} attende risposte per l'esplorazione di gruppo (max 2 minuti)...`, 'info');
        attendiRisposteInviti(idSpedizione, leader, destinatari, pericolo, pericoloIdx);
    } catch (e) {
        alert("Errore durante l'invio degli inviti: " + e.message);
        avviaEsplorazioneGruppo(leader, [], pericolo, pericoloIdx);
    }
}

function attendiRisposteInviti(idSpedizione, leader, destinatari, pericolo, pericoloIdx) {
    const scadenza = Date.now() + 2 * 60 * 1000;
    const interval = setInterval(async () => {
        try {
            const res = await fetch(apiUrl(`/api/inviti?idSpedizione=${encodeURIComponent(idSpedizione)}`), { headers: buildAuthHeaders() });
            const data = await res.json();
            const inviti = data.inviti || [];
            const tuttiRisposti = inviti.length > 0 && inviti.every(i => i.stato !== 'in_attesa');
            if (tuttiRisposti || Date.now() >= scadenza) {
                clearInterval(interval);
                const accettatiIds = inviti.filter(i => i.stato === 'accettato').map(i => i.destinatario_personaggio_id);
                const compagni = destinatari.filter(d => accettatiIds.includes(d.id)).slice(0, 2);
                if (accettatiIds.length > 2) {
                    mostraNotificaInAlto(`Solo i primi 2 che hanno accettato partiranno con ${leader.nome}.`, 'avviso');
                }
                avviaEsplorazioneGruppo(leader, compagni, pericolo, pericoloIdx);
            }
        } catch (e) {
            console.warn('Errore polling inviti:', e);
        }
    }, 4000);
}

function avviaEsplorazioneGruppo(leader, compagni, pericolo, pericoloIdx) {
    const gruppoSpedizione = [leader, ...compagni];
    gruppoSpedizione.forEach(p => { if (typeof p.initInventarioBase === 'function') p.initInventarioBase(); });
    const numCompagni = gruppoSpedizione.length - 1;

    let totaleAumentoTempo = 0;
    gruppoSpedizione.forEach(p => {
        let { timePenalty } = calcolaEventiPericolo(p, pericolo.mult, numCompagni);
        if (numCompagni === 0 && p.hasPerk && p.hasPerk('Pessimo orientamento')) {
            if (Math.floor(Math.random() * 100) + 1 <= 70) {
                timePenalty += 85;
                alert(`🧭 ${p.nome} ha Pessimo Orientamento e ha perso l'orientamento!`);
            }
        }
        totaleAumentoTempo += timePenalty;
    });

    const mediaAumentoTempo = totaleAumentoTempo / gruppoSpedizione.length;
    let oreSpedizione = Math.round(pericolo.oreBase * (1 + (mediaAumentoTempo / 100)));

// PERK: Abbandono — rifiuta l'esplorazione in solitaria se dura più di 3 ore
    if (numCompagni === 0 && leader.hasPerk && leader.hasPerk('Abbandono') && oreSpedizione > 3) {
        alert(`${leader.nome} ha paura di rimanere da solo, si rifiuta di andare via da solo.`);
        return;
    }

    alert(`Il gruppo parte per un'esplorazione ${pericolo.nome}${compagni.length ? ' insieme a ' + compagni.map(c => c.nome).join(', ') : ' da solo'}.\nDurata prevista: ${oreSpedizione} ore (Modifica media tempo: +${mediaAumentoTempo.toFixed(1)}%)`);

    const idSpedizioneGlobale = Date.now();
    gruppoSpedizione.forEach(p => {
        p.azioneCorrente = {
            tipo: 'esplora',
            idSpedizione: idSpedizioneGlobale,
            pericoloMultiplo: pericolo.mult,
            pericoloBonus: pericolo.bonus,
            livelloPericolo: pericoloIdx,
            numCompagni,
            oreTotali: oreSpedizione,
            oreRimanenti: oreSpedizione,
            isLeader: p === leader,
            membri: gruppoSpedizione.map(m => m.nome),
            onComplete: () => terminaEsplorazione(p)
        };
        salvaPersonaggioCloud(p); // Salva lo stato aggiornato
    });

    if (typeof aggiornaInterfaccia === 'function') aggiornaInterfaccia();
}

function calcolaEventiPericolo(p, mult, numCompagni) {
    // Riduzione base: 25% per ogni compagno
    let modRiduzione = numCompagni * 0.25;
    if (modRiduzione > 0.50) modRiduzione = 0.50; // Max 50%

    // Riduzione Buff (Fame, Sete, Sonno)
    let buffRed = 0;
    if (p.timers) {
        if (p.timers.buffFame > 0) buffRed += 0.02;
        if (p.timers.buffSete > 0) buffRed += 0.02;
        if (p.timers.buffSonno > 0) buffRed += 0.02;
    }

    // --- PERK: Solitario ---
    if (numCompagni === 0 && p.hasPerk && p.hasPerk('Solitario')) {
        buffRed += 0.10;
    }

    // Aumenti Malus
    let faticaMalus = (p.faticaTotale || 0) * 15;
    let hpMalus = (p.puntiFeritaReali < 4) ? 10 : 0;

    const calcProb = (baseProb) => {
        let prob = baseProb * mult;
        prob = prob * (1 - modRiduzione);
        prob -= (buffRed * 100);
        prob += faticaMalus + hpMalus;
        return Math.max(0, prob);
    };

    const d100 = () => Math.floor(Math.random() * 100) + 1;

    let risultati = { timePenalty: 0, lootLost: 0, hpDamage: 0, fatigueStagies: 0 };

    if (d100() <= calcProb(10)) risultati.timePenalty = 90;
    else if (d100() <= calcProb(15)) risultati.timePenalty = 60;
    else if (d100() <= calcProb(20)) risultati.timePenalty = 30;

    if (d100() <= calcProb(8)) risultati.lootLost = 60;
    else if (d100() <= calcProb(13)) risultati.lootLost = 40;
    else if (d100() <= calcProb(18)) risultati.lootLost = 20;

    if (d100() <= calcProb(5)) risultati.hpDamage = 2;
    else if (d100() <= calcProb(10)) risultati.hpDamage = 1;

    if (d100() <= calcProb(15)) risultati.fatigueStagies = 1;

    return risultati;
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

function terminaEsplorazione(p) {
    if (!p) return;
    try {
        const act = p.azioneCorrente || {};
        let bonus = act.pericoloBonus !== undefined ? act.pericoloBonus : getExplorationBonus(p);
        const mult = act.pericoloMultiplo || 1;
        const diffLevel = act.livelloPericolo || 0;
        const numCompagni = act.numCompagni || 0;

        if (numCompagni === 0 && p.hasPerk && p.hasPerk('Solitario')) {
            bonus += 1;
        }

        const pericoli = calcolaEventiPericolo(p, mult, numCompagni);
        const skill = p.getSkillModifierForCheck ? p.getSkillModifierForCheck('Sopravvivenza') : {
            modifier: 0,
            advantage: false,
            disadvantage: false
        };

        // Tiri standard base
        const mediciTiro = Math.min(20, rollD20WithAdv(skill.advantage, skill.disadvantage) + bonus);
        const ingranaggiTiro = Math.min(20, rollD20WithAdv(skill.advantage, skill.disadvantage) + bonus);
        const alchemiciTiro = Math.min(20, rollD20WithAdv(skill.advantage, skill.disadvantage) + bonus);
        const ciboTiro = Math.min(20, rollD20WithAdv(skill.advantage, skill.disadvantage) + bonus);
        const acquaTiro = Math.min(20, rollD20WithAdv(skill.advantage, skill.disadvantage) + bonus) * 1.25;
        const booksTiro = Math.min(20, (typeof rollD20 === 'function' ? rollD20() : Math.floor(Math.random() * 20) + 1) + bonus);

        // Generazione base
        let medici = lootMedici(mediciTiro);
        let ingranaggi = lootIngranaggi(ingranaggiTiro);
        let alchemici = lootAlchemici(alchemiciTiro);
        let cibo = lootCiboAcqua(ciboTiro);
        let acqua = lootCiboAcqua(acquaTiro);
        let deliziosi = lootPiattiDeliziosi(ciboTiro);
        let booksFound = lootBooks(booksTiro);

        // Generazione oggetti speciali
        let oggMagiciTrovati = (typeof lootOggettiMagici === 'function') ? lootOggettiMagici(diffLevel) : {
            comuni: 0,
            nonComuni: 0,
            rari: 0,
            superRari: 0
        };
        let armiTrovate = rollArmiTrovate(diffLevel);

        // --- APPLICAZIONE MALUS LOOT PERSO ---
        if (pericoli.lootLost > 0) {
            const ritieni = 1 - (pericoli.lootLost / 100);
            medici.base = Math.floor(medici.base * ritieni);
            medici.avanzati = Math.floor(medici.avanzati * ritieni);
            medici.critici = Math.floor(medici.critici * ritieni);
            ingranaggi = Math.floor(ingranaggi * ritieni);
            alchemici = Math.floor(alchemici * ritieni);
            cibo = Math.floor(cibo * ritieni);
            acqua = Math.floor(acqua * ritieni);
            deliziosi = Math.floor(deliziosi * ritieni);
            booksFound = Math.floor(booksFound * ritieni);

            armiTrovate = armiTrovate.filter(arma => {
                if (arma.tipo === 'arma') {
                    return Math.random() > (pericoli.lootLost / 100);
                } else {
                    arma.qta = Math.floor(arma.qta * ritieni);
                    return arma.qta > 0;
                }
            });
        }

        // --- APPLICAZIONE DANNI FISICI ---
        if (pericoli.hpDamage > 0) p.puntiFeritaReali -= pericoli.hpDamage;
        if (pericoli.fatigueStagies > 0 && typeof p.faticaBase !== 'undefined') p.faticaBase += pericoli.fatigueStagies;

        // --- ASSEGNAZIONE MAGAZZINO ---
        p.initInventarioBase();
        p.inventario.alchemici = (p.inventario.alchemici || 0) + alchemici;
        p.inventario.ingranaggi = (p.inventario.ingranaggi || 0) + ingranaggi;
        p.inventario.medBase = (p.inventario.medBase || 0) + medici.base;
        p.inventario.medAvanzati = (p.inventario.medAvanzati || 0) + medici.avanzati;
        p.inventario.medCritici = (p.inventario.medCritici || 0) + medici.critici;
        p.inventario.cibo = (p.inventario.cibo || 0) + cibo;
        p.inventario.acqua = (p.inventario.acqua || 0) + acqua;
        p.inventario.piattiDeliziosi = (p.inventario.piattiDeliziosi || 0) + deliziosi;
        let nuovoZaino = rollZainoTrovato(diffLevel);
        if (nuovoZaino) {
            p.initInventarioBase();
            if (!p.zainoEquipaggiato || nuovoZaino.bonus > p.zainoEquipaggiato.bonus) {
                if (p.zainoEquipaggiato) p.inventario.zaini.push(p.zainoEquipaggiato);
                p.zainoEquipaggiato = nuovoZaino;
                mostraNotificaInAlto(`${p.nome} ha trovato e indossato: ${nuovoZaino.nome}!`, 'successo');
            } else {
                p.inventario.zaini.push(nuovoZaino);
                mostraNotificaInAlto(`${p.nome} ha trovato uno zaino (${nuovoZaino.nome}) e lo porta con sé.`, 'successo');
            }
        }
        if (p.pesoAttuale > p.capacitaMax) {
            apriSceltaEccedenza(party.indexOf(p));
        }

        // Oggetti magici e armi restano a gestione di gruppo/master (vanno diretti in magazzino)
        magazzino.oggettiMagici.comuni += oggMagiciTrovati.comuni;
        magazzino.oggettiMagici.nonComuni += oggMagiciTrovati.nonComuni;
        magazzino.oggettiMagici.rari += oggMagiciTrovati.rari;
        magazzino.oggettiMagici.superRari += oggMagiciTrovati.superRari;

        if (!magazzino.armiTrovate) magazzino.armiTrovate = [];
        let infoArmiStr = "";
        if (armiTrovate.length > 0) {
            armiTrovate.forEach(arma => {
                magazzino.armiTrovate.push(arma);
                infoArmiStr += `  - ${arma.nome} (x${arma.qta})\n`;
            });
        }

        let infoMagica = "";
        if (oggMagiciTrovati.comuni > 0) infoMagica += `• Oggetti Magici Comuni: +${oggMagiciTrovati.comuni}\n`;
        if (oggMagiciTrovati.nonComuni > 0) infoMagica += `• Oggetti Magici Non Comuni: +${oggMagiciTrovati.nonComuni}\n`;
        if (oggMagiciTrovati.rari > 0) infoMagica += `• Oggetti Magici Rari: +${oggMagiciTrovati.rari}\n`;
        if (oggMagiciTrovati.superRari > 0) infoMagica += `• 🌟 Oggetti Magici SUPER RARI: +${oggMagiciTrovati.superRari}\n`;

        let infoMalus = "";
        if (pericoli.lootLost > 0) infoMalus += `⚠️ Bottino perso durante la via: -${pericoli.lootLost}%\n`;
        if (pericoli.hpDamage > 0) infoMalus += `🩸 Ferite subite: -${pericoli.hpDamage} PF\n`;
        if (pericoli.fatigueStagies > 0) infoMalus += `😓 Fatica aumentata: +${pericoli.fatigueStagies} stadi\n`;

        alert(`Esplorazione completata da ${p.nome}!\n\nRisultati:\n` +
            `• Materiali alchemici: +${alchemici}\n` +
            `• Ingranaggi: +${ingranaggi}\n` +
            `• Medici: base +${medici.base}, avz +${medici.avanzati}, crit +${medici.critici}\n` +
            `• Cibo: +${cibo}\n` +
            `• Acqua: +${acqua}\n` +
            `${deliziosi > 0 ? `• Piatti deliziosi: +${deliziosi}\n` : ''}` +
            `• Libri: +${booksFound}\n` +
            `${infoArmiStr ? `• ⚔️ Armi/Munizioni Trovate:\n${infoArmiStr}` : ''}` +
            infoMagica + "\n" +
            (infoMalus ? `\n--- EVENTI AVVERSI ---\n${infoMalus}` : "Nessun evento avverso!")
        );
        if (typeof window.salvaPersonaggioCloud === 'function') {
            window.salvaPersonaggioCloud(p);
        }
        if (typeof window.updateMagazzinoFields === 'function') {
            window.updateMagazzinoFields({
                oggettiMagici: magazzino.oggettiMagici,
                armiTrovate: magazzino.armiTrovate
            });
        }
        p.azioneCorrente = null;
        if (typeof window.apriGestioneRitorno === 'function') {
            window.apriGestioneRitorno(party.indexOf(p));
        }
        // Riepilogo per la notifica
        let msgNotifica = `Esplorazione completata da ${p.nome}!\n`;
        msgNotifica += `• Alchemici: +${alchemici}\n• Ingranaggi: +${ingranaggi}\n`;
        msgNotifica += `• Medici: base +${medici.base}, avz +${medici.avanzati}, crit +${medici.critici}\n`;
        msgNotifica += `• Cibo: +${cibo}\n• Acqua: +${acqua}\n`;
        if (deliziosi > 0) msgNotifica += `• Piatti deliziosi: +${deliziosi}\n`;
        if (booksFound > 0) msgNotifica += `• Libri: +${booksFound}\n`;
        if (infoArmiStr) msgNotifica += `• Armi: ${infoArmiStr}`;
        if (infoMagica) msgNotifica += infoMagica;
        if (infoMalus) msgNotifica += `\n${infoMalus}`;
        mostraNotificaInAlto(msgNotifica, 'successo');
        aggiornaInterfaccia();
    } catch (e) {
        console.error('Errore in terminaEsplorazione:', e);
        if (typeof mostraNotificaInAlto === 'function') {
            mostraNotificaInAlto(`⚠️ Esplorazione di ${p.nome} terminata con errore: ${e.message}`, 'pericolo');
        }
        p.azioneCorrente = null;
        if (typeof salvaPersonaggioCloud === 'function') salvaPersonaggioCloud(p);
        aggiornaInterfaccia();
    }
}
function apriSceltaEccedenza(idx) {
    const p = party[idx];
    if (!p) return;
    let modal = document.getElementById('modal-eccedenza');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-eccedenza';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    renderEccedenzaModal(idx);
    modal.style.display = 'block';
}

function getExplorationBonus(p) {
    const skill = p.getSkillModifierForCheck ? p.getSkillModifierForCheck('Sopravvivenza') : { modifier: 0, advantage: false, disadvantage: false };
    return skill.modifier || 0;
}

function renderEccedenzaModal(idx) {
    const p = party[idx];
    const modal = document.getElementById('modal-eccedenza');
    const eccedenza = (p.pesoAttuale - p.capacitaMax).toFixed(2);

    const campi = [
        { key: 'cibo', label: 'Cibo', peso: 1 },
        { key: 'acqua', label: 'Acqua', peso: 1 },
        { key: 'ingranaggi', label: 'Ingranaggi', peso: 0.1 },
        { key: 'alchemici', label: 'Materiali Alchemici', peso: 0.1 },
        { key: 'medBase', label: 'Medici Base', peso: 0.1 },
        { key: 'medAvanzati', label: 'Medici Avanzati', peso: 0.1 },
        { key: 'medCritici', label: 'Medici Critici', peso: 0.1 }
    ];

    modal.innerHTML = `
        <div class="modal-content" style="max-width:520px;">
            <h2 style="color:#e74c3c;">⚠️ ZAINO PIENO — ${p.nome}</h2>
            <p style="color:#ddd;">Peso attuale: ${p.pesoAttuale.toFixed(2)} / Capacità: ${p.capacitaMax} (eccedenza: ${eccedenza})</p>
            <p style="color:#aaa; font-size:0.85rem;">Scegli cosa lasciare al magazzino base per rientrare nella capacità (verrà depositato automaticamente).</p>
            <div style="display:grid; gap:8px; text-align:left; margin:12px 0;">
                ${campi.filter(c => (p.inventario[c.key] || 0) > 0).map(c => `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:6px; border:1px solid #333;">
                        <span>${c.label} (hai ${p.inventario[c.key].toFixed ? p.inventario[c.key].toFixed(1) : p.inventario[c.key]})</span>
                        <div>
                            <input type="number" id="ecc-${c.key}" min="0" max="${p.inventario[c.key]}" value="0" style="width:70px;">
                            <span style="color:#888; font-size:0.75rem;">da lasciare</span>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="modal-footer">
                <button class="btn-big btn-confirm" onclick="confermaEccedenza(${idx})">DEPOSITA E CONFERMA</button>
            </div>
        </div>`;
}

window.useTaser = function(idx) {
    const p = party[idx];
    if (!p || !p.taserCaricato) return;
    p.taserCaricato = false;
    mostraNotificaInAlto(`${p.nome} usa il Taser: si è scaricato.`, 'info');
    salvaPersonaggioCloud(p);
    renderSpedizioneModal();
    aggiornaInterfaccia();
};
window.ricaricaTaser = function(idx) {
    const p = party[idx];
    if (!p || (p.inventario?.batterie || 0) <= 0) return alert('Nessuna batteria disponibile.');
    p.inventario.batterie -= 1;
    p.taserCaricato = true;
    mostraNotificaInAlto(`${p.nome} ha ricaricato il Taser.`, 'successo');
    salvaPersonaggioCloud(p);
    renderSpedizioneModal();
    aggiornaInterfaccia();
};
window.consumaProiettileFrammentazione = function(idx) {
    const p = party[idx];
    if (!p || (p.inventario?.proiettiliFrammentazione || 0) <= 0) return;
    p.inventario.proiettiliFrammentazione -= 1;
    mostraNotificaInAlto(`${p.nome} usa un Proiettile a Frammentazione.`, 'info');
    salvaPersonaggioCloud(p);
    renderSpedizioneModal();
    aggiornaInterfaccia();
};
window.useStivaliMolla = function(idx) {
    const p = party[idx];
    if (!p || p.stivaliCariche <= 0) return;
    p.stivaliCariche -= 1;
    mostraNotificaInAlto(`${p.nome} usa gli Stivali a Molla (${p.stivaliCariche}/3 cariche).`, 'info');
    salvaPersonaggioCloud(p);
    renderSpedizioneModal();
    aggiornaInterfaccia();
};
window.ricaricaStivali = function(idx) {
    const p = party[idx];
    if (!p || (p.inventario?.batterie || 0) <= 0) return alert('Nessuna batteria disponibile.');
    p.inventario.batterie -= 1;
    p.stivaliCariche = 3;
    mostraNotificaInAlto(`${p.nome} ha ricaricato gli Stivali a Molla.`, 'successo');
    salvaPersonaggioCloud(p);
    renderSpedizioneModal();
    aggiornaInterfaccia();
};

function confermaEccedenza(idx) {
    const p = party[idx];
    const campi = ['cibo', 'acqua', 'ingranaggi', 'alchemici', 'medBase', 'medAvanzati', 'medCritici'];
    const mapMagazzino = { medBase: 'materialiMedici.base', medAvanzati: 'materialiMedici.avanzati', medCritici: 'materialiMedici.critici', alchemici: 'materialiAlchemici' };

    campi.forEach(key => {
        const input = document.getElementById(`ecc-${key}`);
        if (!input) return;
        let qty = parseFloat(input.value);
        if (isNaN(qty) || qty <= 0) return;
        qty = Math.min(qty, p.inventario[key] || 0);
        p.inventario[key] = Math.max(0, (p.inventario[key] || 0) - qty);

        if (key === 'medBase') magazzino.materialiMedici.base = (magazzino.materialiMedici.base || 0) + qty;
        else if (key === 'medAvanzati') magazzino.materialiMedici.avanzati = (magazzino.materialiMedici.avanzati || 0) + qty;
        else if (key === 'medCritici') magazzino.materialiMedici.critici = (magazzino.materialiMedici.critici || 0) + qty;
        else if (key === 'alchemici') magazzino.materialiAlchemici = (magazzino.materialiAlchemici || 0) + qty;
        else magazzino[key] = (magazzino[key] || 0) + qty;
    });

    if (typeof window.updateMagazzinoFields === 'function') {
        window.updateMagazzinoFields({
            materialiMedici: magazzino.materialiMedici,
            materialiAlchemici: magazzino.materialiAlchemici,
            cibo: magazzino.cibo,
            acqua: magazzino.acqua,
            ingranaggi: magazzino.ingranaggi
        });
    }

    if (p.pesoAttuale > p.capacitaMax) {
        alert('Ancora sopra la capacità: lascia altro materiale.');
        renderEccedenzaModal(idx);
        return;
    }

    document.getElementById('modal-eccedenza').style.display = 'none';
    if (typeof salvaPersonaggioCloud === 'function') salvaPersonaggioCloud(p);
    aggiornaInterfaccia();
}

window.annullaEsplorazionePerMorte = function annullaEsplorazionePerMorte(personaggio) {
    const azione = personaggio.azioneCorrente;
    if (!azione || azione.tipo !== 'esplora') return;
    const idSpedizione = azione.idSpedizione;
    if (!idSpedizione) return;
    const membri = party.filter(p => p.azioneCorrente && p.azioneCorrente.idSpedizione === idSpedizione);
    membri.forEach(m => {
        if (m === personaggio) return;
        m.inSpedizione = false;
        m.azioneCorrente = null;
        mostraNotificaInAlto(`${m.nome} è stato ritirato dall'esplorazione a causa della morte di ${personaggio.nome}.`, 'pericolo');
        salvaPersonaggioCloud(m);
    });
}

window.usaInsulinaPersonaggio = function(idx) {
    const p = party[idx];
    if (p) p.usaInsulina();
};

window.apriSceltaEccedenza = apriSceltaEccedenza;
window.confermaEccedenza = confermaEccedenza;
// Esposizioni globali
window.mandaTuttiInSpedizione = mandaTuttiInSpedizione;
window.chiudiSpedizione = chiudiSpedizione;
window.ritiraTutti = ritiraTutti;
window.spedisciPersonaggio = spedisciPersonaggio;
window.openSpedizioneModal = openSpedizioneModal;
window.ritiraPersonaggio = ritiraPersonaggio;
window.useInizioCombattimento = useInizioCombattimento;
window.useRigeneraCombattimento = useRigeneraCombattimento;
window.useGuerrieroRigenera = useGuerrieroRigenera;
window.degradaInCombat = degradaInCombat;
window.ferisciInCombat = ferisciInCombat;
window.inviaInvitiEsplorazione = inviaInvitiEsplorazione;
window.avviaEsplorazioneGruppo = avviaEsplorazioneGruppo;
window.esplora = esplora;
window.rollArmiTrovate = rollArmiTrovate;
window.rollZainoTrovato = rollZainoTrovato;
window.segnaVittoria = segnaVittoria;
window.getExplorationBonus = getExplorationBonus;
window.terminaEsplorazione = terminaEsplorazione;