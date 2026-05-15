// artificeria.js
// Database semplificato degli oggetti creabili con Artificeria
const ARTIFICERIA_RECIPES = [
    // ENERGIA & BATTERIE
    { nome: 'Creazione Batterie', categoria: 'batterie', difficolta: 'Facile', cdBase: 14, costoIng: 2, tempoOrePerBatch: 1, note: '2 ing per batch; resa variabile per rarità', spec: 'elettronica', specLevel: 1 },
    { nome: 'Estrazione Energia dai Robot', categoria: 'batterie', difficolta: 'Molto difficile', cdBase: 36, costoIng: 2, tempoOrePerBattery: 1/60, note: '1 ora per batteria; ogni 3 perse 1', spec: 'elettronica', specLevel: 4, extraSpec: { meccanica:5 } },

    // COMUNICAZIONI & SENSORI
    { nome: 'Orologio/Timer', categoria: 'sistemi', difficolta: 'Facile', cdBase: 14, costoIng: 5, tempoOre: 1, spec: 'elettronica', specLevel: 1 },
    { nome: 'Sistema di Telecamere (stazione)', categoria: 'sistemi', difficolta: 'Molto difficile', cdBase: 36, costoIng: 60, tempoOre: 12, spec: 'elettronica', specLevel: 5, extraSpec: { meccanica:2 } },
    { nome: 'Localizzatore (trasmettitore+ricevitore)', categoria: 'sistemi', difficolta: 'Difficile', cdBase: 24, costoIng: 25, tempoOre: 6, spec: 'elettronica', specLevel: 3 },

    // ILLUMINAZIONE & OTTICA
    { nome: 'Torcia Direzionale', categoria: 'illuminazione', difficolta: 'Facile', cdBase: 14, costoIng: 10, tempoOre: 2, spec: 'elettronica', specLevel: 1 },
    { nome: 'Binocolo', categoria: 'ottica', difficolta: 'Facile', cdBase: 14, costoIng: 10, tempoOre: 1, spec: 'balistica', specLevel: 1 },

    // SUONO
    { nome: 'Cassa Amplificata', categoria: 'audio', difficolta: 'Facile', cdBase: 14, costoIng: 15, tempoOre: 2, spec: 'elettronica', specLevel: 1 },

    // AUTOMAZIONE
    { nome: 'Innesco', categoria: 'meccanismi', difficolta: 'Facile', cdBase: 14, costoIng: 5, tempoOre: 1, spec: 'meccanica', specLevel: 2 },
    { nome: 'Serratura con Codice', categoria: 'sicurezza', difficolta: 'Media', cdBase: 20, costoIng: 25, tempoOre: 6, spec: 'meccanica', specLevel: 3 },

    // TRAPPOLE
    { nome: 'Trappola a Scatto', categoria: 'trappole', difficolta: 'Difficile', cdBase: 24, costoIng: 60, tempoOre: 8, spec: 'meccanica', specLevel: 3 },
    { nome: 'Trappola per orso', categoria: 'trappole', difficolta: 'Facile', cdBase: 14, costoIng: 20, tempoOre: 2, spec: 'meccanica', specLevel: 1 },

    // BALISTICA & MUNIZIONI
    { nome: 'Creazione Proiettili - Freccia', categoria: 'munizioni', difficolta: 'Facile', cdBase: 14, costoIng: 1, tempoOre: 0.33, spec: 'balistica', specLevel: 1 },
    { nome: 'Pistola Rampino', categoria: 'armi', difficolta: 'Media', cdBase: 20, costoIng: 30, tempoOre: 4, spec: 'balistica', specLevel: 3 },

    // ROBOT & MECCANICA
    { nome: 'Riparazione Robot', categoria: 'robot', difficolta: 'Facile', cdBase: 14, costoIng: 15, tempoOre: 2, spec: 'meccanica', specLevel: 1 },
    { nome: 'Smantellamento Totale Robot', categoria: 'robot', difficolta: 'Molto difficile', cdBase: 36, costoIng: 0, tempoOre: 12, spec: 'meccanica', specLevel: 5, extraSpec: { elettronica:4 } },

    // MOBILITÀ
    { nome: 'Stivali a Molla', categoria: 'mobilita', difficolta: 'Media', cdBase: 20, costoIng: 25, tempoOre: 4, spec: 'meccanica', specLevel: 2 },

    // FRIGORIFERO
    { nome: 'Frigorifero', categoria: 'survivability', difficolta: 'Molto difficile', cdBase: 36, costoIng: 80, tempoOre: 16, spec: 'elettronica', specLevel: 4 },

    // Postazione da Alchimista (creabile anche via Artificeria)
    { nome: 'Postazione da Alchimista', categoria: 'postazioni', difficolta: 'Facile', cdBase: 14, costoIng: 10, tempoOre: 1, spec: 'meccanica', specLevel: 1 }
];

window.ARTIFICERIA_RECIPES = ARTIFICERIA_RECIPES;
