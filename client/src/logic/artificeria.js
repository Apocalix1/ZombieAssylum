import {aggiornaInterfaccia} from "../ui/ui.js";

export const ARTIFICER_RECIPES = [
    // === ENERGIA & BATTERIE ===
    {
        id: 'batterie_creazione',
        name: 'Creazione Batterie',
        category: 'Energia & Batterie',
        difficulty: 'Facile',
        outputType: 'fabbisogno_magico', 
        description: 'Assorbi energia residua da oggetti magici o dispositivi arcani per creare batterie. (Costo per 5 batterie).',
        cost: { ingranaggi: 2 },
        time: { hours: 1 },
        specialization: { Elettronica: 1 }
    },
    {
        id: 'estrazione_energia_robot',
        name: 'Estrazione Energia dai Robot',
        category: 'Energia & Batterie',
        difficulty: 'Molto difficile',
        outputType: 'fabbisogno_robot',
        description: 'Estrai energia dalla batteria arcana di un robot. 1 ora = 1 batteria. Ogni 3 batterie 1 si perde.',
        cost: { ingranaggi: 2 }, // Per batteria (da moltiplicare eventualmente in logica o lasciarlo base per 1)
        time: { hours: 0.16 }, // 10 minuti per batteria
        specialization: { Elettronica: 4, Meccanica: 5 }
    },

    // === COMUNICAZIONE, SENSORI & SORVEGLIANZA ===
    {
        id: 'orologio_timer',
        name: 'Orologio / Timer',
        category: 'Comunicazione, Sensori & Sorveglianza',
        difficulty: 'Facile',
        outputType: 'conteggio',
        description: 'Impostabile come sveglia, timer o segnalatore temporizzato.',
        cost: { ingranaggi: 5 },
        time: { hours: 1 },
        specialization: { Elettronica: 1 }
    },
    {
        id: 'sistema_telecamere',
        name: 'Sistema di Telecamere',
        category: 'Comunicazione, Sensori & Sorveglianza',
        difficulty: 'Molto difficile',
        outputType: 'fisso_base',
        richiedeInput: 'telecamere', 
        description: 'Stazione centrale (60ing/12h) + fino a 4 telecamere (20ing/8h cad). Visione 18m, segnale 36m. Consumo: 1 batt/3h.',
        cost: { ingranaggi_base: 60 }, // Modificato a runtime da richiedeInput
        time: { hours: 12 },
        specialization: { Elettronica: 5, Meccanica: 2 }
    },
    {
    id: 'dinamo',
    name: 'Dinamo',
    category: 'Sopravvivenza & Conservazione',
    difficulty: 'Media',
    outputType: 'fisso_base',
    description: 'Stazione che converte l\'allenamento fisico in energia. Durante l\'Allenamento si può scegliere di generare batterie invece di guadagnare PCA.',
    cost: { ingranaggi: 40 },
    time: { hours: 5 },
    specialization: { Elettronica: 3, Meccanica: 1 }
    },
    {
        id: 'ripetitore_segnale',
        name: 'Ripetitore di Segnale',
        category: 'Comunicazione, Sensori & Sorveglianza',
        difficulty: 'Molto difficile',
        outputType: 'equipaggiamento',
        richiedeInput: 'variante_ripetitore', // Da gestire nel prompt (Piccolo, Medio, Grande, Antenna)
        description: 'Ripete il segnale. Piccolo(18m), Medio(36m), Grande(72m), Antenna(124m).',
        cost: { ingranaggi_base: 20 }, // Base per Piccolo, dinamico via JS
        time: { hours: 5 },
        specialization: { Elettronica: 5, Meccanica: 3 }
    },
    {
        id: 'intercettatore_pietre',
        name: 'Intercettatore di Pietre',
        category: 'Comunicazione, Sensori & Sorveglianza',
        difficulty: 'Molto difficile',
        outputType: 'fisso_base',
        description: 'Intercetta comunicazioni nel raggio di 1 km. Consumo: 2 batterie/ora.',
        cost: { ingranaggi: 60 },
        time: { hours: 12 },
        specialization: { Elettronica: 4 }
    },
    {
        id: 'localizzatore',
        name: 'Localizzatore',
        category: 'Comunicazione, Sensori & Sorveglianza',
        difficulty: 'Difficile',
        outputType: 'equipaggiamento',
        description: 'Coppia: trasmettitore + ricevitore. \n Trasmettitore: un piccolo aggeggio adattabile a superfici o creature. \n Ricevitore: un oggetto quadrato che emette suono in base alla vicinanza del bersaglio, suono disattivabile.\n Il ricevitore emette suono quando il trasmettitore è nel raggio di 80 metri diventando sempre più forte finché non smette a due metri di vicinanza.Quando il trasmettitore è tra i 80-800 metri invece chi ha il ricevitore in mano può usare un’azione bonus per concentrarsi e percepire la direzione del trasmettitore.',
        cost: { ingranaggi: 35 },
        time: { hours: 6 },
        specialization: { Elettronica: 3 }
    },

    // === ILLUMINAZIONE & OTTICA ===
    {
        id: 'torcia_direzionale',
        name: 'Torcia Direzionale',
        category: 'Illuminazione & Ottica',
        difficulty: 'Facile',
        outputType: 'equipaggiamento',
        description: 'Illumina una linea retta fino a 18m. Consumo 1 batteria/3 ore.',
        cost: { ingranaggi: 10 },
        time: { hours: 2 },
        specialization: { Elettronica: 1 }
    },
    {
        id: 'binocolo',
        name: 'Binocolo',
        category: 'Illuminazione & Ottica',
        difficulty: 'Facile',
        outputType: 'equipaggiamento',
        description: 'Ingrandimento visivo x5.',
        cost: { ingranaggi: 10 },
        time: { hours: 1 },
        specialization: { Balistica: 1 }
    },

    // === SUONO & AMPLIFICAZIONE ===
    {
        id: 'cassa_amplificata',
        name: 'Cassa Amplificata',
        category: 'Suono & Amplificazione',
        difficulty: 'Facile',
        outputType: 'conteggio',
        description: 'Amplifica il suono x3. Include microfono e cavo 3m.',
        cost: { ingranaggi: 15 },
        time: { hours: 2 },
        specialization: { Elettronica: 1 }
    },

    // === AUTOMAZIONE & CONTROLLO ===
    {
        id: 'innesco',
        name: 'Innesco',
        category: 'Automazione & Controllo',
        difficulty: 'Facile',
        outputType: 'conteggio',
        description: 'Base per attivazione automatica (trappole, meccanismi, circuiti).',
        cost: { ingranaggi: 5 }, // Ho impostato 5 come base logica se non specificato
        time: { hours: 1 },
        specialization: { Meccanica: 2 } // Fallback a Meccanica 2 (o Elettronica)
    },
    {
        id: 'serratura_codice',
        name: 'Serratura con Codice',
        category: 'Automazione & Controllo',
        difficulty: 'Media',
        outputType: 'fisso_base',
        description: 'Serratura elettronica con codice statico.',
        cost: { ingranaggi: 25 },
        time: { hours: 6 },
        specialization: { Meccanica: 3 }
    },

    // === DIFESA & TRAPPOLE ===
    {
        id: 'trappola_scatto',
        name: 'Trappola a Scatto',
        category: 'Difesa & Trappole',
        difficulty: 'Difficile',
        outputType: 'fisso_base',
        description: 'Danni 3d10. Area 2x2. Disinnesco CD14 Artificeria.',
        cost: { ingranaggi: 60 },
        time: { hours: 8 },
        specialization: { Meccanica: 3 }
    },
    {
        id: 'trappola_orsi',
        name: 'Trappola per orsi',
        category: 'Difesa & Trappole',
        difficulty: 'Facile',
        outputType: 'equipaggiamento',
        description: 'Se calpestata infligge 2d6 e immobilizza. Disinnesco CD14. Nascondibile.',
        cost: { ingranaggi: 20 },
        time: { hours: 2 },
        specialization: { Meccanica: 1 }
    },

    // === BALISTICA, ARMI & MUNIZIONI ===
    {
        id: 'creazione_proiettili',
        name: 'Creazione Proiettili',
        category: 'Balistica, Armi & Munizioni',
        difficulty: 'Facile',
        outputType: 'equipaggiamento',
        richiedeInput: 'tipo_proiettili', // Frecce, Dardi, Pistola (10 pezzi)
        description: 'Crea 10 munizioni. Frecce(1ing/20m), Dardi(3ing/30m), Pistola(10ing/1h).',
        cost: { ingranaggi_base: 1 }, // Gestito dinamicamente via prompt
        time: { hours: 0.33 },
        specialization: { Balistica: 1 }
    },
    {
        id: 'taser',
        name: 'Taser',
        category: 'Balistica, Armi & Munizioni',
        difficulty: 'Media',
        outputType: 'equipaggiamento',
        description: 'Corpo a corpo elettrico. TS COS CD14 o paralizzato 1 turno. Consumo: 1 batt/colpo.',
        cost: { ingranaggi: 15 },
        time: { hours: 2 },
        specialization: { Balistica: 2 }
    },
    {
        id: 'proiettile_frammentazione',
        name: 'Proiettile a Frammentazione',
        category: 'Balistica, Armi & Munizioni',
        difficulty: 'Media',
        outputType: 'equipaggiamento',
        description: 'Colpisce: +1d10 danni. Manca: esplosione 1m (1d4 danni).',
        cost: { ingranaggi: 5 }, // Rappresentazione base, aggiungi regole dinamiche se serve
        time: { hours: 1 },
        specialization: { Balistica: 3 }
    },
    {
        id: 'pistola_rampino',
        name: 'Pistola Rampino',
        category: 'Balistica, Armi & Munizioni',
        difficulty: 'Media',
        outputType: 'equipaggiamento',
        description: 'Raggio 9m. Vantaggio acrobazia, aggancia oggetti. Attacco 1d4+DES.',
        cost: { ingranaggi: 30 },
        time: { hours: 4 },
        specialization: { Balistica: 3 }
    },
    {
        id: 'potenziamento_arma',
        name: 'Potenziamento Armi',
        category: 'Balistica, Armi & Munizioni',
        difficulty: 'Media',
        outputType: 'potenziamento_arma',
        description: 'Bonus permanente +1 (Max +3). Costa 30 ingranaggi e 4h per ogni +1.',
        cost: { ingranaggi: 30 },
        time: { hours: 4 },
        specialization: { Balistica: 3 }
    },

    // === ROBOT & MECCANICA AVANZATA ===
    {
        id: 'riparazione_robot',
        name: 'Riparazione Robot',
        category: 'Robot & Meccanica Avanzata',
        difficulty: 'Facile',
        outputType: 'fabbisogno_robot',
        description: 'Riparazione completa del robot.',
        cost: { ingranaggi: 15 },
        time: { hours: 2 },
        specialization: { Meccanica: 1 }
    },
    {
        id: 'potenzia_robot',
        name: 'Potenziare / Depotenziare Robot',
        category: 'Robot & Meccanica Avanzata',
        difficulty: 'Difficile',
        outputType: 'fabbisogno_robot',
        description: 'Aggiunta perk: 15ing+1h/punto. Rimozione perk positivo: 10ing+0.5h/punto.',
        cost: { ingranaggi_base: 15 }, 
        time: { hours: 1 },
        specialization: { Meccanica: 5 }
    },
    {
        id: 'smantellamento_robot',
        name: 'Smantellamento Totale Robot',
        category: 'Robot & Meccanica Avanzata',
        difficulty: 'Molto difficile',
        outputType: 'fabbisogno_robot',
        description: 'Robot distrutto definitivamente. Ricompensa: 3d12 + 45 ingranaggi.',
        cost: { ingranaggi: 0 },
        time: { hours: 4 }, // Tempo indicativo per smantellare un robot grande
        specialization: { Meccanica: 5 } // La funzione logica controlla anche Elettronica 4 se richiesto
    },

    // === MOBILITÀ & MOVIMENTO ===
    {
        id: 'stivali_molla',
        name: 'Stivali a Molla',
        category: 'Mobilità & Movimento',
        difficulty: 'Media',
        outputType: 'equipaggiamento',
        description: 'Salti +3 metri. 1 salto = 3 cariche. (1 batteria = 3 cariche).',
        cost: { ingranaggi: 25 },
        time: { hours: 4 },
        specialization: { Meccanica: 2 }
    },

    // === SOPRAVVIVENZA & CONSERVAZIONE ===
    {
        id: 'frigorifero',
        name: 'Frigorifero',
        category: 'Sopravvivenza & Conservazione',
        difficulty: 'Molto difficile',
        outputType: 'fisso_base',
        description: 'Capacità 50 razioni. Aumenta tempo degrado cibo del +500%. Consuma 2 batt/giorno.',
        cost: { ingranaggi: 80 },
        time: { hours: 16 },
        specialization: { Elettronica: 4 }
    },
    {
    id: 'stazione_ricarica',
    name: 'Stazione di Ricarica',
    category: 'Sopravvivenza & Conservazione',
    difficulty: 'Difficile',
    outputType: 'fisso_base',
    description: "Piattaforma per ricaricare robot. Contiene fino a 30 batterie; un robot che vi resta sopra recupera 5h di batteria/ora consumando 5 batterie/ora, e non si scarica nel frattempo. Un solo robot alla volta, nessun'altra azione possibile mentre ricarica.",
    cost: { ingranaggi: 20 },
    time: { hours: 6 },
    specialization: { Meccanica: 3 }
},
    {
        id: 'postazione_alchimista',
        name: 'Postazione da Alchimista',
        category: 'Sopravvivenza & Conservazione',
        difficulty: 'Facile',
        outputType: 'fisso_base', // Essendo una postazione, è perfetta come elemento fisso per la base
        description: 'Creazione di una postazione per preparazioni alchemiche avanzate.',
        cost: { ingranaggi: 10 },
        time: { hours: 1 },
        specialization: { AG: 1 } // Artificeria Generale
    },
    {
        id: 'proiettili_gomma',
        name: 'Proiettili di Gomma (Allenamento)',
        category: 'Sopravvivenza & Conservazione',
        difficulty: 'Facile',
        outputType: 'munizioni',
        description: 'Munizioni non letali per allenamento a distanza. Si degradano dopo 3 ore di pratica.',
        cost: { ingranaggi: 10 },
        time: { hours: 1 },
        specialization: { Balistica: 2 }
    }
];


// --- FUNZIONI DI PROGRESSIONE ---
function aggiungiPuntiArtificeria(p, specRichieste, puntiPS, isLeader, numAssistenti = 0) {
    initArtificeria(p);

    let psOttenuti = 0;
    if (isLeader) {
        psOttenuti = puntiPS;
    } else if (numAssistenti > 0) {
        psOttenuti = Math.ceil((puntiPS / 2) / numAssistenti);
        if (psOttenuti < 1) psOttenuti = 1;
    }

    // --- APPRENDISTATO ECCEZIONALE: se è assistente, raddoppia PS e PAG ---
    if (!isLeader && p.hasPerk && p.hasPerk('Apprendistato eccezionale')) {
        psOttenuti = psOttenuti * 2;
    }

    // Assegna PS
    const specPrincipale = Object.keys(specRichieste)[0];
    if (specPrincipale && p.artificeria.specializzazioni[specPrincipale]) {
        p.artificeria.specializzazioni[specPrincipale].ps += psOttenuti;
        // Level Up
        let lvlSpec = p.artificeria.specializzazioni[specPrincipale].livello;
        while (lvlSpec < 5 && p.artificeria.specializzazioni[specPrincipale].ps >= SOGLIE_SPEC[lvlSpec + 1]) {
            p.artificeria.specializzazioni[specPrincipale].livello++;
            lvlSpec++;
            alert(`🎉 ${p.nome} ha raggiunto il Livello ${lvlSpec} in ${specPrincipale}!`);
        }
    }

    // PAG (0.25 per PS) – anche qui il raddoppio è già incluso in psOttenuti
    const pagOttenuti = psOttenuti * 0.15;
    p.artificeria.generale.pag += pagOttenuti;

    // Level Up AG
    let lvlAG = p.artificeria.generale.livello;
    while (lvlAG < 5 && p.artificeria.generale.pag >= SOGLIE_AG[lvlAG + 1]) {
        p.artificeria.generale.livello++;
        lvlAG++;
        alert(`🛠️ ${p.nome} ha raggiunto il Livello ${lvlAG} in Artificeria Generale!`);
    }
}

// --- LOGICA DI CRAFTING E SMONTAGGIO ---
function calcolaCrafting(leader, collaboratori, ricetta, isSmontaggio = false) {
    initArtificeria(leader);
    const diff = DIFFICOLTA_CRAFTING[ricetta.difficulty] || DIFFICOLTA_CRAFTING['Media'];
    const specPrincipale = Object.keys(ricetta.specialization)[0];
    const lvAG_Leader = leader.artificeria.generale.livello;
    const lvSpec_Leader = leader.artificeria.specializzazioni[specPrincipale].livello;
    
    // Controlla se possiede la competenza (livello spec leader >= livello richiesto)
    const reqSpec = ricetta.specialization[specPrincipale];
    const senzaCompetenza = lvSpec_Leader < reqSpec;

    // 1. CALCOLO DELLA CLASSE DIFFICOLTÀ (CD)
    let cdFinale;
    if (senzaCompetenza) {
        cdFinale = diff.cdBase + 6 - (lvAG_Leader * 1) - (lvSpec_Leader * 2);
    } else {
        cdFinale = diff.cdBase - lvAG_Leader - (lvSpec_Leader * 2);
    }
    collaboratori.forEach(collab => {
        if (leader.rancoreTargetId === collab.id || collab.rancoreTargetId === leader.id) {
            cdFinale += 4;
        }
    });

    // 2. CALCOLO DEL TEMPO
    // Estrapoliamo le ore base dalla ricetta (assumiamo 1 ora se non specificato chiaramente, dovrai mappare bene l'oggetto time)
    let oreBase = ricetta.time.hours || (ricetta.time.perFiveBatteries_hours) || (ricetta.time.time_minutes ? ricetta.time.time_minutes/60 : 1);
    const materiaSpec = Object.keys(ricetta.specialization)[0]; // Balistica/Meccanica/Elettronica
    oreBase *= leader.getModificatoreTempoAzione('artificeria', 'Artificeria');
    if (isSmontaggio) {
        oreBase = oreBase / 2; // Smontare impiega metà tempo
    } else {
        // Riduzione tempo da Artificeria Generale del Leader
        oreBase = oreBase * (1 - BONUS_AG_TEMPO[lvAG_Leader]);

        // Riduzione tempo da Collaboratori
        let moltiplicatoreFolla = 1; // 1 per il primo collaboratore, 0.5 per gli altri
        collaboratori.forEach((collab) => {
            initArtificeria(collab);
            const lvSpec_Collab = collab.artificeria.specializzazioni[specPrincipale].livello;
            
            // Requisito minimo: il collaboratore deve avere almeno livello 1
            if (lvSpec_Collab >= 1) {
                // Formula: (LS Collab / LS Leader) * 50% * malus folla
                let percentualeRiduzione = (lvSpec_Collab / Math.max(1, lvSpec_Leader)) * 0.50 * moltiplicatoreFolla;
                oreBase = oreBase * (1 - percentualeRiduzione);
                moltiplicatoreFolla = 0.5; // I successivi valgono la metà
            }
        });
    }

    return { cdFinale, oreStimate: oreBase.toFixed(1), senzaCompetenza, diffBase: diff };
}

function getRecipeBaseCost(ricetta) {
    return ricetta.cost.ingranaggi || ricetta.cost.ingranaggi_base || 0;
}

function risolviAzioneArtificeria(leaderIdx, collaboratoriIdxs, ricettaId, isSmontaggio = false) {
    const leader = window.party[leaderIdx];
    const ricettaBase = getArtificerRecipeById(ricettaId);
    if (!leader || !ricettaBase) return;

    // Potenzia/Depotenzia Robot: flusso immediato dedicato, non passa dalla coda azioni
    if (ricettaId === 'potenzia_robot' && !isSmontaggio) {
        apriPotenziaRobotModal(leaderIdx);
        return;
    }
    // Smantellamento Robot: richiede consenso (o cadavere già disponibile)
    if (ricettaId === 'smantellamento_robot' && !isSmontaggio) {
        avviaSmantellamentoRobot(leader);
        return;
    }
    // Riparazione Robot: chiede subito il bersaglio, poi prosegue nel flusso normale
    let robotTargetId = null;
    if (ricettaId === 'riparazione_robot' && !isSmontaggio) {
        const robots = window.party.filter(p => p.isRobot);
        if (!robots.length) { alert('Nessun robot nel party da riparare.'); return; }
        let target = robots[0];
        if (robots.length > 1) {
            const lista = robots.map((r, i) => `${i}: ${r.nome} (${r.robotPF}/${r.robotPFMax} PF)`).join('\n');
            const scelta = parseInt(prompt(`Quale robot vuoi riparare?\n${lista}`, '0'));
            target = robots[scelta];
            if (!target) return;
        }
        robotTargetId = target.id;
    }
    // Estrazione Energia dai Robot: chiede robot sorgente + quantità batterie desiderate
    if (ricettaId === 'estrazione_energia_robot' && !isSmontaggio) {
        const robots = window.party.filter(p => p.isRobot);
        if (!robots.length) { alert('Nessun robot nel party.'); return; }
        let sorgente = robots[0];
        if (robots.length > 1) {
            const lista = robots.map((r, i) => `${i}: ${r.nome} (${r.batteryHours.toFixed(1)}h batteria)`).join('\n');
            const scelta = parseInt(prompt(`Da quale robot vuoi estrarre energia?\n${lista}`, '0'));
            sorgente = robots[scelta];
            if (!sorgente) return;
        }
        const maxOre = Math.floor(sorgente.batteryHours);
        if (maxOre <= 0) { alert(`${sorgente.nome} non ha batteria sufficiente.`); return; }
        const qtaStr = prompt(`Quante batterie vuoi estrarre? (1 ora di batteria del robot = 1 batteria estratta, max ${maxOre})`, Math.min(5, maxOre).toString());
        const qta = parseInt(qtaStr);
        if (isNaN(qta) || qta <= 0 || qta > maxOre) return;
        if (window.magazzino.ingranaggi < qta * 2) { alert(`Servono ${qta * 2} ingranaggi, ne hai ${window.magazzino.ingranaggi}.`); return; }
        window.magazzino.ingranaggi -= qta * 2;
        sorgente.consumeBattery(qta);
        // Crea una ricetta fittizia per l'estrazione
        const ricettaEstrazione = { ...ricettaBase, time: { hours: qta * (10/60) } };
        eseguiCreazioneArtificeria(leader, collaboratoriIdxs.map(i => window.party[i]), ricettaEstrazione, 0, false, { tipo: 'estrazione_robot', qta, sorgenteId: sorgente.id }, 0);
        salvaPersonaggioCloud(sorgente);
        return;
    }

    // Clona la ricetta per modifiche successive
    const ricetta = Object.assign({}, ricettaBase);
    if (robotTargetId) ricetta._robotTargetId = robotTargetId;

    const costoBase = getRecipeBaseCost(ricetta);
    let costoIngranaggi = costoBase;
    let dettagliExtra = "";

    if (!isSmontaggio) {
                    if (ricetta.outputType === 'fabbisogno_magico') {
            leader.initInventarioBase();
            const raritaScelta = prompt("Quale rarità di oggetto magico vuoi usare?\n(comune, non_comune, raro, super_raro)");
            const candidati = [
                ...(leader.inventario.oggettiMagiciPersonali || []).map(i => ({ ...i, luogo: 'personale' })),
                ...((window.magazzino.oggettiMagiciIstanze || [])).map(i => ({ ...i, luogo: 'base' }))
            ].filter(i => i.rarita === raritaScelta);

            if (candidati.length > 0) {
                let scelta = candidati[0];
                if (candidati.length > 1) {
                    const lista = candidati.map((c, i) => {
                        const def = window.getOggettoMagicoDef(c.defId);
                        return `${i}) ${def?.nome || c.defId} (${c.cariche}/${c.caricheMax} cariche, ${c.luogo})`;
                    }).join('\n');
                    const idx = parseInt(prompt(`Quale oggetto vuoi assorbire?\n${lista}`, '0'));
                    scelta = candidati[idx] || candidati[0];
                }
                dettagliExtra = 'instance:' + scelta.uid;
            } else {
                // Fallback legacy: nessuna istanza concreta trovata, usa i vecchi contatori generici
                const mapKey = { comune: 'comuni', non_comune: 'nonComuni', raro: 'rari', super_raro: 'superRari' };
                const key = mapKey[raritaScelta];
                const inMagazzino = key ? (window.magazzino.oggettiMagici[key] || 0) : 0;
                if (!key || inMagazzino <= 0) {
                    alert(`Non hai un oggetto magico di rarità '${raritaScelta}'!`);
                    return;
                }
                window.magazzino.oggettiMagici[key]--;
                dettagliExtra = raritaScelta;
            }
        } else if (ricetta.id === 'creazione_proiettili') {
            const tipoMunProm = prompt('Che tipo di munizioni vuoi creare? (Freccia, Dardo balestra, Proiettile pistola)', 'Freccia') || 'Freccia';
            const mappaMun = { Freccia: 'frecce', 'Dardo balestra': 'quadrelli', 'Proiettile pistola': 'proiettili' };
            const chiave = mappaMun[tipoMunProm] || 'frecce';
            leader.initInventarioBase();
            leader.inventario.munizioni[chiave] = (leader.inventario.munizioni[chiave] || 0) + 10;
            alert(`${leader.nome} ha creato +10 ${tipoMunProm} (nel proprio inventario).`);
            salvaPersonaggioCloud(leader);
            return;
        } else if (ricetta.outputType === 'fabbisogno_robot') {
            const robotId = prompt("Scrivi il nome o l'ID del robot che vuoi utilizzare per questa azione:");
            if (!robotId) return;
            dettagliExtra = `(Robot: ${robotId})`;
        } else if (ricetta.outputType === 'potenziamento_arma') {
            const armaNome = prompt("Scrivi il nome esatto dell'arma nel tuo inventario che vuoi potenziare:");
            if (!armaNome) return;
            dettagliExtra = armaNome;
        } else if (ricetta.richiedeInput === 'telecamere') {
            const numTel = parseInt(prompt("Quante telecamere vuoi costruire insieme alla stazione? (Max 4)"));
            if (isNaN(numTel) || numTel < 0 || numTel > 4) return;
            costoIngranaggi = 60 + numTel * 20;
            ricetta.time = { hours: 12 + numTel * 8 };
            dettagliExtra = `(Stazione + ${numTel} Telecamere)`;
        }
    }

    if (collaboratoriIdxs.length > 0) {
        const collaboratoriIds = collaboratoriIdxs.map(idx => window.party[idx].id).filter(Boolean);
        const groupId = `artgroup-${Date.now()}-${leader.id}`;

        window._artificeriaGruppiPendenti = window._artificeriaGruppiPendenti || {};
        window._artificeriaGruppiPendenti[groupId] = {
            leaderId: leader.id,
            collaboratoriIds: collaboratoriIds.slice(),
            accettati: new Set(),
            rifiutato: false,
            ricettaId, isSmontaggio, costoIngranaggi, dettagliExtra, costoBase
        };

        // Una proposta separata per OGNI collaboratore (fino a 3+)
        collaboratoriIds.forEach(destId => {
            window.inviaProposta(leader.id, destId, 'artificeria-gruppo', {
                groupId, ricettaId, isSmontaggio, collaboratori: collaboratoriIds
            });
        });

        mostraNotificaInAlto(`Proposte di artificeria inviate a ${collaboratoriIds.length} collaboratori. In attesa di risposta...`, 'info');
        return;
    }

    eseguiCreazioneArtificeria(leader, [], ricetta, costoIngranaggi, isSmontaggio, dettagliExtra, costoBase);
}

function eseguiCreazioneArtificeria(leader, collaboratoriIdxs, ricetta, costoIngranaggi, isSmontaggio, dettagliExtra, costoBase) {
    const collaboratori = collaboratoriIdxs.map(i => window.party[i]);
    const calcoli = calcolaCrafting(leader, collaboratori, ricetta, isSmontaggio);

    if (!isSmontaggio && window.magazzino.ingranaggi < costoIngranaggi) {
        alert(`Non hai abbastanza ingranaggi! (Richiesti: ${costoIngranaggi}, Posseduti: ${window.magazzino.ingranaggi})`);
        return;
    }

    if (isSmontaggio) {
        const specPrincipale = Object.keys(ricetta.specialization)[0];
        const reqSpec = ricetta.specialization[specPrincipale] || 0;
        const lvSpec_Leader = leader.artificeria?.specializzazioni?.[specPrincipale]?.livello || 0;
        if (lvSpec_Leader < reqSpec) {
            alert(`Non hai competenza sufficiente per smontare questo oggetto. Richiesto: ${specPrincipale} livello ${reqSpec}.`);
            return;
        }
        const lvAG = leader.artificeria?.generale?.livello || 0;
        if (lvAG === 0) {
            alert("Il tuo livello di Artificeria Generale è 0, non puoi smontare oggetti.");
            return;
        }
    } else {
        window.magazzino.ingranaggi -= costoIngranaggi;
        if (typeof window.updateMagazzinoFields === 'function') {
            window.updateMagazzinoFields({ ingranaggi: window.magazzino.ingranaggi });
        }
    }

    let oreFinali = parseFloat(calcoli.oreStimate) || 1;
    const modInt = leader.getStatDettagliata('Intelligenza').mod;
    const bonusComp = (leader.hasCompetenza('Artificeria') ? leader.getBonusCompetenza() : 0);

    // PERFEZIONISTA: tira PRIMA di iniziare, il risultato determina il tempo E viene riusato all'esito
    let rollPrecalcolato = null;
    if (leader.hasPerk && leader.hasPerk('Perfezionista')) {
        const d20 = Math.floor(Math.random() * 20) + 1;
        const totale = d20 + modInt + bonusComp;
        rollPrecalcolato = { d20, totale };
        const modTempo = leader.getPerfezionistaTimeModifier(totale);
        oreFinali = Math.max(0.5, +(oreFinali * modTempo).toFixed(1));
        mostraNotificaInAlto(
            `${leader.nome} (Perfezionista): tiro anticipato ${totale}, tempo ${modTempo < 1 ? 'ridotto' : 'aumentato'} a ${oreFinali}h.`,
            modTempo < 1 ? 'successo' : 'avviso'
        );
    }

    const azioneLeader = {
        tipo: isSmontaggio ? 'artificeria-smontaggio' : 'artificeria',
        oreTotali: oreFinali,
        oreRimanenti: oreFinali,
        ricettaNome: ricetta.name,
        onComplete: () => risolviEsitoArtificeria(leader, collaboratori, ricetta, costoIngranaggi, isSmontaggio, dettagliExtra, costoBase, calcoli, rollPrecalcolato)
    };

    const creaAzioneCollab = (collab) => ({
        tipo: 'artificeria-assistenza',
        oreTotali: oreFinali,
        oreRimanenti: oreFinali,
        ricettaNome: ricetta.name,
        onComplete: () => {
            mostraNotificaInAlto(`${collab.nome} ha finito di assistere alla creazione di "${ricetta.name}".`, 'successo');
            salvaPersonaggio(collab);
        }
    });

    const tuttiLiberi = !leader.azioneCorrente && collaboratori.every(c => !c.azioneCorrente);
    if (tuttiLiberi) {
        leader.azioneCorrente = azioneLeader;
        collaboratori.forEach(c => { c.azioneCorrente = creaAzioneCollab(c); });
        mostraNotificaInAlto(`${leader.nome}${collaboratori.length ? ' e ' + collaboratori.map(c => c.nome).join(', ') : ''} inizia${collaboratori.length ? 'no' : ''} "${ricetta.name}" (${oreFinali}h).`, 'successo');
    } else {
        leader.codaAzioni.push(azioneLeader);
        collaboratori.forEach(c => c.codaAzioni.push(creaAzioneCollab(c)));
        mostraNotificaInAlto(`"${ricetta.name}" è in coda: partirà quando tutti i partecipanti saranno liberi.`, 'info');
    }

    salvaPersonaggio(leader);
    collaboratori.forEach(c => salvaPersonaggio(c));
    window.aggiornaInterfaccia();
}

function risolviEsitoArtificeria(leader, collaboratori, ricetta, costoIngranaggi, isSmontaggio, dettagliExtra, costoBase, calcoli, rollPrecalcolato) {
    const modInt = leader.getStatDettagliata('Intelligenza').mod;
    const bonusComp = (leader.hasCompetenza('Artificeria') ? leader.getBonusCompetenza() : 0);

    let risultato;
    if (rollPrecalcolato) {
        risultato = rollPrecalcolato.totale;
    } else {
        const d20 = Math.floor(Math.random() * 20) + 1;
        risultato = d20 + modInt + bonusComp;
    }

    const cdConIrascibile = calcoli.cdFinale + leader.getIrascibileCDBonus() + leader.getPessimistaCDBonus();
    const scarto = cdConIrascibile - risultato;
    leader.registraIrascibile(scarto <= 0, scarto >= 5);
    leader.registraPessimista(scarto <= 0);

    if (scarto <= 0) {
        alert(isSmontaggio ? "✅ SMONTAGGIO RIUSCITO!" : "✅ SUCCESSO! L'oggetto è stato creato.");
        if (isSmontaggio) {
            let resaPercentuale = YIELD_SMONTAGGIO[leader.artificeria.generale.livello] || 0;
            if (leader.hasPerk && leader.hasPerk('Riciclatore disperato')) resaPercentuale += 0.20;
            const ingranaggiRecuperati = Math.floor(costoBase * resaPercentuale);
            window.magazzino.ingranaggi += ingranaggiRecuperati;
            alert(`Recuperati ${ingranaggiRecuperati} ingranaggi.`);
        } else {
            const psBase = calcoli.diffBase.psBase;
            const specializzazione = ricetta.specialization;
            aggiungiPuntiArtificeria(leader, specializzazione, psBase, true);
            const numAssistenti = collaboratori.length;
            if (numAssistenti > 0) {
                collaboratori.forEach(assistente => {
                    aggiungiPuntiArtificeria(assistente, specializzazione, psBase, false, numAssistenti);
                });
            }

            const PORTABILI_SPEDIZIONE = ['localizzatore','orologio_timer','torcia_direzionale','cassa_amplificata','innesco','trappola_orsi','taser','pistola_rampino','stivali_molla'];
                        // --- Casi specifici per ricetta ---
                        if (ricetta.id === 'batterie_creazione') {
                let battTrovate = 0;
                if (typeof dettagliExtra === 'string' && dettagliExtra.startsWith('instance:')) {
                    const uid = dettagliExtra.replace('instance:', '');
                    const risultato = window.assorbiEnergiaIstanzaOggetto ? window.assorbiEnergiaIstanzaOggetto(uid, 'batteria') : null;
                    battTrovate = risultato ? risultato.batterie : 0;
                } else {
                    const resa = { comune: 5, non_comune: 10, raro: 25, super_raro: 55 };
                    battTrovate = resa[dettagliExtra] || 0;
                }
                leader.initInventarioBase();
                leader.inventario.batterie = (leader.inventario.batterie || 0) + battTrovate;
                alert(`Hai generato ${battTrovate} Batterie (nel tuo inventario)!`);
            } else if (ricetta.id === 'riparazione_robot') {
                const target = window.party.find(p => p.id === ricetta._robotTargetId) || leader;
                target.repairRobot(Math.floor(target.robotPFMax * 0.5), leader);
                alert(`${target.nome} è stato riparato.`);
                salvaPersonaggioCloud(target);
            } else if (ricetta.id === 'stazione_ricarica') {
                window.magazzino.congegniFissi.push({ nome: 'Stazione di Ricarica', dettagli: '' });
                window.magazzino.stazioneRicarica = { batterie: 0, robotIdOccupante: null };
                if (typeof window.updateMagazzinoFields === 'function') {
                    window.updateMagazzinoFields({ stazioneRicarica: window.magazzino.stazioneRicarica });
                }
                alert('Stazione di Ricarica costruita!');
            } else if (ricetta.id === 'taser') {
                leader.inventario.armi.push('Taser');
                leader.taserCaricato = true;
            } else if (ricetta.id === 'stivali_molla') {
                leader.inventario.armi.push('Stivali a Molla');
                leader.stivaliCariche = 3;
            } else {
            switch (ricetta.outputType) {
                case 'fisso_base':
                    window.magazzino.congegniFissi.push({ nome: ricetta.name, dettagli: dettagliExtra });
                    if (ricetta.id === 'postazione_alchimista' || ricetta.name === 'Postazione da Alchimista') {
                        window.magazzino.postazioneAlchemica = true;
                        if (typeof window.updateMagazzinoFields === 'function') {
                            window.updateMagazzinoFields({ postazioneAlchemica: true });
                        }
                    }
                    break;
                case 'conteggio':
                    window.magazzino.congegniConteggio[ricetta.name] = (window.magazzino.congegniConteggio[ricetta.name] || 0) + 1;
                    break;
                case 'equipaggiamento':
                    if (ricetta.id === 'creazione_proiettili') {
                        // gestito a monte in eseguiCreazioneArtificeria/dettagliExtra
                    } else if (ricetta.id === 'proiettile_frammentazione') {
                        leader.initInventarioBase();
                        leader.inventario.proiettiliFrammentazione = (leader.inventario.proiettiliFrammentazione || 0) + 1;
                        alert(`${leader.nome} ha creato 1 Proiettile a Frammentazione.`);
                    } else if (PORTABILI_SPEDIZIONE.includes(ricetta.id)) {
                        leader.inventario.armi.push(ricetta.name);
                    } else {
                        window.magazzino.congegniConteggio[ricetta.name] = (window.magazzino.congegniConteggio[ricetta.name] || 0) + 1;
                        alert(`${ricetta.name} aggiunto ai Dispositivi della Base.`);
                    }
                    break;
                case 'potenziamento_arma': {
                    const indiceArma = leader.inventario.armi.findIndex(item => item.includes(dettagliExtra));
                    if (indiceArma !== -1) {
                        let nomeAttuale = leader.inventario.armi[indiceArma];
                        if (nomeAttuale.includes("+1")) leader.inventario.armi[indiceArma] = nomeAttuale.replace("+1", "+2");
                        else if (nomeAttuale.includes("+2")) leader.inventario.armi[indiceArma] = nomeAttuale.replace("+2", "+3");
                        else leader.inventario.armi[indiceArma] = `${nomeAttuale} (+1)`;
                        alert(`Arma potenziata! Ora hai: ${leader.inventario.armi[indiceArma]}`);
                    } else {
                        alert(`Arma '${dettagliExtra}' non trovata nell'inventario.`);
                    }
                    break;
                }
                case 'fabbisogno_robot':
                    alert(`Azione su robot completata.`);
                    break;
                default:
                    alert(`Oggetto ${ricetta.name} creato, ma senza logica di smistamento definita.`);
            }
            }
            salvaPersonaggio(leader);
            collaboratori.forEach(c => salvaPersonaggio(c));
        }
    } else if (scarto <= 3) {
        if (isSmontaggio) {
            const resaPercentuale = YIELD_SMONTAGGIO[leader.artificeria.generale.livello] || 0;
            const ingranaggiRecuperati = Math.floor((costoBase * resaPercentuale) / 2);
            window.magazzino.ingranaggi += ingranaggiRecuperati;
            alert(`⚠️ SMONTAGGIO PARZIALE! Recuperati ${ingranaggiRecuperati} ingranaggi.`);
        } else {
            const recupero = Math.floor(costoIngranaggi * 0.50);
            window.magazzino.ingranaggi += recupero;
            alert(`⚠️ FALLIMENTO LIEVE! Hai mancato la CD per ${scarto} punti. Recuperati ${recupero} ingranaggi.`);
        }
    } else {
        alert(isSmontaggio ? "❌ SMONTAGGIO FALLITO! Non hai recuperato nulla e l'oggetto è andato distrutto." : "❌ FALLIMENTO TOTALE! Tutto il materiale e il tempo sono persi.");
    }

    if (typeof window.updateMagazzinoFields === 'function') {
        window.updateMagazzinoFields({ ingranaggi: window.magazzino.ingranaggi });
    }
    window.aggiornaInterfaccia();
}

function getArtificerRecipeById(id) {
    return ARTIFICER_RECIPES.find(r => r.id === id) || null;
}

function artificeriaPersonaggio(idx) {
    if (window.hasPerk && window.hasPerk(p, 'Cieco')) {
        alert('Il tuo personaggio non riesce a vedere abbastanza bene per lavorare di precisione.');
        return;
    }
    const p = party[idx];
    if (!p) return;

    // Crea il modal se non esiste
    let modal = document.getElementById('modal-artificeria');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-artificeria';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:600px;">
                <h2 style="color:#f1c40f;">🛠️ Artificeria</h2>
                <div id="artificeria-content">
                    <p>Caricamento...</p>
                </div>
                <div class="modal-footer">
                    <button class="btn-big btn-cancel" onclick="chiudiModal('modal-artificeria')">CHIUDI</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }
    modal.style.display = 'block';
    renderArtificeriaModal(idx);
}

function renderArtificeriaModal(idx) {
    const container = document.getElementById('artificeria-content');
    if (!container) return;
    const p = party[idx];
    const recipes = (typeof window.ricetteVisibili === 'function' ? window.ricetteVisibili(p) : (window.ARTIFICER_RECIPES || []));
    if (!recipes.length) {
        container.innerHTML = '<p style="color:#aaa;">Nessuna ricetta disponibile al momento (servono più ingranaggi, un robot nel party o un oggetto magico in magazzino).</p>';
        return;
    }

    let html = `
        <div style="margin-bottom:12px; color:#ddd;">
            <strong>${p.nome}</strong> - Stamina: ${p.staminaAttuale}/${p.staminaMax}
        </div>
        <div style="margin-bottom:12px;">
            <label>Ricetta:</label>
            <select id="artificeria-recipe" style="width:100%; background:#222; color:white; border:1px solid #444; padding:5px;">
                ${recipes.map(r => `<option value="${r.id}">${r.name} (${r.difficulty})</option>`).join('')}
            </select>
        </div>
        <div style="margin-bottom:12px;">
            <label>Collaboratori (tieni Ctrl per multi-selezione):</label>
            <select id="artificeria-collaboratori" multiple style="width:100%; background:#222; color:white; border:1px solid #444; padding:5px; min-height:60px;">
                ${party.map((m, i) => i !== idx ? `<option value="${i}">${m.nome}</option>` : '').join('')}
            </select>
        </div>
        <div style="margin-bottom:12px;">
            <label><input type="checkbox" id="artificeria-smontaggio"> Smontaggio</label>
        </div>
        <button class="btn-hero" onclick="eseguiArtificeria(${idx})">Esegui</button>
    `;
    container.innerHTML = html;
}

function eseguiArtificeria(idx) {
    const recipeSelect = document.getElementById('artificeria-recipe');
    const recipeId = recipeSelect.value;
    const collabSelect = document.getElementById('artificeria-collaboratori');
    const collaboratori = Array.from(collabSelect.selectedOptions).map(opt => parseInt(opt.value));
    const isSmontaggio = document.getElementById('artificeria-smontaggio').checked;

    if (!recipeId) {
        alert('Seleziona una ricetta.');
        return;
    }

    if (typeof window.risolviAzioneArtificeria === 'function') {
        window.risolviAzioneArtificeria(idx, collaboratori, recipeId, isSmontaggio);
    } else {
        alert('Funzione di artificeria non disponibile. Verifica che il modulo sia caricato correttamente.');
    }
}

function getRecipeRequiredLevel(recipe) {
    if (typeof recipe.requiredLevel === 'number') return { generale: recipe.requiredLevel, specializzazioni: {} };
    if (recipe.requiredLevel && typeof recipe.requiredLevel === 'object') {
        return {
            generale: recipe.requiredLevel.generale || recipe.requiredLevel.general || 0,
            specializzazioni: recipe.requiredLevel.specializzazioni || recipe.requiredLevel.specializations || {}
        };
    }

    const diff = recipe.difficulty || 'Facile';
    if (diff === 'Molto difficile') return { generale: 3, specializzazioni: { Elettronica: 3, Meccanica: 3, Balistica: 3 } };
    if (diff === 'Difficile') return { generale: 2, specializzazioni: { Elettronica: 2, Meccanica: 2, Balistica: 2 } };
    if (diff === 'Media') return { generale: 1, specializzazioni: { Elettronica: 1, Meccanica: 1, Balistica: 1 } };
    return { generale: 0, specializzazioni: {} };
}

function hasRequiredMaterials(p, recipe) {
    const requiredMaterials = recipe.requiredMaterials || {};
    const materialEntries = Object.entries(requiredMaterials).length
        ? Object.entries(requiredMaterials)
        : Object.entries(recipe.cost || {}).filter(([k]) => !['ingranaggi_base', 'ingranaggi'].includes(k));

    return materialEntries.every(([material, amount]) => {
        let available = 0;
        if (material === 'ingranaggi' || material === 'ingranaggi_base') {
            available = (window.magazzino.ingranaggi || 0) + (p.inventario?.ingranaggi || 0);
        } else if (p.inventario && p.inventario[material] != null) {
            available = p.inventario[material] || 0;
        } else if (window.magazzino && window.magazzino[material] != null) {
            available = window.magazzino[material] || 0;
        }
        return available >= (amount || 0);
    });
}

function ricetteVisibili(p) {
    const haRobot = window.party.some(m => m.isRobot);
    const haOggettoMagico = window.magazzino.oggettiMagici &&
        Object.values(window.magazzino.oggettiMagici).some(q => q > 0);
    const livelloAG = p?.artificeria?.generale?.livello || 0;
    const specializzazioni = p?.artificeria?.specializzazioni || {};

    return ARTIFICER_RECIPES.filter(r => {
        if (r.outputType === 'fabbisogno_robot') return haRobot;
        if (r.outputType === 'fabbisogno_magico') return haOggettoMagico;

        const requiredLevel = getRecipeRequiredLevel(r);
        const meetsLevel = (livelloAG >= (requiredLevel.generale || 0)) &&
            Object.entries(requiredLevel.specializzazioni || {}).every(([spec, lv]) => (specializzazioni[spec]?.livello || 0) >= (lv || 0));
        const meetsMaterials = hasRequiredMaterials(p, r);
        const costoBase = r.cost?.ingranaggi ?? r.cost?.ingranaggi_base ?? 0;
        const hasBaseCost = (window.magazzino.ingranaggi || 0) >= costoBase;

        return meetsLevel && meetsMaterials && hasBaseCost;
    });
}

const SOGLIE_AG = [0, 4, 7, 10, 15, 20];
const BONUS_AG_TEMPO = [0, 0, 0.05, 0.10, 0.15, 0.20]; // Indice = Livello AG
const YIELD_SMONTAGGIO = [0, 0.45, 0.55, 0.65, 0.75, 0.85];

const SOGLIE_SPEC = [0, 5, 15, 35, 65, 125];

const DIFFICOLTA_CRAFTING = {
    'Facile': { cdBase: 14, psBase: 1 },
    'Media': { cdBase: 20, psBase: 3 },
    'Difficile': { cdBase: 24, psBase: 7 },
    'Molto difficile': { cdBase: 32, psBase: 15 }
};

// --- INIZIALIZZAZIONE STATISTICHE ---
// Assicurati di chiamare questa funzione alla creazione del PG o quando apri l'artificeria
function initArtificeria(p) {
    if (!p.artificeria) {
        p.artificeria = {
            generale: { livello: 0, pag: 0 },
            specializzazioni: {
                Balistica: { livello: 0, ps: 0 },
                Meccanica: { livello: 0, ps: 0 },
                Elettronica: { livello: 0, ps: 0 }
            }
        };
    }
}

const ARTIFICERIA_AG_COST = [0, 4, 7, 10, 15, 20];
const ARTIFICERIA_SPEC_COST = [0, 2, 4, 7, 10, 13];
const ARTIFICERIA_SPECS = ['Balistica', 'Meccanica', 'Elettronica'];

function initArtificeriaBuilder(p) {
    if (!p.artificeria) {
        p.artificeria = {
            generale: { livello: 0, pag: 0 },
            specializzazioni: {
                Balistica: { livello: 0, ps: 0 },
                Meccanica: { livello: 0, ps: 0 },
                Elettronica: { livello: 0, ps: 0 }
            }
        };
    }
}

function modificaArtificeriaGenerale(delta) {
    const p = window.tempP;
    if (!p) return;
    initArtificeriaBuilder(p);
    const attuale = p.artificeria.generale.livello;
    if (delta > 0) {
        const next = attuale + 1;
        if (next > 5) return;
        const costo = ARTIFICERIA_AG_COST[next];
        if (p.puntiCreazione < costo) { alert('Punti insufficienti per aumentare Artificeria Generale.'); return; }
        p.puntiCreazione -= costo;
        p.artificeria.generale.livello = next;
    } else if (attuale > 0) {
        p.puntiCreazione += ARTIFICERIA_AG_COST[attuale];
        p.artificeria.generale.livello = attuale - 1;
    }
    renderSetupStats();
    renderSetupArtificeria();
}

function modificaArtificeriaSpec(spec, delta) {
    const p = window.tempP;
    if (!p) return;
    initArtificeriaBuilder(p);
    const attuale = p.artificeria.specializzazioni[spec].livello;
    if (delta > 0) {
        const next = attuale + 1;
        if (next > 5) return;
        const costo = ARTIFICERIA_SPEC_COST[next];
        if (p.puntiCreazione < costo) { alert(`Punti insufficienti per aumentare ${spec}.`); return; }
        p.puntiCreazione -= costo;
        p.artificeria.specializzazioni[spec].livello = next;
    } else if (attuale > 0) {
        p.puntiCreazione += ARTIFICERIA_SPEC_COST[attuale];
        p.artificeria.specializzazioni[spec].livello = attuale - 1;
    }
    renderSetupStats();
    renderSetupArtificeria();
}

function renderSetupArtificeria() {
    const container = document.getElementById('artificeria-setup-container');
    if (!container) return;
    const p = window.tempP;
    if (!p) return;
    initArtificeriaBuilder(p);

    let html = `
        <div style="background:#111; padding:10px; border-radius:6px; margin-top:10px;">
            <div style="font-weight:bold; color:#f1c40f; margin-bottom:8px;">ARTIFICERIA (opzionale)</div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span>Artificeria Generale (Lv ${p.artificeria.generale.livello})</span>
                <div>
                    <button onclick="modificaArtificeriaGenerale(-1)" style="padding:4px 8px;">-</button>
                    <span style="display:inline-block; width:36px; text-align:center; font-size:0.8rem;">${p.artificeria.generale.livello < 5 ? ARTIFICERIA_AG_COST[p.artificeria.generale.livello + 1] + 'pt' : 'MAX'}</span>
                    <button onclick="modificaArtificeriaGenerale(1)" style="padding:4px 8px;">+</button>
                </div>
            </div>`;

    ARTIFICERIA_SPECS.forEach(spec => {
        const lvl = p.artificeria.specializzazioni[spec].livello;
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span>${spec} (Lv ${lvl})</span>
                <div>
                    <button onclick="modificaArtificeriaSpec('${spec}', -1)" style="padding:4px 8px;">-</button>
                    <span style="display:inline-block; width:36px; text-align:center; font-size:0.8rem;">${lvl < 5 ? ARTIFICERIA_SPEC_COST[lvl + 1] + 'pt' : 'MAX'}</span>
                    <button onclick="modificaArtificeriaSpec('${spec}', 1)" style="padding:4px 8px;">+</button>
                </div>
            </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
}
function eseguiPotenziaRobot(target, extraAddMult = 1, extraRemoveMult = 1) {
    const azione = prompt('Scrivi "aggiungi" o "rimuovi"', 'aggiungi');
    const perkRobotici = (window.DATABASE_PERK.robotici || []);

    if (azione === 'aggiungi') {
        const nomi = perkRobotici.filter(p => !target.perks.some(tp => (tp.nome||tp) === p.nome)).map(p => p.nome);
        const scelto = prompt(`Perk da aggiungere:\n${nomi.join('\n')}`);
        const perkDati = perkRobotici.find(p => p.nome === scelto);
        if (!perkDati) return alert('Perk non trovato.');
        let costoIng = 15;
        const costoOre = 1;
        if (target.hasPerk && target.hasPerk('Non compatibile')) costoIng = Math.ceil(costoIng * 1.2);
        if (target.hasPerk && target.hasPerk('Compatibile')) costoIng = Math.ceil(costoIng * 0.8);
        costoIng = Math.ceil(costoIng * extraAddMult);
        if (magazzino.ingranaggi < costoIng) return alert('Ingranaggi insufficienti.');
        magazzino.ingranaggi -= costoIng;
        target.perks.push({ ...perkDati });
        alert(`${target.nome} ha ottenuto: ${perkDati.nome} (-${costoIng} ingranaggi, ${costoOre}h).`);
    } else {
        const rimovibili = target.perks.filter(p => (p.costo || 0) > 0);
        const nomi = rimovibili.map(p => p.nome || p);
        const scelto = prompt(`Perk positivo da rimuovere (costa 10 ing/punto + 0.5h/punto):\n${nomi.join('\n')}`);
        const idxPerk = target.perks.findIndex(p => (p.nome || p) === scelto);
        if (idxPerk === -1) return alert('Perk non trovato o non rimovibile.');
        const perkRimosso = target.perks[idxPerk];
        let costoIng = Math.abs(perkRimosso.costo || 0) * 10;
        if (target.hasPerk && target.hasPerk('Non compatibile')) costoIng = Math.ceil(costoIng * 0.8);
        if (target.hasPerk && target.hasPerk('Compatibile')) costoIng = Math.ceil(costoIng * 1.2);
        costoIng = Math.ceil(costoIng * extraRemoveMult);
        if (magazzino.ingranaggi < costoIng) return alert('Ingranaggi insufficienti.');
        magazzino.ingranaggi -= costoIng;
        target.perks.splice(idxPerk, 1);
        alert(`${perkRimosso.nome} rimosso da ${target.nome} (-${costoIng} ingranaggi).`);
    }
    aggiornaInterfaccia();
    salvaPersonaggioCloud(target);
}

function apriPotenziaRobotModal(leaderIdx) {
    const robots = party.filter(p => p.isRobot);
    if (!robots.length) return alert('Nessun robot nel party.');
    const lista = robots.map((r, i) => `${i}: ${r.nome}`).join('\n');
    const sceltaIdx = parseInt(prompt(`Su quale robot vuoi agire?\n${lista}`, '0'));
    const target = robots[sceltaIdx];
    if (!target) return;
    eseguiPotenziaRobot(target, 1, 1);
}

window.apriAutopotenziamentoModal = function(idx) {
    const p = party[idx];
    if (!p || !p.isRobot || !p.hasPerk('Autopotenziamento')) return;
    eseguiPotenziaRobot(p, 1.1, 0.9);
};

function risolviAzioneArtificeriaConGruppo(leader, collaboratori, ricettaId, isSmontaggio) {
    // 1. Controlli preliminari
    if (!leader) {
        console.error('Leader non definito.');
        return;
    }
    const ricetta = getArtificerRecipeById(ricettaId);
    if (!ricetta) {
        console.error('Ricetta non trovata:', ricettaId);
        return;
    }

    // 2. Verifica che il leader abbia i requisiti minimi (se necessario)
    // (la funzione originale risolviAzioneArtificeria fa già questi controlli, ma li ripetiamo per sicurezza)

    // 3. Converti i personaggi in indici
    const leaderIdx = party.indexOf(leader);
    if (leaderIdx === -1) {
        console.error('Leader non trovato nel party.');
        return;
    }
    const collaboratoriIdxs = collaboratori
        .map(c => party.indexOf(c))
        .filter(i => i !== -1);

    // 4. Rimuovi eventuali duplicati (se il leader è stato incluso per errore)
    const uniqueCollaborators = collaboratoriIdxs.filter(i => i !== leaderIdx);
    const uniqueSet = new Set(uniqueCollaborators);
    const finalCollaborators = Array.from(uniqueSet);

    // 5. Chiama la funzione originale di artificeria
    // Nota: risolviAzioneArtificeria gestisce già il calcolo del tiro, il consumo di materiali,
    // la distribuzione dei punti esperienza e il posizionamento degli oggetti.
    risolviAzioneArtificeria(leaderIdx, finalCollaborators, ricettaId, isSmontaggio);
}

function avviaSmantellamentoRobot(leader) {
    const robots = window.party.filter(p => p.isRobot);
    const opzioni = ['🪦 Smonta un cadavere robot dalla base'].concat(robots.map(r => `🤖 ${r.nome} (vivo, richiede consenso)`));
    if (window.magazzino.cadaveriRobot <= 0 && robots.length === 0) {
        alert('Nessun robot (vivo o cadavere) disponibile da smantellare.');
        return;
    }
    const listaStr = opzioni.map((o, i) => `${i}) ${o}`).join('\n');
    const scelta = parseInt(prompt(`Cosa vuoi smantellare?\n${listaStr}`, '0'));
    if (isNaN(scelta)) return;

    if (scelta === 0) {
        if (window.magazzino.cadaveriRobot <= 0) { alert('Nessun cadavere robot disponibile.'); return; }
        eseguiSmantellamentoRobot(leader, null, true);
        return;
    }
    const target = robots[scelta - 1];
    if (!target) return;
    inviaProposta(leader.id, target.id, 'smantellamento-robot', { leaderId: leader.id });
    mostraNotificaInAlto(`Richiesta di smantellamento inviata a ${target.nome}. In attesa di consenso...`, 'info');
}

function eseguiSmantellamentoRobot(leader, targetRobot, daCadavere) {
    const ricompensa = rollDice(4, 12) + (daCadavere ? 0 : Math.max(0, (targetRobot.robotRepairTotalLimit || 0) - (targetRobot.robotRepairTotalDone || 0)));
    window.magazzino.ingranaggi += ricompensa;
    if (typeof window.updateMagazzinoFields === 'function') window.updateMagazzinoFields({ ingranaggi: window.magazzino.ingranaggi });

    if (daCadavere) {
        window.magazzino.cadaveriRobot = Math.max(0, window.magazzino.cadaveriRobot - 1);
        if (typeof window.updateMagazzinoFields === 'function') window.updateMagazzinoFields({ cadaveriRobot: window.magazzino.cadaveriRobot });
        alert(`Cadavere robot smantellato: +${ricompensa} ingranaggi.`);
        if (typeof window.applicaFolliaSbarazzoCadavere === 'function') window.applicaFolliaSbarazzoCadavere(leader);
    } else {
        const idx = window.party.indexOf(targetRobot);
        if (idx !== -1) window.party.splice(idx, 1);
        alert(`${targetRobot.nome} è stato smantellato definitivamente: +${ricompensa} ingranaggi.`);
    }
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
}

window.eseguiSmantellamentoRobot = eseguiSmantellamentoRobot;
window.avviaSmantellamentoRobot = avviaSmantellamentoRobot;
window.apriPotenziaRobotModal = apriPotenziaRobotModal;
window.ARTIFICERIA_AG_COST = ARTIFICERIA_AG_COST;
window.ARTIFICERIA_SPEC_COST = ARTIFICERIA_SPEC_COST;
window.ARTIFICERIA_SPECS = ARTIFICERIA_SPECS;
window.modificaArtificeriaGenerale = modificaArtificeriaGenerale;
window.modificaArtificeriaSpec = modificaArtificeriaSpec;
window.renderSetupArtificeria = renderSetupArtificeria;
window.ricetteVisibili = ricetteVisibili;
window.risolviAzioneArtificeriaConGruppo = risolviAzioneArtificeriaConGruppo;
window.getArtificerRecipeById = getArtificerRecipeById;
window.risolviAzioneArtificeria = risolviAzioneArtificeria;
window.getArtificerRecipeById = getArtificerRecipeById;
window.calcolaCrafting = calcolaCrafting;
window.aggiungiPuntiArtificeria = aggiungiPuntiArtificeria;
window.artificeriaPersonaggio = artificeriaPersonaggio;
window.eseguiArtificeria = eseguiArtificeria;

