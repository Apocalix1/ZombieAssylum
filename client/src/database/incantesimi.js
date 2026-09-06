// incantesimi.js
// Database degli incantesimi/trucchetti conoscibili, organizzati per categoria.
// "modificatore" indica quale caratteristica il manuale richiede per quell'incantesimo
// (informativo: il sistema usa comunque la caratteristica incantatore più alta del personaggio).

window.DATABASE_INCANTESIMI = {
    danni: [
        {
            nome: "Fiotto Acido",
            livello: 0,
            modificatore: ["Intelligenza", "Saggezza"],
            azione: "Azione",
            durata: "Istantanea",
            desc: "Lanci una bolla di acido. Scegli una creatura che puoi vedere entro il raggio d'azione, oppure due creature entro 1,5 metri l'una dall'altra. Un bersaglio deve superare un TS su Destrezza o subire 1d6 danni da acido.",
            effetto: { tipo: 'ts_danno', ts: 'Destrezza', danno: '1d6', dannoTipo: 'acido' },
            cd: true,
            tiro_abilita:true
        },
        {
            nome: "Sigillo di Protezione",
            livello: 0,
            modificatore: ["Intelligenza"],
            azione: "1 Azione",
            durata: "1 turno",
            desc: "Estendi la mano e tracci un sigillo di protezione nell'aria. Fino alla fine del tuo prossimo turno, hai resistenza ai danni contundenti, perforanti e taglienti inflitti dagli attacchi con armi.",
            effetto: { tipo: 'buff_resistenza', danniTipo: ['contundenti', 'perforanti', 'taglienti'], durataTurni: 1 },
            cd: false,
            tiro_abilita: false
        },
        {
            nome: "Risveglio Primordiale",
            livello: 0,
            modificatore: ["Saggezza"],
            azione: "Azione",
            durata: "Istantanea",
            desc: "Incanali la magia primordiale per affilare denti o unghie. Attacco magico in mischia (1,5m): se colpisci, il bersaglio subisce 1d10 danni da acido. Dopo l'attacco, torni alla normalità.",
            effetto: { tipo: 'attacco_mischia', danno: '1d10', dannoTipo: 'acido' },
            cd: false,
            tiro_abilita:true
        },
        {
            nome: "Dardo di Fuoco",
            livello: 0,
            modificatore: ["Qualsiasi"],
            azione: "Azione",
            durata: "Istantanea",
            desc: "Lanci una particella di fuoco contro una creatura o un oggetto entro la gittata. Attacco con incantesimo a distanza: se colpisci, 1d10 danni da fuoco. Un oggetto infiammabile non indossato/trasportato prende fuoco.",
            effetto: { tipo: 'attacco_distanza', danno: '1d10', dannoTipo: 'fuoco' },
            cd: false,
            tiro_abilita:true
        }
    ],
    cura: [],
     utilita: [
        {
            nome: "Creare cibo e Acqua",
            livello: 3,
            modificatore: ["Intelligenza"],
            azione: "Azione",
            raggio: "9 metri",
            durata: "Istantanea",
            desc: "Crei fino a 3 unità di cibo e 3 di acqua. Per ogni unità extra oltre alla base, attingi alle tue scorte personali di cibo/acqua con una perdita di efficienza del 15% (consumi 1 unità di riserva per ottenerne 0.85 convertite).",
            effetto: { tipo: 'crea_cibo_acqua', baseCibo: 3, baseAcqua: 3, efficienzaExtra: 0.85 },
            cd: false,
            tiro_abilita:false
        },
        {
            nome: "Comprensione del Linguaggio",
            livello: 1,
            modificatore: ["Intelligenza"],
            azione: "Azione Bonus",
            raggio: "Su se stesso",
            durata: "1 ora",
            desc: "Per 1 ora comprendi ogni linguaggio.",
            effetto: { tipo: 'comprensione_linguaggio', durataOre: 1 },
             cd: false,
            tiro_abilita:false
        }
    ]
};