export const ARTIFICER_RECIPES = [
    {
        id: 'batterie_creazione',
        name: 'Creazione Batterie',
        category: 'Energia & Batterie',
        difficulty: 'Facile',
        description: 'Assorbi energia residua da oggetti magici o dispositivi arcani per creare batterie.',
        yieldByRarity: { comune: 5, non_comune: 10, raro: 25, super_raro: 55 },
        cost: { ingranaggi: 2 },
        time: { perFiveBatteries_hours: 1 },
        specialization: { Elettronica: 1 }
    },
    {
        id: 'estrazione_energia_robot',
        name: 'Estrazione Energia dai Robot',
        category: 'Energia & Batterie',
        difficulty: 'Molto difficile',
        description: 'Estrai energia dalla batteria arcana di un robot per convertirla in batterie. Ogni 3 batterie, 1 si perde.',
        yield: { batteriesPerHour: 1, lossEvery: 3 },
        cost: { ingranaggi: 2 },
        time: { perBattery_minutes: 60 },
        specialization: { Elettronica: 4, Meccanica: 5 }
    },
    // Comunicazione, Sensori & Sorveglianza
    {
        id: 'orologio_timer',
        name: 'Orologio / Timer',
        category: 'Comunicazione, Sensori & Sorveglianza',
        difficulty: 'Facile',
        description: 'Orologio impostabile come sveglia, timer o segnalatore temporizzato.',
        cost: { ingranaggi: 5 },
        time: { hours: 1 },
        specialization: { Elettronica: 1 }
    },
    {
        id: 'sistema_telecamere',
        name: 'Sistema di Telecamere',
        category: 'Comunicazione, Sensori & Sorveglianza',
        difficulty: 'Molto difficile',
        description: 'Stazione centrale + fino a 4 telecamere. Visione 18m, segnale 36m, nessuna registrazione. 1 batteria ogni 3 ore.',
        components: { stazione: 1, telecamere_max: 4 },
        camera: { vision_m: 18, signal_m: 36, battery_consumption_per_3h: 1 },
        cost: { stazione_ingranaggi: 60, stazione_hours: 12, telecamera_ingranaggi: 20, telecamera_hours: 8 },
        specialization: { Elettronica: 5, Meccanica: 2 }
    },
    {
        id: 'ripetitore_segnale',
        name: 'Ripetitore di Segnale',
        category: 'Comunicazione, Sensori & Sorveglianza',
        difficulty: 'Molto difficile',
        description: 'Ripete segnale degli oggetti che funzionano a segnale.',
        variants: [
            { key: 'piccolo', raggio_m: 18, cost_ing: 20, time_hours: 5, consumption_batt_per_giorno: 1 },
            { key: 'medio', raggio_m: 36, cost_ing: 40, time_hours: 8, consumption_batt_per_giorno: 2 },
            { key: 'grande', raggio_m: 72, cost_ing: 80, time_hours: 12, consumption_batt_per_giorno: 3 },
            { key: 'antenna', raggio_m: 124, cost_ing: 120, time_hours: 15, consumption_batt_per_giorno: 4 }
        ],
        specialization: { Elettronica: 5, Meccanica: 3 }
    },
    {
        id: 'intercettatore_pietre',
        name: 'Intercettatore di Pietre',
        category: 'Comunicazione, Sensori & Sorveglianza',
        difficulty: 'Molto difficile',
        description: 'Intercetta comunicazioni nel raggio di 1 km. Uso: TS Artificeria CD16 oppure Elettronica ≥ 2.',
        cost: { ingranaggi: 60 },
        time: { hours: 12 },
        consumption: { batteries_per_hour: 2 },
        specialization: { Elettronica: 4 }
    },
    {
        id: 'localizzatore',
        name: 'Localizzatore (trasmettitore+ricevitore)',
        category: 'Comunicazione, Sensori & Sorveglianza',
        difficulty: 'Difficile',
        description: 'Coppia trasmettitore + ricevitore. Segnale 36m, suono percepibile 5m.',
        cost: { ingranaggi: 25 },
        time: { hours: 6 },
        specialization: { Elettronica: 3 }
    },
    // Illuminazione & Ottica
    {
        id: 'torcia_direzionale',
        name: 'Torcia Direzionale',
        category: 'Illuminazione & Ottica',
        difficulty: 'Facile',
        description: 'Illumina una linea retta fino a 18 metri.',
        cost: { ingranaggi: 10 },
        time: { hours: 2 },
        consumption: { battery_per_3h: 1 },
        specialization: { Elettronica: 1 }
    },
    {
        id: 'binocolo',
        name: 'Binocolo',
        category: 'Illuminazione & Ottica',
        difficulty: 'Facile',
        description: 'Ingrandimento visivo x5.',
        cost: { ingranaggi: 10 },
        time: { hours: 1 },
        specialization: { Balistica: 1 }
    },
    // Suono & Amplificazione
    {
        id: 'cassa_amplificata',
        name: 'Cassa Amplificata',
        category: 'Suono & Amplificazione',
        difficulty: 'Facile',
        description: 'Amplifica il suono x3, include microfono e cavo da 3m.',
        cost: { ingranaggi: 15 },
        time: { hours: 2 },
        specialization: { Elettronica: 1 }
    },
    // Automazione & Controllo
    {
        id: 'innesco',
        name: 'Innesco',
        category: 'Automazione & Controllo',
        difficulty: 'Facile',
        description: 'Base per attivazione automatica di trappole, meccanismi, circuiti, dispositivi.',
        cost: { ingranaggi: 0 },
        time: { hours: 0 },
        specialization: { Meccanica: 2, Elettronica: 2 },
        note: 'Richiede almeno una delle due specializzazioni.'
    },
    {
        id: 'serratura_codice',
        name: 'Serratura con Codice',
        category: 'Automazione & Controllo',
        difficulty: 'Media',
        description: 'Serratura elettronica con codice statico.',
        cost: { ingranaggi: 25 },
        time: { hours: 6 },
        specialization: { Meccanica: 3 }
    },
    // Difesa & Trappole
    {
        id: 'trappola_a_scatto',
        name: 'Trappola a Scatto',
        category: 'Difesa & Trappole',
        difficulty: 'Difficile',
        description: 'Attivazione: porta/pedana/filo/innesco. Area 2m x 2m. Danni: 3d10. Disinnesco: TS Artificeria CD14.',
        cost: { ingranaggi: 60 },
        time: { hours: 8 },
        specialization: { Meccanica: 3 }
    },
    {
        id: 'trappola_orso',
        name: 'Trappola per orsi',
        category: 'Difesa & Trappole',
        difficulty: 'Facile',
        description: 'Attivazione se calpestata. Effetto: 2d6 danni e immobilizza. Disinnesco CD14 in Artificeria. Si può nascondere con Furtività.',
        cost: { ingranaggi: 20 },
        time: { hours: 2 },
        specialization: { Meccanica: 1 }
    },
    // Balistica, Armi & Munizioni
    {
        id: 'creazione_proiettili',
        name: 'Creazione Proiettili',
        category: 'Balistica, Armi & Munizioni',
        difficulty: 'Facile',
        description: 'Produzione di munizioni (indicazioni per 10 proiettili).',
        variants: [
            { tipo: 'freccia', costo_ing: 1, time_minutes: 20, qty: 10 },
            { tipo: 'dardo_balestra', costo_ing: 3, time_minutes: 30, qty: 10 },
            { tipo: 'proiettile_pistola', costo_ing: 10, time_minutes: 60, qty: 10 }
        ],
        specialization: { Balistica: 1 }
    },
    {
        id: 'taser',
        name: 'Taser',
        category: 'Balistica, Armi & Munizioni',
        difficulty: 'Media',
        description: 'Arma corpo a corpo elettrica. TS COS CD14 o paralizzato 1 turno. Consumo 1 batteria per colpo. Capacità 1 batteria.',
        cost: { ingranaggi: 15 },
        time: { hours: 2 },
        specialization: { Balistica: 2 }
    },
    {
        id: 'proiettile_frammentazione',
        name: 'Proiettile a Frammentazione',
        category: 'Balistica, Armi & Munizioni',
        difficulty: 'Media',
        description: 'Colpisce: +1d10. Mancando esplode area 1m: TS DES CD12 per 1d4 danni. (Pistola non applica esplosione area).',
        cost: { ingranaggi_multiplier: 2 },
        time: { extra_hours: 1 },
        specialization: { Balistica: 3 }
    },
    {
        id: 'pistola_rampino',
        name: 'Pistola Rampino',
        category: 'Balistica, Armi & Munizioni',
        difficulty: 'Media',
        description: 'Raggio 9m, vantaggio Acrobazia su aggancio, attacco 1d4+DES, può agganciare oggetti.',
        cost: { ingranaggi: 30 },
        time: { hours: 4 },
        specialization: { Balistica: 3 }
    },
    {
        id: 'potenziamento_arma',
        name: 'Potenziamento Armi',
        category: 'Balistica, Armi & Munizioni',
        difficulty: 'Media',
        description: 'Bonus permanente +1 al colpire. Max +3 per arma. Costo per +1: 30 ingranaggi + 4 ore.',
        cost_per_level: { ingranaggi: 30, hours: 4 },
        specialization: { Balistica: 3 }
    },
    // Robot & Meccanica Avanzata
    {
        id: 'riparazione_robot',
        name: 'Riparazione Robot',
        category: 'Robot & Meccanica Avanzata',
        difficulty: 'Facile',
        description: 'Riparazione completa di robot.',
        cost: { ingranaggi: 15 },
        time: { hours: 2 },
        specialization: { Meccanica: 1 }
    },
    {
        id: 'potenzia_depotenzia_robot',
        name: 'Potenziare/Depotenziare Robot',
        category: 'Robot & Meccanica Avanzata',
        difficulty: 'Difficile',
        description: 'Aggiunta o rimozione perk da robot. Aggiunta: 15 ing + 1h per punto perk. Rimozione: +10 ing per punto perk, 0.5h per punto.',
        cost: { add_ing_per_point: 15, remove_ing_per_point: 10 },
        time: { add_hours_per_point: 1, remove_hours_per_point: 0.5 },
        specialization: { Meccanica: 5 }
    },
    {
        id: 'smantellamento_totale_robot',
        name: 'Smantellamento Totale Robot',
        category: 'Robot & Meccanica Avanzata',
        difficulty: 'Molto difficile',
        description: 'Robot distrutto definitivamente. Ricompensa: 3d12 + 45 ingranaggi.',
        reward: { ingranaggi_roll: '3d12', bonus: 45 },
        specialization: { Meccanica: 5, Elettronica: 4 }
    },
    // Mobilità & Movimento
    {
        id: 'stivali_a_molla',
        name: 'Stivali a Molla',
        category: 'Mobilità & Movimento',
        difficulty: 'Media',
        description: 'Aumenta salto di +3 metri. 1 salto = 3 cariche (1 batteria = 3 cariche).',
        cost: { ingranaggi: 25 },
        time: { hours: 4 },
        specialization: { Meccanica: 2 }
    },
    // Sopravvivenza & Conservazione
    {
        id: 'frigorifero',
        name: 'Frigorifero',
        category: 'Sopravvivenza & Conservazione',
        difficulty: 'Molto difficile',
        description: 'Capacità 50 razioni; aumenta il tempo di conservazione del 500% e applica conserva automaticamente. Consumo 2 batterie/giorno.',
        capacity: 50,
        cost: { ingranaggi: 80 },
        time: { hours: 16 },
        consumption: { batteries_per_day: 2 },
        specialization: { Elettronica: 4 }
    },
    {
        id: 'postazione_alchimista',
        name: 'Postazione da Alchimista',
        category: 'Sopravvivenza & Conservazione',
        difficulty: 'Facile',
        description: 'Postazione per alchimia.',
        cost: { ingranaggi: 10 },
        time: { hours: 1 },
        specialization: { AG: 1 }
    }
];

export function getArtificerRecipeById(id) {
    return ARTIFICER_RECIPES.find(r => r.id === id) || null;
}

export function listArtificerRecipes() {
    return ARTIFICER_RECIPES.slice();
}
function lootIngranaggi(tiro) {
    if (tiro === 1) return 0;
    if (tiro <= 7) return rollDice(1, 4) + 1;
    if (tiro <= 13) return rollDice(1, 6) + 2;
    if (tiro <= 17) return rollDice(2, 6) + 4;
    if (tiro <= 19) return rollDice(2, 8) + 8;
    return rollDice(2, 12) + 16;
}

function artificeriaPersonaggio(idx) {
    alert('Funzione Artificeria in sviluppo.');
}