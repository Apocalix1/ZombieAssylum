import { party } from '../state.js';
import { magazzino } from '../state.js';
import { apiUrl, buildAuthHeaders, salvaPersonaggioCloud } from '../logic/logic.js';
import { mostraNotificaInAlto } from '../ui/ui.js';


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

window.toggleCorsaAQuattroZampe = function(idx) {
    const p = party[idx];
    if (!p || !(window.hasPerk && window.hasPerk(p, 'Corsa a 4 zampe'))) return;
    p._corsaAQuattroZampeAttiva = !p._corsaAQuattroZampeAttiva;
    mostraNotificaInAlto(
        p._corsaAQuattroZampeAttiva
            ? `${p.nome} si getta a 4 zampe: +3m velocità, ma può solo consultare scheda/inventario.`
            : `${p.nome} torna sulle due gambe.`,
        p._corsaAQuattroZampeAttiva ? 'avviso' : 'info'
    );
    salvaPersonaggioCloud(p);
    renderSpedizioneModal();
    aggiornaInterfaccia();
};

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
    if (p.hasPerk && p.hasPerk('Degradato')) danno += 1;
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

export function segnaVittoria(idx) {
    const p = party[idx];
    p.registraVittoriaCombattimento();
    renderSpedizioneModal();
    aggiornaInterfaccia();
}


window.usaInsulinaPersonaggio = function(idx) {
    const p = party[idx];
    if (p) p.usaInsulina();
};

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

window.usaCaricaLinguaDiFuoco = function(idx, nomeArma) {
    const p = party[idx];
    if (!p || !p.linguaDiFuoco || !p.linguaDiFuoco[nomeArma] || p.linguaDiFuoco[nomeArma].cariche <= 0) return;
    p.linguaDiFuoco[nomeArma].cariche -= 1;
    mostraNotificaInAlto(`${p.nome} attiva la Lingua di Fuoco su "${nomeArma}": in fiamme per 1 minuto (+1d4 danni fuoco). Cariche: ${p.linguaDiFuoco[nomeArma].cariche}/${p.linguaDiFuoco[nomeArma].caricheMax}.`, 'successo');
    salvaPersonaggioCloud(p);
    renderSpedizioneModal();
    aggiornaInterfaccia();
};

window.ricaricaLinguaDiFuoco = function(idx, nomeArma) {
    const p = party[idx];
    if (!p || !p.linguaDiFuoco || !p.linguaDiFuoco[nomeArma]) return;
    if ((window.magazzino.ingranaggi || 0) < 8) return alert('Servono 8 ingranaggi per ricaricare 1 carica.');
    window.magazzino.ingranaggi -= 8;
    p.linguaDiFuoco[nomeArma].cariche = Math.min(p.linguaDiFuoco[nomeArma].caricheMax, p.linguaDiFuoco[nomeArma].cariche + 1);
    if (typeof window.updateMagazzinoFields === 'function') window.updateMagazzinoFields({ ingranaggi: window.magazzino.ingranaggi });
    mostraNotificaInAlto(`Ricaricata 1 carica su "${nomeArma}" (${p.linguaDiFuoco[nomeArma].cariche}/${p.linguaDiFuoco[nomeArma].caricheMax}). -8 ingranaggi, 10 minuti.`, 'successo');
    salvaPersonaggioCloud(p);
    renderSpedizioneModal();
    aggiornaInterfaccia();
};

function renderIncantesimiConosciutiHtml(p, idx) {
    const elenco = (typeof p.getIncantesimiConosciutiData === 'function') ? p.getIncantesimiConosciutiData() : [];
    if (!elenco.length) return '';
    const righe = elenco.map(sp => {
        const costo = p.getSpellCost ? p.getSpellCost(sp.livello) : 0;
        const modInfo = p.getModificatorePiuAltoPerSpell ? p.getModificatorePiuAltoPerSpell(sp) : null;
        const modLabel = modInfo ? ` (${modInfo.nome} ${modInfo.mod >= 0 ? '+' : ''}${modInfo.mod})` : '';
        let cdTiroLabel = '';
        if ((sp.cd || sp.tiro_abilita) && p.getSpellCDeTiroAbilita) {
            const { cd, tiro } = p.getSpellCDeTiroAbilita(sp);
            if (sp.cd) cdTiroLabel += ` <span style="color:#e67e22;">CD ${cd}</span>`;
            if (sp.tiro_abilita) cdTiroLabel += ` <span style="color:#3498db;">Tiro ${tiro >= 0 ? '+' : ''}${tiro}</span>`;
        }
        const dettagli = [
            sp.azione ? `⚡ ${sp.azione}` : null,
            sp.raggio ? `🎯 ${sp.raggio}` : null,
            sp.durata ? `⏱️ ${sp.durata}` : null,
            sp.concentrazione ? `🧠 Concentrazione` : null
        ].filter(Boolean).join(' • ');
        return `<div style="margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid #222; display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
            <div>
                <strong style="color:#9b59b6;">${sp.nome}</strong>${modLabel}
                <span style="color:#888; font-size:0.75rem;"> (${sp.livello === 0 ? 'Trucchetto' : 'Lv'+sp.livello}, ${sp.categoria === 'cura' ? 'Cura' : (sp.categoria === 'utilita' ? 'Utilità' : 'Danni')}, ${costo} mana)${cdTiroLabel}</span><br>
                ${dettagli ? `<span style="color:#7f8c8d; font-size:0.72rem;">${dettagli}</span><br>` : ''}
                <span style="color:#aaa; font-size:0.8rem;">${sp.desc}</span>
            </div>
            <button class="btn-hero" style="padding:4px 8px; font-size:0.75rem; flex-shrink:0;" onclick="window.consumaIncantesimoNominato(${idx}, '${sp.nome.replace(/'/g, "\\'")}')">Consuma</button>
        </div>`;
    }).join('');
    return `<details style="background:#111; border:1px solid #333; padding:10px; border-radius:6px; margin-top:10px;">
        <summary style="cursor:pointer; font-weight:bold; color:#9b59b6;">🪄 Incantesimi conosciuti</summary>
        <div style="margin-top:8px;">${righe}</div>
    </details>`;
}
window.renderIncantesimiConosciutiHtml = renderIncantesimiConosciutiHtml;

 window.consumaIncantesimoNominato = function(idx, nomeIncantesimo) {
    const p = party[idx];
    if (!p) return;
    const spell = (typeof p.getSpellDataByName === 'function') ? p.getSpellDataByName(nomeIncantesimo) : null;
    if (!spell) return;
    p._nextCastIsCura = (spell.categoria === 'cura');
    p._nextCastSpellName = spell.nome;
    const result = p.castSpell(spell.livello);
    p._nextCastIsCura = false;
    if (!result.success) { alert(result.message); return; }
    let esitoExtra = '';
    const eff = spell.effetto || {};
    if (eff.danno) {
        const danno = (typeof rollDiceNotation === 'function') ? rollDiceNotation(eff.danno) : 0;
        esitoExtra = ` Effetto: ${danno} danni da ${eff.dannoTipo || ''} (da applicare manualmente al bersaglio).`;
    } else if (eff.tipo === 'buff_resistenza') {
        esitoExtra = ` Effetto: resistenza a danni contundenti/perforanti/taglienti fino alla fine del prossimo turno.`;
    }
    mostraNotificaInAlto(`${p.nome} lancia "${spell.nome}". ${result.message}${esitoExtra}`, 'successo');
    if (document.getElementById('modal-consuma-incantesimi')?.style.display === 'block') {
        window.renderConsumaIncantesimiModal(idx);
    }
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
};

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

function renderSchedaSpedizioneRidotta(p, idx) {
    const statiPerTS = ["Forza", "Destrezza", "Costituzione", "Intelligenza", "Saggezza", "Carisma"];
    const haCorsa4Zampe = window.hasPerk && window.hasPerk(p, 'Corsa a 4 zampe');
    const attiva4Zampe = !!p._corsaAQuattroZampeAttiva;
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
                    ${p.livelloMagia > 0 ? `<div>🔮 Mana: ${p.manaAttuale}/${p.manaMax}${p.manaAttuale < 0 ? ` <span style="color:#e74c3c;">(Sovraccarico ${p.manaAttuale})</span>` : ''}</div>` : ''}
                `}
                <div style="margin-top:6px;">${statsHtml}</div>
            </div>
            <div style="display:flex; gap:6px; margin-bottom:10px;">
                <button class="btn-big" style="flex:1;" onclick="apriScheda(${idx})">📋 Scheda</button>
                <button class="btn-big" style="flex:1; background:#16a085;" onclick="apriInventario(${idx})">🎒 Inventario</button>
            </div>
            ${haCorsa4Zampe ? `
            <button class="btn-big" style="width:100%; margin-bottom:10px; background:${attiva4Zampe ? '#c0392b' : '#8e7a3f'};" onclick="toggleCorsaAQuattroZampe(${idx})">
                🐾 ${attiva4Zampe ? 'Torna in piedi' : 'Corsa a 4 zampe (+3m, blocca altre azioni)'}
            </button>` : ''}
            ${attiva4Zampe ? `<div style="color:#e67e22; font-size:0.8rem; margin-bottom:10px;">A 4 zampe: nessun'altra azione disponibile a parte Scheda e Inventario.</div>` : ''}
                 <details style="background:#111; border:1px solid #333; padding:10px; border-radius:6px;">
                <summary style="cursor:pointer; font-weight:bold;">Perk di combattimento</summary>
                <div style="margin-top:8px;">${perkConDesc}</div>
            </details>
            ${renderIncantesimiConosciutiHtml(p, idx)}
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


function renderSchedaCombattimentoMaster(p, idx) {
    const user = getCurrentUser();
    const isMaster = user && user.role === 'master';
    const haCorsa4Zampe = window.hasPerk && window.hasPerk(p, 'Corsa a 4 zampe');
    const attiva4Zampe = !!p._corsaAQuattroZampeAttiva;
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
                    ${p.livelloMagia > 0 ? `
                        <div>🔮 Mana: ${p.manaAttuale} / ${p.manaMax} ${p.manaAttuale < 0 ? `<span style="color:#e74c3c;">(Sovraccarico ${p.manaAttuale})</span>` : ''} ${p._arcaneFatigueApplied ? '<span style="color:#e74c3c;">⚠️ Affaticato</span>' : ''} ${p._magicExhausted ? '<span style="color:#e74c3c;">⛔ Esaurito</span>' : ''}</div>
                        ${typeof getBarra === 'function' ? getBarra(Math.max(0, p.manaAttuale), p.manaMax, '#9b59b6') : ''}
                    ` : ''}
                `}
                <div style="margin-top:8px; font-size:0.85rem; color:#aaa;">Vittorie comb.: ${p.vittorieCombattimento || 0}</div>
            </div>
            <div class="combat-buttons" style="display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:8px; margin-bottom:12px;">
                <button onclick="degradaInCombat(${idx})">Degrada</button>
                <button onclick="ferisciInCombat(${idx})">Ferisci</button>
                <button onclick="registraAttaccoModal(${idx})">📈 Reg. Attacco</button>
                <button onclick="useRigeneraCombattimento(${idx})">Rigenera</button>
                <button onclick="segnaVittoria(${idx})">Segna vittoria</button>
              ${isMaster ? `<button onclick="masterAggiungiOggetto(${idx})" style="background:#8e44ad;">🎁 Dai loot</button>` : ''}
                ${(p.livelloMagia > 0 && Object.values(p.spellsKnown || {}).some(v => v > 0)) ? `<button onclick="apriConsumaIncantesimi(${idx})">🪄 Magia</button>` : ''}
                ${(p.livelloMagia > 0) ? `<button onclick="apriElencoIncantesimi(${idx})">📖 Elenco Incantesimi</button>` : ''}
                ${(p.inventario && p.inventario.composti && p.inventario.composti.length > 0) ? `<button onclick="apriConsumaComposti(${idx})">🧪 Composti</button>` : ''}
                ${(() => {
                    let extras = '';
                    if (p.hasPerk && p.hasPerk('Stress fisico') && p.faticaTotale > 0) extras += `<button style="background:#8e44ad;" onclick="useStressFisico(${idx})">⚡ Stress Fisico</button>`;
                    if (typeof hasPerk === 'function' && hasPerk(p, 'Produrre veleni')) extras += `<button onclick="produciVeleno(${idx})">🧪 Produci Veleno</button>`;
                    if (typeof hasPerk === 'function' && hasPerk(p, 'Nato per combattere')) extras += `<button onclick="useInizioCombattimento(${idx})">Rigenera inizio</button>`;
                    if (typeof hasPerk === 'function' && hasPerk(p, 'Guerriero')) extras += `<button onclick="useGuerrieroRigenera(${idx})">Rigenera Guerriero</button>`;
                    if (p.perks && p.perks.some(pp => (pp.nome||pp) === "Fino all'ultimo")) extras += `<button onclick="toggleFinoAllUltimo(${idx})">${p.finoAllUltimoActive ? 'Disattiva FinoAll' : "Usa Fino all'ultimo"}</button>`;
                    if (p.isRobot && hasPerk(p, 'Protocollo Overclock')) extras += `<button onclick="attivaOverclock(${idx})">⚡ Overclock (-5h batt.)</button>`;
                    if (p.isRobot && hasPerk(p, 'Scudo Energetico')) extras += `<button onclick="attivaScudoEnergetico(${idx})">🛡️ Scudo Energetico (-5h batt.)</button>`;
                                        if (p.inventario?.armi?.includes('Taser')) {
                        extras += p.taserCaricato ? `<button onclick="useTaser(${idx})">⚡ Usa Taser</button>` : `<button onclick="ricaricaTaser(${idx})" ${((p.inventario?.batterie||0) > 0) ? '' : 'disabled'}>🔋 Ricarica Taser</button>`;
                    }
                    if (p.linguaDiFuoco) {
                        Object.entries(p.linguaDiFuoco).forEach(([nomeArma, dati]) => {
                            extras += `<button onclick="usaCaricaLinguaDiFuoco(${idx}, '${nomeArma.replace(/'/g,"\\'")}')" ${dati.cariche > 0 ? '' : 'disabled'}>🔥 ${nomeArma} (${dati.cariche}/${dati.caricheMax})</button>`;
                            extras += `<button onclick="ricaricaLinguaDiFuoco(${idx}, '${nomeArma.replace(/'/g,"\\'")}')" ${dati.cariche < dati.caricheMax ? '' : 'disabled'}>⚙️ Ricarica (8 ing.)</button>`;
                        });
                    }
                    if (p.inventario?.proiettiliFrammentazione > 0) extras += `<button onclick="consumaProiettileFrammentazione(${idx})">💥 Proiettile Framment. (${p.inventario.proiettiliFrammentazione})</button>`;
                     if (p.inventario?.armi?.includes('Stivali a Molla') && p.stivaliCariche > 0) extras += `<button onclick="useStivaliMolla(${idx})">🦵 Usa Stivali (${p.stivaliCariche}/3)</button>`;
                    else if (p.inventario?.armi?.includes('Stivali a Molla')) extras += `<button onclick="ricaricaStivali(${idx})" ${((p.inventario?.batterie||0) > 0) ? '' : 'disabled'}>🔋 Ricarica Stivali</button>`;
                    if (typeof hasPerk === 'function' && hasPerk(p, 'Origine demoniaca')) {
                        const nCariche = (p.origineDemonicaCaricheTimers || []).length;
                        extras += `<button onclick="window.assorbiDannoFuocoDemoniaco(${idx})">🔥 Assorbi fuoco (reaz.)</button>`;
                        extras += `<button onclick="window.usaCaricaFuocoDemoniaco(${idx})" ${nCariche > 0 ? '' : 'disabled'}>💥 Usa carica fuoco (${nCariche}/4)</button>`;
                    }
                    return extras;
                })()}
            </div>
            <details style="background:#111; border:1px solid #333; padding:10px; border-radius:6px;">
                <summary style="cursor:pointer; font-weight:bold;">Mostra perks di combattimento</summary>
                <div style="margin-top:8px; color:#eee; font-size:0.9rem;">${perkList}</div>
            </details>
            ${renderIncantesimiConosciutiHtml(p, idx)}
        </div>`;
}

window.assorbiDannoFuocoDemoniaco = function(idx) {
    const p = party[idx];
    if (!p || !(hasPerk && hasPerk(p, 'Origine demoniaca'))) return;
    p.origineDemonicaCaricheTimers = p.origineDemonicaCaricheTimers || [];
    if (p.origineDemonicaCaricheTimers.length >= 4) {
        alert(`${p.nome} ha già il massimo di 4 cariche di fuoco.`);
        return;
    }
    p.origineDemonicaCaricheTimers.push(4); // 4 ore prima che si scarichi
    mostraNotificaInAlto(`${p.nome} assorbe fino a 2 danni da fuoco (reazione): +1 carica di fuoco (${p.origineDemonicaCaricheTimers.length}/4).`, 'successo');
    salvaPersonaggioCloud(p);
    renderSpedizioneModal();
    aggiornaInterfaccia();
};

window.usaCaricaFuocoDemoniaco = function(idx) {
    const p = party[idx];
    if (!p || !(hasPerk && hasPerk(p, 'Origine demoniaca'))) return;
    if (!(p.origineDemonicaCaricheTimers || []).length) return alert('Nessuna carica di fuoco disponibile.');
    p.origineDemonicaCaricheTimers.shift();
    mostraNotificaInAlto(`${p.nome} usa una reazione e una carica di fuoco: +2 danni da fuoco al prossimo attacco (${p.origineDemonicaCaricheTimers.length}/4 rimaste).`, 'successo');
    salvaPersonaggioCloud(p);
    renderSpedizioneModal();
    aggiornaInterfaccia();
};

window.apriElencoIncantesimi = function(idx) {
    const p = party[idx];
    if (!p) return;
    let modal = document.getElementById('modal-elenco-incantesimi');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-elenco-incantesimi';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    window._elencoIncantesimiFiltri = { livello: 'all', tipo: 'all', stat: 'all' };
    modal.innerHTML = `
        <div class="modal-content" style="max-width:560px;">
            <h2 style="color:#8e44ad;">📖 I Tuoi Incantesimi</h2>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
                <select style="background:#222; color:white; border:1px solid #444; padding:6px;" onchange="window.aggiornaFiltroElencoIncantesimi(${idx}, 'livello', this.value)">
                    <option value="all">Tutti i livelli</option>
                    <option value="0">Trucchetto</option>
                    <option value="1">Livello 1</option>
                    <option value="2">Livello 2</option>
                    <option value="3">Livello 3</option>
                    <option value="4">Livello 4</option>
                </select>
                <select style="background:#222; color:white; border:1px solid #444; padding:6px;" onchange="window.aggiornaFiltroElencoIncantesimi(${idx}, 'tipo', this.value)">
                    <option value="all">Tutti i tipi</option>
                    <option value="danni">Danni</option>
                    <option value="cura">Cura</option>
                    <option value="utilita">Utilità</option>
                </select>
                <select style="background:#222; color:white; border:1px solid #444; padding:6px;" onchange="window.aggiornaFiltroElencoIncantesimi(${idx}, 'stat', this.value)">
                    <option value="all">Tutte le caratteristiche</option>
                    <option value="qualsiasi">Qualsiasi</option>
                    <option value="intelligenza">Intelligenza</option>
                    <option value="saggezza">Saggezza</option>
                    <option value="carisma">Carisma</option>
                </select>
            </div>
            <div id="elenco-incantesimi-content" style="text-align:left; max-height:440px; overflow-y:auto; background:#111; padding:10px; border:1px solid #333;"></div>
            <div class="modal-footer">
                <button class="btn-big btn-cancel" onclick="chiudiModal('modal-elenco-incantesimi')">CHIUDI</button>
            </div>
        </div>`;
    window.renderElencoIncantesimiList(idx);
    modal.style.display = 'block';
};

window.aggiornaFiltroElencoIncantesimi = function(idx, campo, valore) {
    window._elencoIncantesimiFiltri = window._elencoIncantesimiFiltri || { livello: 'all', tipo: 'all', stat: 'all' };
    window._elencoIncantesimiFiltri[campo] = valore;
    window.renderElencoIncantesimiList(idx);
};

window.renderElencoIncantesimiList = function(idx) {
    const p = party[idx];
    const container = document.getElementById('elenco-incantesimi-content');
    if (!p || !container) return;
    const db = window.DATABASE_INCANTESIMI || {};
    const conosciuti = p.incantesimi || [];
    const filtri = window._elencoIncantesimiFiltri || { livello: 'all', tipo: 'all', stat: 'all' };

    let html = '';
    Object.entries(db).forEach(([categoria, elenco]) => {
        if (filtri.tipo !== 'all' && categoria !== filtri.tipo) return;
        (elenco || []).forEach(sp => {
            if (!conosciuti.includes(sp.nome)) return;
            if (filtri.livello !== 'all' && String(sp.livello) !== filtri.livello) return;
            if (filtri.stat !== 'all') {
                const mods = (Array.isArray(sp.modificatore) ? sp.modificatore : []).map(m => (m || '').toLowerCase());
                if (!mods.includes(filtri.stat)) return;
            }
            const { cd, tiro } = p.getSpellCDeTiroAbilita(sp);
            let extra = '';
            if (sp.cd === true) extra += `<span style="color:#e67e22;">CD ${cd}</span> `;
            if (sp.tiro_abilita === true) extra += `<span style="color:#3498db;">Tiro abilità ${tiro >= 0 ? '+' : ''}${tiro}</span>`;
            const dettagli = [
                sp.azione ? `⚡ ${sp.azione}` : null,
                sp.raggio ? `🎯 ${sp.raggio}` : null,
                sp.durata ? `⏱️ ${sp.durata}` : null,
                sp.concentrazione ? `🧠 Concentrazione` : null
            ].filter(Boolean).join(' • ');
            html += `
                <div style="background:#1a1a2e; padding:8px; margin-bottom:6px; border-left:3px solid #9b59b6; border-radius:4px;">
                    <div style="display:flex; justify-content:space-between; gap:8px;">
                        <strong style="color:#fff;">${sp.nome}</strong>
                        <span style="font-size:0.78rem; color:#888;">(${sp.livello === 0 ? 'Trucchetto' : 'Lv'+sp.livello}, ${categoria})</span>
                    </div>
                    ${dettagli ? `<div style="color:#7f8c8d; font-size:0.72rem; margin-top:2px;">${dettagli}</div>` : ''}
                    <div style="color:#aaa; font-size:0.8rem; margin-top:2px;">${sp.desc}</div>
                    <div style="margin-top:4px; font-size:0.85rem;">${extra}</div>
                </div>`;
        });
    });
    container.innerHTML = html || `<p style="color:#aaa;">${conosciuti.length === 0 ? 'Non conosci ancora nessun incantesimo.' : 'Nessun incantesimo corrisponde ai filtri selezionati.'}</p>`;
};

function assegnaMetodiMagiaSeMancanti(p) {
    if (!p) return;
    if (typeof p.canCastSpell !== 'function') {
        p.canCastSpell = function(level) {
            const cost = this.getSpellCost ? this.getSpellCost(level) : (level === 0 ? 0 : level * 2);
            if ((this.manaAttuale || 0) < cost && !this._magicExhausted) {
                return { allowed: false, reason: 'Mana insufficiente' };
            }
            return { allowed: true };
        };
    }
    if (typeof p.castSpell !== 'function') {
        p.castSpell = function(level) {
            const check = this.canCastSpell(level);
            if (!check.allowed) return { success: false, message: check.reason };
            const cost = this.getSpellCost ? this.getSpellCost(level) : (level === 0 ? 0 : level * 2);
            this.manaAttuale = (this.manaAttuale || 0) - cost;
            return { success: true, message: `Lanciato incantesimo di livello ${level} (-${cost} mana).` };
        };
    }
    if (typeof p.getSpellCost !== 'function') {
        p.getSpellCost = function(level) {
            return level === 0 ? 0 : level * 2;
        };
    }
    if (typeof p.getIncantesimiConosciutiData !== 'function') {
        p.getIncantesimiConosciutiData = function() {
            const conosciuti = this.incantesimi || [];
            const flatDb = window.getSpellDatabaseFlat ? window.getSpellDatabaseFlat() : [];
            return flatDb.filter(sp => conosciuti.includes(sp.nome));
        };
    }
    if (typeof p.getSpellDataByName !== 'function') {
        p.getSpellDataByName = function(nome) {
            const flatDb = window.getSpellDatabaseFlat ? window.getSpellDatabaseFlat() : [];
            return flatDb.find(sp => sp.nome === nome);
        };
    }
}

window.consumaIncantesimoNominato = function(idx, nomeIncantesimo) {
    const p = party[idx];
    if (!p) return;
    assegnaMetodiMagiaSeMancanti(p);
    const spell = (typeof p.getSpellDataByName === 'function') ? p.getSpellDataByName(nomeIncantesimo) : null;
    if (!spell) return;
    p._nextCastIsCura = (spell.categoria === 'cura');
    p._nextCastSpellName = spell.nome;
    const result = p.castSpell(spell.livello);
    p._nextCastIsCura = false;
    if (!result.success) { alert(result.message); return; }
    let esitoExtra = '';
    const eff = spell.effetto || {};
    if (eff.danno) {
        const danno = (typeof rollDiceNotation === 'function') ? rollDiceNotation(eff.danno) : 0;
        esitoExtra = ` Effetto: ${danno} danni da ${eff.dannoTipo || ''} (da applicare manualmente al bersaglio).`;
    } else if (eff.tipo === 'buff_resistenza') {
        esitoExtra = ` Effetto: resistenza a danni contundenti/perforanti/taglienti fino alla fine del prossimo turno.`;
    }
    mostraNotificaInAlto(`${p.nome} lancia "${spell.nome}". ${result.message}${esitoExtra}`, 'successo');
    if (document.getElementById('modal-consuma-incantesimi')?.style.display === 'block') {
        window.renderConsumaIncantesimiModal(idx);
    }
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
};

window.renderConsumaIncantesimiModal = function(idx) {
    const p = party[idx];
    const container = document.getElementById('consuma-incantesimi-content');
    if (!container || !p) return;
    assegnaMetodiMagiaSeMancanti(p);

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
    assegnaMetodiMagiaSeMancanti(p);
    const result = p.castSpell(level);
    alert(result.message);
    if (result.success) {
        window.renderConsumaIncantesimiModal(idx);
        if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
    } else {
        window.renderConsumaIncantesimiModal(idx);
    }
};

window.useInizioCombattimento = useInizioCombattimento;
window.useRigeneraCombattimento = useRigeneraCombattimento;
window.useGuerrieroRigenera = useGuerrieroRigenera;
window.degradaInCombat = degradaInCombat;
window.ferisciInCombat = ferisciInCombat;