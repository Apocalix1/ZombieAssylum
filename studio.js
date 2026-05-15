const MEDICAL_SYSTEM = {
    procedure: {
        lieve: { 
            nome: "Lieve", cd: 12, lvReq: 0, pm: 1, 
            mat: { base: 5, avanzati: 0, critici: 0 } 
        },
        profonda: { 
            nome: "Profonda", cd: 16, lvReq: 2, pm: 3, 
            mat: { base: 10, avanzati: 2, critici: 0 } 
        },
        funzionale: { 
            nome: "Rischio Funz.", cd: 20, lvReq: 3, pm: 7, 
            mat: { base: 15, avanzati: 8, critici: 1 } 
        },
        morte: { 
            nome: "Rischio Morte", cd: 24, lvReq: 4, pm: 10, 
            mat: { base: 30, avanzati: 16, critici: 5 } 
        },
        rianimazione: { 
            nome: "Rianimazione", cd: 28, lvReq: 5, pm: 13, 
            mat: { base: 0, avanzati: 0, critici: 15 } 
        }
    },
    livelli: [
        { soglia: 0, bonus: 0, desc: "Novizio" },
        { soglia: 8, bonus: 0, desc: "Lv 1: Competenza (Diagnosi 40%)" },
        { soglia: 24, bonus: 1, desc: "Lv 2: Autocura (Diagnosi 60%)" },
        { soglia: 40, bonus: 2, desc: "Lv 3: Salvare Morenti" },
        { soglia: 56, bonus: 4, desc: "Lv 4: Maestria (Diagnosi 80%)" },
        { soglia: 72, bonus: 7, desc: "Lv 5: Chirurgo Rianimatore (+3)" }
    ]
};

const SKILL_SYSTEM = {
    semantics: {
        "Addestrare animali": "Competenza su animale e percezione comportamentale.",
        "Acrobazia": "Agilità, equilibrio e reattività in prova su Destrezza.",
        "Arcano": "Conoscenza arcana e controllo della magia.",
        "Atletica": "Forza e resistenza in prove fisiche e movimento.",
        "Cucina": "Preparare cibo nutriente e bonus legati ai pasti.",
        "Indagare": "Esaminare tracce e dedurre informazioni.",
        "Furtività": "Mimetizzazione, movimento silenzioso e occultamento.",
        "Giochi di carte": "Intuito sociale e psicologia durante il gioco.",
        "Inganno": "Manipolare, mentire e ingannare gli altri.",
        "Intimidire": "Coercizione e pressione sociale.",
        "Intrattenere": "Prestazioni e distrarre un pubblico.",
        "Intuizione": "Percezione sottile e giudizio sociale.",
        "Manodopera": "Lavoro manuale, riparazioni e uso di strumenti.",
        "Natura": "Conoscenza ambientale, piante e creature.",
        "Percezione": "Avvertire dettagli, movimenti e suoni.",
        "Persuasione": "Convincere gli altri con parole e fascino.",
        "Rapidità di mano": "Mani veloci, borseggio e manipolazione rapida.",
        "Religione": "Conoscenze e resistenza legate al culto e alla follia.",
        "Sopravvivenza": "Orientamento, raccoglimento e resistenza in natura.",
        "Storia": "Conoscenze storiche e culturali.",
        "Strumenti da scasso": "Apertura serrature e neutralizzazione trappole."
    },
    ratings: {
        note: "Valori: -2 competenza negativa, -1 svantaggio, 0 nullo, 1 competenza, 2 maestria."
    },
    savingThrows: {
        "Acrobazia": "Destrezza",
        "Inganno": "Carisma",
        "Intuizione": "Saggezza",
        "Indagare": "Intelligenza",
        "Percezione": "Saggezza",
        "Persuasione": "Carisma",
        "Religione": "Saggezza",
        "Storia": "Intelligenza"
    },
    masteryDescriptions: {
        "Addestrare animali": "Gli infetti non intelligenti hanno bisogno di +4 per individuare con Percezione e Percezione passiva.",
        "Acrobazia": "Ottieni tiri salvezza su Destrezza.",
        "Arcano": "Ottieni +2 mana e rigeneri 1d4 in più di punti mana a riposo breve.",
        "Atletica": "La tua velocità aumenta di 3 metri.",
        "Cucina": "Gli alleati che mangiano il tuo cibo ottengono +4 punti ferita fortuna temporanei.",
        "Indagare": "Ottieni competenza nei tiri salvezza in Intelligenza.",
        "Furtività": "Quando fallisci un tiro su furtività puoi rilanciarlo due volte a sessione.",
        "Giochi di carte": "Ottieni +2 CA ai primi attacchi (mod Carisma) che subisci in un combattimento.",
        "Inganno": "Ottieni competenza nei tiri salvezza in Carisma.",
        "Intimidire": "Durante il combattimento puoi usare la tua azione bonus per obbligare un avversario (non infetto) a fare un tiro salvezza su Carisma (CD 14). Se fallisce, ottiene svantaggio nel colpire te e i tuoi alleati per il prossimo turno.",
        "Intrattenere": "Come azione puoi obbligare una creatura intelligente che ti vede o sente a fare un TS su Carisma (CD 14). Se fallisce, perde concentrazione.",
        "Intuizione": "Ottieni competenza nei tiri salvezza in Saggezza.",
        "Manodopera": "Puoi lanciare Riparare due volte al giorno e riduci il tempo di costruzione/riparazione di Artificeria del 25%.",
        "Natura": "Accesso all'alchimia di alto livello.",
        "Percezione": "Ottieni vista cieca di 3 metri.",
        "Persuasione": "Come azione puoi ispirare un alleato dandogli +1d4 a un TS/Tiro abilità/Tiro per colpire. Dura 1 minuto e un alleato può avere un solo d4 alla volta.",
        "Rapidità di mano": "Nel primo turno di combattimento puoi fare come azione bonus un attacco con armi improvvisate o piccole e hai un'azione gratuita per estrarre o cambiare oggetti.",
        "Religione": "Sei resistente alla follia del 50%.",
        "Sopravvivenza": "Recuperi la tacca della stamina nella metà dei tempi.",
        "Storia": "Il tempo di studio dai libri è ridotto della metà.",
        "Strumenti da scasso": "I CD per porte e serrature sono ridotti di 4 e gli strumenti non si rompono al fallimento."
    }
};

console.log("Sistema Medico caricato correttamente.");
console.log("Database Abilità caricato correttamente.");

SKILL_SYSTEM.languages = [
    "Lingua di Diefrost",
    "Lingua di Engenia",
    "Lingua di Chrimata",
    "Lingua di Rodulphia",
    "Lingua di Talassio",
    "Lingua di Britannia/Greenhill",
    "Lingua della Terra dei cieli",
    "Lingua del Grande Blu"
];