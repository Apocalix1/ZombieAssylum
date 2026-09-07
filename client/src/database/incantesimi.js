// incantesimi.js
// Database degli incantesimi/trucchetti conoscibili, organizzati per categoria.
// "modificatore" indica quale caratteristica il manuale richiede per quell'incantesimo
// (informativo: il sistema usa comunque la caratteristica incantatore più alta del personaggio).

window.DATABASE_INCANTESIMI = {
    danni: [
          {
            nome: "Dardo di Fuoco",
            livello: 0,
            modificatore: ["Qualsiasi"],
            azione: "Azione",
            raggio: "9 metri",
            durata: "Istantanea",
            concentrazione: false,
            desc: "Lanci una particella di fuoco contro una creatura o un oggetto entro la gittata. Attacco con incantesimo a distanza: se colpisci, 1d10 danni da fuoco. Un oggetto infiammabile non indossato/trasportato prende fuoco.",
            effetto: { tipo: 'attacco_distanza', danno: '1d10', dannoTipo: 'fuoco' },
            cd: false,
            tiro_abilita:true
        },
          {
            nome:"Fiamma sacra",
            livello:0,
            modificatore:["Saggezza"],
            azione:"Azione",
            raggio:"12 metri",
            durata:"Istantanea",
            concentrazione:false,
            desc:"Un bagliore simile a una fiamma si abbatte su una creatura che puoi vedere entro il raggio d'azione. Il bersaglio deve superare un tiro salvezza su Destrezza o subire 1d8 danni radianti. Il bersaglio non ottiene alcun beneficio dalla copertura per questo tiro salvezza.",
            effetto:{tipo:'fiamma_sacra', durataOre: 1},
            cd:true,
            tiro_abilita:false
        },
        {
            nome: "Fiotto Acido",
            livello: 0,
            modificatore: ["Intelligenza", "Saggezza"],
            azione: "Azione",
            raggio:"12 metri",
            durata: "Istantanea",
            concentrazione: false,
            desc: "Lanci una bolla di acido. Scegli una creatura che puoi vedere entro il raggio d'azione, oppure due creature entro 1,5 metri l'una dall'altra. Un bersaglio deve superare un TS su Destrezza o subire 1d6 danni da acido.",
            effetto: { tipo: 'ts_danno', ts: 'Destrezza', danno: '1d6', dannoTipo: 'acido' },
            cd: true,
            tiro_abilita:true
        },
        {
            nome:"Lama tonante",
            livello:0,
            modificatore:["Qualsiasi"],
            azione:"Azione",
            durata:"1 turno",
            concentrazione: false,
            desc:"Impugna l'arma usata per lanciare l'incantesimo ed effettua un attacco in mischia contro una creatura entro 1,5 metri da te. In caso di successo, il bersaglio subisce gli effetti normali dell'attacco con l'arma e viene avvolto da un'energia rimbombante fino all'inizio del tuo prossimo turno. Se il bersaglio si muove volontariamente di 1,5 metri o più prima di allora, subisce 1d8 danni da tuono e l'incantesimo termina.",
            effetto:{tipo:'attacco_mischia',danno:'1d8',dannoTipo:'tuono'},
            cd:false,
            tiro_abilita:false

        },
        {
            nome:"Puntura abbatente",
            livello:0,
            modificatore:["Intelligenza","Carisma"],
            azione:"Azione",
            raggio:"6 metri",
            durata:"Istantanea",
            concentrazione: false,
            desc:"Assorbi la vitalità di una creatura che puoi vedere entro il raggio d'azione. Il bersaglio deve superare un tiro salvezza su Costituzione o subire 1d4 danni necrotici e cadere prono.",
            effetto:{tipo:'ts_danno', ts:'Costituzione', danno:'1d4', dannoTipo:'necrotici'},
            cd:true,
            tiro_abilita:false
        },
        {
            nome: "Risveglio Primordiale",
            livello: 0,
            modificatore: ["Saggezza"],
            azione: "Azione",
            raggio: "1,5 metri",
            durata: "Istantanea",
            concentrazione: false,
            desc: "Incanali la magia primordiale per affilare denti o unghie. Attacco magico in mischia (1,5m): se colpisci, il bersaglio subisce 1d10 danni da acido. Dopo l'attacco, torni alla normalità.",
            effetto: { tipo: 'attacco_mischia', danno: '1d10', dannoTipo: 'acido' },
            cd: false,
            tiro_abilita:true
        },
        {
            nome: "Sigillo di Protezione",
            livello: 0,
            modificatore: ["Intelligenza"],
            azione: "1 Azione",
            raggio: "Su se stesso",
            durata: "1 turno",
            concentrazione: false,
            desc: "Estendi la mano e tracci un sigillo di protezione nell'aria. Fino alla fine del tuo prossimo turno, hai resistenza al prossimo danno contundente, perforante o tagliente inflitto dagli attacchi con armi.",
            effetto: { tipo: 'buff_resistenza', danniTipo: ['contundenti', 'perforanti', 'taglienti'], durataTurni: 1 },
            cd: false,
            tiro_abilita: false
        },
        {
            nome:"Tocco gelido",
            livello:0,
            modificatore:["Carisma"],
            azione:"Azione",
            raggio:"18 metri",
            durata:"Istantanea",
            concentrazione: false,
            desc:"Crei una mano spettrale e scheletrica nello spazio di una creatura entro la portata. Effettua un attacco magico a distanza contro la creatura per assalirla con il gelo della tomba. Se colpisci, il bersaglio subisce 1d8 danni necrotici e non può recuperare punti ferita fino all'inizio del tuo prossimo turno. Fino ad allora, la mano si aggrappa al bersaglio. Se colpisci un bersaglio non morto, questo subisce anche svantaggio ai tiri per colpire contro di te fino alla fine del tuo prossimo turno.",
            effetto:{tipo:'attacco_distanza',danno:'1d8',dannoTipo:'necrotico'},
            cd:false,
            tiro_abilita:true
        },
    ],
    cura: [],
     utilita: [
          {
            nome: "Comprensione del Linguaggio",
            livello: 1,
            modificatore: ["Qualsiasi"],
            azione: "Azione Bonus",
            raggio: "Su se stesso",
            durata: "1 ora",
            concentrazione: false,
            desc: "Per 1 ora comprendi ogni linguaggio.",
            effetto: { tipo: 'comprensione_linguaggio', durataOre: 1 },
            cd: false,
            tiro_abilita:false
        },
        {
            nome: "Controllare fiamme",
            livello: 0,
            modificatore: ["Carisma"],
            azione: "Azione",
            raggio: "9 metri",
            durata: "Istantanea o fino a 20",
            concentrazione: false,
            desc: "Scegli una fiamma non magica che puoi vedere entro la gittata e che si adatti a un cubo di 1,5 metri di lato. Puoi influenzarla in uno dei seguenti modi: \n 1)Espandi istantaneamente la fiamma di 1,5 metri in una direzione, a condizione che nella nuova posizione sia presente legna o altro combustibile. \n Spegni istantaneamente le fiamme all'interno del cubo. \n Raddoppia o dimezzi l'area di luce intensa e debole proiettata dalla fiamma, ne cambi il colore o entrambi. L'effetto dura 1 ora. \n Fai apparire delle forme semplici, come la sagoma vaga di una creatura, un oggetto inanimato o un luogo, all'interno delle fiamme e animale a tuo piacimento. Le forme durano 20 minuti. \n Puoi accelerare la cottura di un piatto del 20% \n Se lanci questa magia più volte, puoi avere fino a tre dei suoi effetti non istantanei attivi contemporaneamente e puoi annullare tale effetto come azione.",
            effetto: { tipo: 'controllare_fiamme' },
            cd: false,
            tiro_abilita: false
        },
        {
            nome: "Creare cibo e Acqua",
            livello: 3,
            modificatore: ["Intelligenza"],
            azione: "Azione",
            raggio: "9 metri",
            durata: "Istantanea",
            concentrazione: false,
            desc: "Crei fino a 3 unità di cibo e 3 di acqua. Per ogni unità extra oltre alla base, attingi alle tue scorte personali di cibo/acqua con una perdita di efficienza del 15% (consumi 1 unità di riserva per ottenerne 0.85 convertite).",
            effetto: { tipo: 'crea_cibo_acqua', baseCibo: 3, baseAcqua: 3, efficienzaExtra: 0.85 },
            cd: false,
            tiro_abilita:false
        },
        {
            nome:"Guida",
            livello:0,
            modificatore:["Carisma"],
            azione:"Azione",
            raggio:"A contatto",
            durata:"1 minuto",
            concentrazione: true,
            desc:"Tocca una creatura consenziente. Una volta prima che l'incantesimo termini, il bersaglio può tirare un d4 e aggiungere il risultato a una prova di caratteristica a sua scelta. Può tirare il dado prima o dopo aver effettuato la prova di caratteristica. Dopodiché l'incantesimo termina.",
            effetto:{tipo:'guida', durataTurni:10},
            cd:false,
            tiro_abilita:false
        },
        {
            nome:"Riparare",
            livello:0,
            modificatore:["Intelligenza"],
            azione:"Azione",
            raggio:"A contatto",
            durata:"1 minuto",
            concentrazione: false,
            desc:"Questo incantesimo ripara una singola rottura o lacerazione in un oggetto che tocchi. Purché la rottura o la lacerazione non superi i 30 centimetri in nessuna dimensione, la ripari senza lasciare traccia del danno precedente. \n Questo incantesimo può riparare fisicamente un oggetto o una costruzione magica, ma non può ripristinare la magia in tale oggetto. \n Questo incantesimo ti permette di compiere microriparazioni ai Robot anche senza conoscenze di Artificeria. \n Lanciare questo incantesimo mentre smonti un oggetto ti fa in modo che ottieni il 5% in più di ingranaggi- \n Mentre lanciare questo incantesimo mentre crei un oggetto riduce la CA di 1.",
            effetto:{tipo:'riparare'},
            cd:false,
            tiro_abilita:false
        }
    ]
};