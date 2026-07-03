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
        description: 'Trasmettitore + ricevitore. Segnale 36m, suono percepibile 5m.',
        cost: { ingranaggi: 25 },
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

const SOGLIE_AG = [0, 4, 7, 10, 15, 20];
const BONUS_AG_TEMPO = [0, 0, 0.05, 0.10, 0.15, 0.20]; // Indice = Livello AG
const YIELD_SMONTAGGIO = [0, 0.45, 0.55, 0.65, 0.75, 0.85];

const SOGLIE_SPEC = [0, 5, 15, 35, 65, 125];

const DIFFICOLTA_CRAFTING = {
    'Facile': { cdBase: 14, psBase: 1 },
    'Media': { cdBase: 20, psBase: 3 },
    'Difficile': { cdBase: 24, psBase: 7 },
    'Molto difficile': { cdBase: 36, psBase: 15 }
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

// --- FUNZIONI DI PROGRESSIONE ---
function aggiungiPuntiArtificeria(p, specRichieste, puntiPS, isLeader, numAssistenti = 0) {
    initArtificeria(p);
    
    // Calcolo PS effettivi
    let psOttenuti = 0;
    if (isLeader) {
        psOttenuti = puntiPS; // Leader prende 100%
    } else if (numAssistenti > 0) {
        // Assistente prende (PS Base / 2) diviso il numero di assistenti (arrotondato per eccesso)
        psOttenuti = Math.ceil((puntiPS / 2) / numAssistenti);
    }
    
    // Assegna PS alla specializzazione principale della ricetta (la prima nell'oggetto)
    const specPrincipale = Object.keys(specRichieste)[0];
    if (specPrincipale && p.artificeria.specializzazioni[specPrincipale]) {
        p.artificeria.specializzazioni[specPrincipale].ps += psOttenuti;
        
        // Level Up Specializzazione
        let lvlSpec = p.artificeria.specializzazioni[specPrincipale].livello;
        while (lvlSpec < 5 && p.artificeria.specializzazioni[specPrincipale].ps >= SOGLIE_SPEC[lvlSpec + 1]) {
            p.artificeria.specializzazioni[specPrincipale].livello++;
            lvlSpec++;
            alert(`🎉 ${p.nome} ha raggiunto il Livello ${lvlSpec} in ${specPrincipale}!`);
        }
    }

    // Aggiunge PAG (0.25 per ogni PS)
    const pagOttenuti = psOttenuti * 0.25;
    p.artificeria.generale.pag += pagOttenuti;

    // Level Up Artificeria Generale
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
        cdFinale = diff.cdBase - lvAG_Leader - lvSpec_Leader;
    }

    // 2. CALCOLO DEL TEMPO
    // Estrapoliamo le ore base dalla ricetta (assumiamo 1 ora se non specificato chiaramente, dovrai mappare bene l'oggetto time)
    let oreBase = ricetta.time.hours || (ricetta.time.perFiveBatteries_hours) || (ricetta.time.time_minutes ? ricetta.time.time_minutes/60 : 1);
    
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

// Questa è la funzione che esegue effettivamente l'azione e chiede il tiro di dado
function risolviAzioneArtificeria(leaderIdx, collaboratoriIdxs, ricettaId, isSmontaggio = false) {
    const leader = party[leaderIdx];
    let ricetta = Object.assign({}, getArtificerRecipeById(ricettaId)); // Copia per poter modificare i costi dinamici
    if (!leader || !ricetta) return;

    let costoIngranaggi = ricetta.cost.ingranaggi || ricetta.cost.ingranaggi_base || 0;
    let dettagliExtra = ""; // Per segnare num telecamere o simili nei fissi

    // --- FASE 1: GESTIONE DEGLI INPUT SPECIALI PRE-CRAFTING ---
    if (ricetta.outputType === 'fabbisogno_magico') {
        const raritaScelta = prompt("Quale rarità di oggetto magico vuoi assorbire?\n(comune, non_comune, raro, super_raro)");
        if (!raritaScelta || !magazzino.oggettiMagici[raritaScelta] || magazzino.oggettiMagici[raritaScelta] <= 0) {
            alert(`Non possiedi un oggetto magico di rarità '${raritaScelta}'!`);
            return;
        }
        // Consumiamo l'oggetto magico a prescindere dall'esito
        magazzino.oggettiMagici[raritaScelta]--;
        dettagliExtra = raritaScelta; 
    }

    if (ricetta.outputType === 'fabbisogno_robot') {
        const robotId = prompt("Scrivi il nome o l'ID del robot che vuoi utilizzare per questa azione:");
        if (!robotId) return;
        dettagliExtra = `(Robot: ${robotId})`;
    }

    if (ricetta.outputType === 'potenziamento_arma') {
        const armaNome = prompt("Scrivi il nome esatto dell'arma nel tuo inventario che vuoi potenziare:");
        if (!armaNome) return;
        dettagliExtra = armaNome;
    }

    if (ricetta.richiedeInput === 'telecamere') {
        let numTel = parseInt(prompt("Quante telecamere vuoi costruire insieme alla stazione? (Max 4)"));
        if (isNaN(numTel) || numTel < 0 || numTel > 4) return;
        costoIngranaggi = 60 + (numTel * 20); // 60 base + 20 a telecamera
        ricetta.time = { hours: 12 + (numTel * 8) };
        dettagliExtra = `(Stazione + ${numTel} Telecamere)`;
    }

    // --- FASE 2: VERIFICA COSTI E CALCOLO ---
    if (magazzino.ingranaggi < costoIngranaggi) {
        alert(`Non hai abbastanza ingranaggi! (Richiesti: ${costoIngranaggi}, Posseduti: ${magazzino.ingranaggi})`);
        return;
    }

    const collaboratori = collaboratoriIdxs.map(i => party[i]);
    const calcoli = calcolaCrafting(leader, collaboratori, ricetta, isSmontaggio);

    let avviso = `Costruire: ${ricetta.name} ${dettagliExtra}\nLeader: ${leader.nome}\n`;
    avviso += `CD Finale: ${calcoli.cdFinale}\nTempo: ${calcoli.oreStimate}h\nCosto: ${costoIngranaggi} ingranaggi.`;
    
    let tiroDadoStr = prompt(`${avviso}\n\nInserisci il risultato del D20 + Modificatore:`);
    if (!tiroDadoStr) return;

    let risultato = parseInt(tiroDadoStr);
    magazzino.ingranaggi -= costoIngranaggi;
    let scarto = calcoli.cdFinale - risultato;

    // --- FASE 3: ESITI E ASSEGNAZIONE DEL LOOT ---
    if (scarto <= 0) {
        alert(`✅ SUCCESSO! L'oggetto è stato creato.`);
        aggiungiPuntiArtificeria(leader, ricetta.specialization, calcoli.diffBase.psBase, true);
        
        // Smistamento logico dell'oggetto creato
        switch (ricetta.outputType) {
            case 'fisso_base':
                magazzino.congegniFissi.push({
                    nome: ricetta.name,
                    dettagli: dettagliExtra
                });
                break;
            case 'conteggio':
                if (magazzino.congegniConteggio[ricetta.name] !== undefined) {
                    magazzino.congegniConteggio[ricetta.name]++;
                }
                break;
            case 'equipaggiamento':
                // Aggiungilo all'inventario del leader (o magazzino generale a seconda di come gestisci gli item normali)
                leader.inventario.push(ricetta.name); 
                break;
            case 'potenziamento_arma':
                // Cerca l'arma e aggiungi +1
                let indiceArma = leader.inventario.findIndex(item => item.includes(dettagliExtra));
                if (indiceArma !== -1) {
                    let nomeAttuale = leader.inventario[indiceArma];
                    if (nomeAttuale.includes("+1")) leader.inventario[indiceArma] = nomeAttuale.replace("+1", "+2");
                    else if (nomeAttuale.includes("+2")) leader.inventario[indiceArma] = nomeAttuale.replace("+2", "+3");
                    else leader.inventario[indiceArma] = `${nomeAttuale} +1`;
                    alert(`Arma potenziata! Ora hai: ${leader.inventario[indiceArma]}`);
                } else {
                    alert(`Arma '${dettagliExtra}' non trovata nell'inventario. Il potenziamento è pronto per essere applicato manualmente.`);
                }
                break;
            case 'fabbisogno_magico':
                // Genera batterie
                const resa = { 'comune': 5, 'non_comune': 10, 'raro': 25, 'super_raro': 55 };
                const battTrovate = resa[dettagliExtra] || 0;
                // magazzino.batterie += battTrovate; // Se hai una variabile per le batterie
                alert(`Hai generato ${battTrovate} Batterie!`);
                break;
        }

    } else if (scarto <= 3) {
        const recupero = Math.floor(costoIngranaggi * 0.50);
        magazzino.ingranaggi += recupero;
        alert(`⚠️ FALLIMENTO LIEVE! Hai mancato la CD per ${scarto} punti. Recuperati ${recupero} ingranaggi.`);
    } else {
        alert(`❌ FALLIMENTO TOTALE! Tutto il materiale e il tempo sono persi.`);
    }
    
    aggiornaInterfaccia();
}