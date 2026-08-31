// oggetti_magici.js
// Pool di oggetti magici estraibili in esplorazione, per rarità.
// Ogni oggetto ha: cariche massime, effetto, forma base (a cosa si riduce a cariche esaurite).

window.DATABASE_OGGETTI_MAGICI = {
    comune: [
        {
            id: 'bisturi_stabilizzante',
            nome: 'Bisturi Stabilizzante',
            rarita: 'comune',
            cariche: 3,
            effetto: { tipo: 'bonus_medicina', bersaglioStati: ['Funzionalità a rischio', 'Rischio di morte'], bonus: 2 },
            desc: 'Dà +2 ai tiri per medicare soggetti a Rischio funzionalità o Rischio di morte.',
            formaBase: { chiave: 'medBase', quantita: 1 },
            riutilizzabileFormaBase: true
        },
        {
            id: 'mestolo_addolcente',
            nome: 'Mestolo Addolcente',
            rarita: 'comune',
            cariche: 5,
            effetto: { tipo: 'bonus_follia_deliziosi', percentuale: 0.5 },
            desc: 'Aumenta del 50% la Follia ridotta mangiando un piatto delizioso.',
            formaBase: { chiave: 'alchemici', quantita: 2 },
            riutilizzabileFormaBase: true
        }
    ],
        non_comune: [
        {
            id: 'benda_accellerante',
            nome: 'Benda Accellerante',
            rarita: 'non_comune',
            cariche: 1,
            effetto: { tipo: 'guarigione_accelerata', percentuale: 0.15, fameExtraPercentuale: 0.10, durataOre: 48 },
            desc: 'Accelera la guarigione del 15% ma consuma la fame il 10% più velocemente, per 48h.',
            formaBase: { chiave: 'medBase', quantita: 2 },
            riutilizzabileFormaBase: false
        },
        {
            id: 'assaporatore',
            nome: 'Assaporatore',
            rarita: 'non_comune',
            cariche: 3,
            effetto: { tipo: 'evita_follia_avariato' },
            desc: 'Quando stai per mangiare cibo avariato, puoi usare una carica per non acquisire Follia da quel pasto.',
            formaBase: { chiave: 'ingranaggi', quantita: 2 },
            riutilizzabileFormaBase: true
        }
    ],
    raro: [
        {
            id: 'stabilizzatore_automatico',
            nome: 'Stabilizzatore Automatico',
            rarita: 'raro',
            cariche: 1,
            effetto: { tipo: 'auto_stabilizza', durataOre: 2 },
            desc: 'Si attiva automaticamente se il possessore scende a 1 PF Reale: lo stabilizza, la ferita non degenera per 2 ore.',
            formaBase: { chiave: 'medCritici', quantita: 1 },
            riutilizzabileFormaBase: false
        },
        {
            id: 'igienizzatore_magico',
            nome: 'Igienizzatore',
            rarita: 'raro',
            cariche: 3,
            effetto: { tipo: 'igienizza_magica', durataAzioneOre: 4, durataEffettoOre: 24, riduzioneCD: 4 },
            desc: 'Igienizza una stanza rendendo operazioni e medicazioni più sicure. Dopo 4 ore d\'uso nella base i CD per guarire sono ridotti di 4 (non sommabile col beneficio di Ossessione del Pulito).',
            formaBase: [
                { chiave: 'alchemici', quantita: 5 },
                { chiave: 'medBase', quantita: 3 }
            ],
            riutilizzabileFormaBase: true
        },
        {
            id: 'specchio_meraviglioso',
            nome: 'Specchio Meraviglioso',
            rarita: 'raro',
            cariche: 3,
            effetto: { tipo: 'cammuffa_gratis' },
            desc: 'Puoi usare una carica per lanciare Cammuffare Se Stesso senza consumare Mana.',
            formaBase: { chiave: 'ingranaggi', quantita: 4 },
            riutilizzabileFormaBase: true
        }
    ],
    super_raro: [
        {
            id: 'spada_della_follia',
            nome: 'Spada della Follia',
            rarita: 'super_raro',
            cariche: 1,
            effetto: { tipo: 'arma_maledetta', bonusDannoMetaFolliaBersaglio: true, folliaOgniOre: 6, folliaDado: '1d6' },
            desc: 'Prende forza dalla instabilità mentale di chi la usa: ogni colpo somma un bonus danno pari alla metà della Follia attuale del bersaglio. Forgiata con un patto demoniaco: ogni 6 ore trascorse nell\'inventario, la Follia del possessore aumenta di 1d6.',
            formaBaseArma: 'Spada',
            riutilizzabileFormaBase: true
        }
    ]
};

window.RARITY_LABELS = { comune: 'Comune', non_comune: 'Non Comune', raro: 'Raro', super_raro: 'Super Raro' };

// Ore recuperate da un robot che assorbe un oggetto a cariche piene, per rarità (coerente con absorbMagicItem esistente)
window.OGGETTI_MAGICI_ORE_ROBOT = { comune: 8, non_comune: 16, raro: 32, super_raro: 64 };
// Batterie prodotte da un oggetto a cariche piene, per rarità (coerente con ricetta Creazione Batterie)
window.OGGETTI_MAGICI_RESA_BATTERIE = { comune: 5, non_comune: 10, raro: 25, super_raro: 55 };