function chiudiSpedizione() {
    const panel = document.getElementById('side-spedizione');
    if (panel) panel.classList.remove('open');
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

async function renderSpedizioneModal() {
    const container = document.getElementById('spedizione-content');
    if (!container) return;

    const names = await loadCharacterNamesForUser();
    const personaggiInSpedizione = party.filter(p => p.inSpedizione === true);
    
    if (personaggiInSpedizione.length === 0) {
        container.innerHTML = `<p style="color:#aaa; text-align:center;">Nessun personaggio in spedizione.</p>`;
        return;
    }

    container.innerHTML = personaggiInSpedizione.map(p => {
        const idx = party.indexOf(p);
        const perkList = p.perks && p.perks.length > 0 
            ? p.perks.map(perk => typeof perk === 'string' ? perk : perk.nome).join(' • ') 
            : 'Nessuno';

        return `
            <div class="combat-card">
                <div class="combat-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <strong>${p.nome}</strong>
                    <button class="combat-retreat" onclick="ritiraPersonaggio(${idx})">RITIRA</button>
                </div>
                <div style="margin:10px 0; font-size:0.9rem;">
                    <div>❤️ PF Reali: ${p.puntiFeritaReali} / ${p.puntiFeritaRealiMax}</div>
                    ${typeof getBarra === 'function' ? getBarra(p.puntiFeritaReali, p.puntiFeritaRealiMax, '#c0392b') : ''}
                    <div>✨ PF Fortuna: ${p.puntiFortuna} / ${p.puntiFortunaMax}</div>
                    ${typeof getBarra === 'function' ? getBarra(p.puntiFortuna, p.puntiFortunaMax, '#f1c40f') : ''}
                    <div style="margin-top:8px; font-size:0.85rem; color:#aaa;">Vittorie comb.: ${p.vittorieCombattimento || 0}</div>
                    <div style="margin-top:8px; font-size:0.85rem; color:#ddd;">
                        <strong>PCA:</strong> 
                        ${Object.entries(p.pca || {}).filter(([, v]) => v > 0).map(([cat, val]) => `${cat.split(' ')[0]} ${val.toFixed(1)}`).join(' • ') || 'Nessuno'}
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
                        if (p.hasPerk && p.hasPerk('Stress fisico') && p.faticaTotale > 0) {
                         extras += `<button style="background:#8e44ad;" onclick="useStressFisico(${idx})">⚡ Stress Fisico (-1 PF / -2 Fatica)</button>`;
                            }
                        if (typeof hasPerk === 'function' && hasPerk(p, 'Nato per combattere')) {
                            extras += `<button onclick="useInizioCombattimento(${idx})">Rigenera inizio</button>`;
                        }
                        if (typeof hasPerk === 'function' && hasPerk(p, 'Guerriero')) {
                            extras += `<button onclick="useGuerrieroRigenera(${idx})">Rigenera Guerriero</button>`;
                        }
                        if (p.perks && p.perks.some(pp => pp.nome === "Fino all'ultimo")) {
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

function rollZainoTrovato() {
    // Es: 15% di probabilità di trovare uno zaino esplorando
    if (Math.random() > 0.15) return null; 

    const roll = Math.floor(Math.random() * 100) + 1;
    if (roll <= 30) return { nome: 'Borsetta', bonus: 1, pesoUnEquipped: 0.1, grado: 1 };
    if (roll <= 56) return { nome: 'Tracolla', bonus: 2, pesoUnEquipped: 0.2, grado: 2 };
    if (roll <= 76) return { nome: 'Zaino Piccolo', bonus: 3, pesoUnEquipped: 0.3, grado: 3 };
    if (roll <= 90) return { nome: 'Zaino da Studente', bonus: 6, pesoUnEquipped: 0.4, grado: 4 };
    if (roll <= 98) return { nome: 'Zaino Capiente', bonus: 9, pesoUnEquipped: 0.5, grado: 5 };
    return { nome: 'Zaino da Esploratore', bonus: 12, pesoUnEquipped: 0.6, grado: 6 };
}

function assegnaLootSpedizione(p, lootGenerato) {
    p.initInventarioBase();
    
    // Controlla se trova zaini
    let nuovoZaino = rollZainoTrovato();
    if (nuovoZaino) {
        // Auto-equipaggia se è migliore
        if (!p.zainoEquipaggiato || nuovoZaino.bonus > p.zainoEquipaggiato.bonus) {
            if (p.zainoEquipaggiato) {
                // Il vecchio zaino finisce nell'inventario
                p.inventario.zaini.push(p.zainoEquipaggiato);
            }
            p.zainoEquipaggiato = nuovoZaino;
            if (typeof mostraNotificaInAlto === 'function') {
                mostraNotificaInAlto(`${p.nome} ha trovato e indossato: ${nuovoZaino.nome}!`);
            }
        } else {
            // Se ha uno zaino migliore, lo tiene in inventario
            p.inventario.zaini.push(nuovoZaino);
        }
    }
    const spazioDisponibile = p.capacitaMax - p.pesoAttuale;
    
    if (spazioDisponibile < lootGenerato.pesoStimato) {
        // Qui la UI dovrà fermarsi e chiedere al giocatore cosa scartare
        alert(`${p.nome} è troppo carico! Non può trasportare tutto alla base (Max: ${p.capacitaMax}).`);
        // Aprire la tendina dell'inventario per fargli scartare oggetti
    } else {
        // Aggiungi gli oggetti all'inventario di p
    }
}

function esplora(idx) {
    const leader = party[idx];
    if (!leader) return;
    if (typeof puoIniziareAzione === 'function' && !puoIniziareAzione(leader, 'esplora')) return;
    if (typeof leader.initInventarioBase === 'function') leader.initInventarioBase();

    if (leader.pesoAttuale >= leader.capacitaMax) {
        if (!confirm(`⚠️ Attenzione! ${leader.nome} ha lo zaino già pieno. Non potrà riportare alcun oggetto. Partire lo stesso?`)) return;
    }

    // 1. SCELTA MODALITÀ (Solo o Gruppo)
    let gruppoSpedizione = [leader];
    const modRisposta = prompt(`Vuoi che ${leader.nome} esplori da solo o insieme ad altri?\nScrivi "SOLO" o "INSIEME"`, "SOLO");
    
    if (modRisposta && modRisposta.toUpperCase() === "INSIEME") {
        const disponibili = party.filter(p => p !== leader && (!p.azioneCorrente || p.azioneCorrente.tipo === 'nessuna'));
        if (disponibili.length === 0) {
            alert("Non ci sono altri personaggi disponibili per esplorare in questo momento.");
        } else {
            let candidatiNomi = disponibili.map((p, i) => `${i}: ${p.nome}`).join('\n');
            let scelti = prompt(`Chi vuoi invitare? (Massimo 2, inserisci i numeri separati da virgola)\n${candidatiNomi}`);
            
            if (scelti) {
                let indiciScelti = scelti.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n >= 0 && n < disponibili.length);
                indiciScelti = indiciScelti.slice(0, 2); // Massimo 2 compagni
                
                indiciScelti.forEach(i => {
                    const compagno = disponibili[i];
                    // Simulazione dell'invito (Se fosse multiplayer, qui andrebbe una chiamata al server)
                    if (confirm(`MESSAGGIO PER ${compagno.nome}:\n${leader.nome} ti invita in esplorazione. Accetti? (Hai 2 minuti, premere OK = Accetta, Annulla = Rifiuta)`)) {
                        if (typeof compagno.initInventarioBase === 'function') compagno.initInventarioBase();
                        gruppoSpedizione.push(compagno);
                    }
                });
            }
        }
    }

    // 2. SCELTA PERICOLOSITÀ
    const livelliPericolo = [
        { nome: 'Sicura', bonus: 0, oreBase: 3, mult: 1 },
        { nome: 'Impegnativa', bonus: 1, oreBase: 5, mult: 2 },
        { nome: 'Pericolosa', bonus: 2, oreBase: 7, mult: 3 },
        { nome: 'Estremamente Rischiosa', bonus: 3, oreBase: 9, mult: 4 }
    ];
    
    let sceltaPericoloStr = prompt(`Scegli il livello di pericolosità (scrivi il numero):\n0: Sicura (+0 tiri, 3H)\n1: Impegnativa (+1 tiri, 5H)\n2: Pericolosa (+2 tiri, 7H)\n3: Estremamente Rischiosa (+3 tiri, 9H)`, "0");
    let pericoloIdx = parseInt(sceltaPericoloStr);
    if (isNaN(pericoloIdx) || pericoloIdx < 0 || pericoloIdx > 3) pericoloIdx = 0;
    
    const pericolo = livelliPericolo[pericoloIdx];
    const numCompagni = gruppoSpedizione.length - 1;

    // 3. CALCOLO MALUS TEMPO PER OGNI MEMBRO E MEDIA GLOBALE
    let totaleAumentoTempo = 0;

    gruppoSpedizione.forEach(p => {
        let { timePenalty } = calcolaEventiPericolo(p, pericolo.mult, numCompagni);
        
        // Aggiunta Pessimo Orientamento
        if (p.hasPerk && p.hasPerk('Pessimo orientamento')) {
            if (Math.floor(Math.random() * 100) + 1 <= 70) {
                timePenalty += 100; // Raddoppia il suo contributo al tempo (100% in più)
                alert(`🧭 ${p.nome} ha Pessimo Orientamento e ha perso l'orientamento!`);
            }
        }
        totaleAumentoTempo += timePenalty;
    });

    const mediaAumentoTempo = totaleAumentoTempo / gruppoSpedizione.length;
    let oreSpedizione = Math.round(pericolo.oreBase * (1 + (mediaAumentoTempo / 100)));

    alert(`Il gruppo parte per un'esplorazione ${pericolo.nome}.\nDurata prevista: ${oreSpedizione} ore (Modifica media tempo: +${mediaAumentoTempo.toFixed(1)}%)`);

    // 4. ASSEGNAZIONE AZIONE AL GRUPPO
    const idSpedizioneGlobale = Date.now(); // ID univoco per unire il gruppo
    
    gruppoSpedizione.forEach(p => {
        const nuovaAzione = {
            tipo: 'esplora',
            idSpedizione: idSpedizioneGlobale,
            pericoloMultiplo: pericolo.mult,
            pericoloBonus: pericolo.bonus,
            numCompagni: numCompagni,
            oreTotali: oreSpedizione,
            oreRimanenti: oreSpedizione,
            isLeader: p === leader,
            membri: gruppoSpedizione.map(m => m.nome), // Nomi per il log
            onComplete: () => terminaEsplorazione(p)
        };
        p.azioneCorrente = nuovaAzione;
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
    // Se è da solo e ha il perk, ottiene un -10% piatto alle probabilità di pericolo
    if (numCompagni === 0 && p.hasPerk && p.hasPerk('Solitario')) {
        buffRed += 0.10; 
    }

    // Aumenti Malus
    let faticaMalus = (p.faticaTotale || 0) * 15;
    let hpMalus = (p.puntiFeritaReali < 4) ? 10 : 0;

    // Helper per calcolare la percentuale finale di un evento
    const calcProb = (baseProb) => {
        let prob = baseProb * mult;
        prob = prob * (1 - modRiduzione); // Applica riduzione compagni
        prob -= (buffRed * 100);          // Applica riduzione buff/perk
        prob += faticaMalus + hpMalus;    // Applica malus
        return Math.max(0, prob);         // Non meno di 0%
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

function terminaEsplorazione(p) {
    if (!p) return;
    
    // Recupera i dati dell'azione appena conclusa
    const act = p.azioneCorrente || {};
    const bonus = act.pericoloBonus !== undefined ? act.pericoloBonus : getExplorationBonus(p);
    const mult = act.pericoloMultiplo || 1;
    const numCompagni = act.numCompagni || 0;

    if (numCompagni === 0 && p.hasPerk && p.hasPerk('Solitario')) {
        bonus += 1;
    }

    // Ricalcola i danni specifici per questo giocatore a fine spedizione
    const pericoli = calcolaEventiPericolo(p, mult, numCompagni);

    const skill = p.getSkillModifierForCheck ? p.getSkillModifierForCheck('Sopravvivenza') : { modifier: 0, advantage: false, disadvantage: false };

    // Tiri Loot
    const mediciTiro = Math.min(20, rollD20WithAdv(skill.advantage, skill.disadvantage) + bonus);
    const ingranaggiTiro = Math.min(20, rollD20WithAdv(skill.advantage, skill.disadvantage) + bonus);
    const alchemiciTiro = Math.min(20, rollD20WithAdv(skill.advantage, skill.disadvantage) + bonus);
    const ciboTiro = Math.min(20, rollD20WithAdv(skill.advantage, skill.disadvantage) + bonus);
    const acquaTiro = Math.min(20, rollD20WithAdv(skill.advantage, skill.disadvantage) + bonus) * 1.25;

    // Generazione base
    let medici = lootMedici(mediciTiro);
    let ingranaggi = lootIngranaggi(ingranaggiTiro);
    let alchemici = lootAlchemici(alchemiciTiro);
    let cibo = lootCiboAcqua(ciboTiro);
    let acqua = lootCiboAcqua(acquaTiro);
    let deliziosi = lootPiattiDeliziosi(ciboTiro);
    let oggMagiciTrovati = lootOggettiMagici();
    
    const booksTiro = Math.min(20, (typeof rollD20 === 'function' ? rollD20() : Math.floor(Math.random()*20)+1) + bonus);
    let booksFound = lootBooks(booksTiro);

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
    }

    // --- APPLICAZIONE DANNI FISICI ---
    if (pericoli.hpDamage > 0) {
        p.puntiFeritaReali -= pericoli.hpDamage;
    }
    if (pericoli.fatigueStagies > 0 && typeof p.faticaBase !== 'undefined') {
        p.faticaBase += pericoli.fatigueStagies;
    }

    // Assegnazione risorse al magazzino (O all'inventario di P se vuoi usare il nuovo sistema zaini)
    magazzino.materialiAlchemici += alchemici;
    magazzino.ingranaggi += ingranaggi;
    magazzino.materialiMedici.base += medici.base;
    magazzino.materialiMedici.avanzati += medici.avanzati;
    magazzino.materialiMedici.critici += medici.critici;
    magazzino.cibo += cibo;
    magazzino.acqua += acqua;
    magazzino.piattiDeliziosi += deliziosi;
    
    magazzino.oggettiMagici.comuni += oggMagiciTrovati.comuni;
    magazzino.oggettiMagici.nonComuni += oggMagiciTrovati.nonComuni;
    magazzino.oggettiMagici.rari += oggMagiciTrovati.rari;
    magazzino.oggettiMagici.superRari += oggMagiciTrovati.superRari;

    let infoMagica = "";
    if (oggMagiciTrovati.comuni > 0)     infoMagica += `• Oggetti Magici Comuni: +${oggMagiciTrovati.comuni}\n`;
    if (oggMagiciTrovati.nonComuni > 0)  infoMagica += `• Oggetti Magici Non Comuni: +${oggMagiciTrovati.nonComuni}\n`;
    if (oggMagiciTrovati.rari > 0)       infoMagica += `• Oggetti Magici Rari: +${oggMagiciTrovati.rari}\n`;
    if (oggMagiciTrovati.superRari > 0)  infoMagica += `• 🌟 Oggetti Magici SUPER RARI: +${oggMagiciTrovati.superRari}\n`;

    // Stringa Malus
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
        infoMagica + "\n" +
        (infoMalus ? `\n--- EVENTI AVVERSI ---\n${infoMalus}` : "Nessun evento avverso!")
    );
        
    p.azioneCorrente = null; // Libera il personaggio
    aggiornaInterfaccia();
}

window.mandaTuttiInSpedizione = mandaTuttiInSpedizione;
window.chiudiSpedizione = chiudiSpedizione;
window.ritiraTutti = ritiraTutti;