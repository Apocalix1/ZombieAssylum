// ricette.js
// Database delle ricette alchemiche
const RICETTE = {
    facile: [
        { nome: "Sali Reidratanti", cd: 12, costo: 6, tempo: 3, desc: "Rimuove un livello di Disidratazione per 4 ore. Non cumulabile.", effetto: { tipo: 'rimuovi_disidratazione', livello: 1, durata: 4 } },
        { nome: "Intruglio Disgustoso", cd: 12, costo: 6, tempo: 3, desc: "Permette di usare l'azione Fiotto Acido due volte entro la fine del combattimento.", effetto: { tipo: 'doppio_fiotto_acido', durata: 'scontro' } },
        { nome: "Cera Inversa", cd: 12, costo: 6, tempo: 3, desc: "Applicata su una parte del corpo emette luce per 1 ora.", effetto: { tipo: 'luce', durata: 1 } },
        { nome: "Colla Istantanea", cd: 12, costo: 6, tempo: 3, desc: "Resina che solidifica: sigilla porte, ripara temporaneamente oggetti o intrappola un nemico (TS Forza CD14 per liberarsi).", effetto: { tipo: 'colla_istantanea', ts: { abilita: 'Forza', cd: 14 }, durata: 0.166 } },
        { nome: "Integratori", cd: 12, costo: 6, tempo: 3, desc: "+3 ai tiri basati su Intelligenza, Saggezza e ai tiri per Studiare per 1 ora.", effetto: { tipo: 'bonus_abilita', bonus: 3, skills: ['Intelligenza', 'Saggezza', 'Studio'], durata: 1 } },
        { nome: "Composto Proteico", cd: 12, costo: 6, tempo: 3, desc: "Per 1 ora ottieni il doppio dei punti esperienza per armi da mischia.", effetto: { tipo: 'xp_mischia_bonus', moltiplicatore: 2, durata: 1 } }
    ],
    media: [
        { nome: "Unguento Coagulante", cd: 16, costo: 12, tempo: 6, desc: "Rimuove l'effetto Sanguinante. Durante medicazione su ferita grave riduce la CD della prova di 4.", effetto: { tipo: 'rimuovi_sanguinante', bonus_med: -4 } },
        { nome: "Bendaggio Coagulante", cd: 16, costo: 12, tempo: 6, desc: "Bende che riducono del 20% il tempo di rigenerazione del prossimo PF Reale.", effetto: { tipo: 'riduzione_tempo_rigenerazione', percent: 20 } },
        { nome: "Tonico Rigenerante", cd: 16, costo: 12, tempo: 6, desc: "Rigenera 1d4 Punti Mana.", effetto: { tipo: 'rigenera_mana', dado: '1d4' } },
        { nome: "Tonico dei Riflessi", cd: 16, costo: 12, tempo: 6, desc: "+3 Iniziativa, +1 CA e +5 PF Fortuna temporanei per 1 ora.", effetto: { tipo: 'bonus_iniziativa_ca_pf', iniziativa: 3, ca: 1, pf: 5, durata: 1 } },
        { nome: "Crema Pietrosa", cd: 16, costo: 12, tempo: 6, desc: "+3 CA contro il prossimo attacco, ma -3m movimento per il turno successivo.", effetto: { tipo: 'crema_pietrosa', ca: 3, slow: 3 } },
        { nome: "Liquido Irritante", cd: 16, costo: 12, tempo: 6, desc: "Lanciabile: TS Costituzione CD15 o lascia cadere l'arma e velocità a 0 per 1 turno.", effetto: { tipo: 'liquido_irritante', ts: { abilita: 'Costituzione', cd: 15 }, durata: 1 } },
        { nome: "Pillole della Calma", cd: 16, costo: 12, tempo: 6, desc: "Riduce la Follia di 1d4. Monodose.", effetto: { tipo: 'riduci_follia', dado: '1d4' } }
    ],
    difficile: [
        { nome: "Adrenalina", cd: 22, costo: 24, tempo: 12, desc: "Ignora debuff/ferite/malus per 2 minuti; al termine incapacitato per 1 ora.", effetto: { tipo: 'adrenalina', durata_min: 2, post_incapacita_h: 1 } },
        { nome: "Allucinogeno", cd: 22, costo: 24, tempo: 12, desc: "Gas/liquido: TS Costituzione CD18 o svantaggio a tutte le prove e +1 Fatica.", effetto: { tipo: 'allucinogeno', ts: { abilita: 'Costituzione', cd: 18 }, fatica: 1 } },
        { nome: "Risveglio Bestiale", cd: 22, costo: 24, tempo: 12, desc: "Raddoppia gli effetti benefici dei Perk Razziali per 1 ora.", effetto: { tipo: 'risveglio_razziale', durata: 1 } },
        { nome: "Essenza di Invisibilità", cd: 22, costo: 24, tempo: 12, desc: "Nuvola gas 1.5m: invisibilità finché non esci o attacchi (3 turni). Percezione/Investigare CD18 per vedere.", effetto: { tipo: 'invisibilita', raggio_m: 1.5, durata_turni: 3, ts_percezione: 18 } },
        { nome: "Neuro-Bloccante", cd: 22, costo: 24, tempo: 12, desc: "Tossina: TS Costituzione CD18 o non può usare Reazioni/Azioni Bonus per 1 ora.", effetto: { tipo: 'neuro_bloccante', ts: { abilita: 'Costituzione', cd: 18 }, durata_h: 1 } },
        { nome: "Antidoto Specifico", cd: 22, costo: 24, tempo: 12, desc: "Richiede 10ml del veleno originale. Tempo sviluppo 12h; produzione successiva richiede tempo e CD di grado Media.", effetto: { tipo: 'antidoto_specifico', richieste: { veleno_ml: 10 }, sviluppo_h: 12 } },
        { nome: "Veleno: Emotossine", cd: 22, costo: 6, tempo: 12, desc: "Veleno: danno massiccio (2d6 danni se il veleno riesce).", effetto: { tipo: 'veleno', sottotipo: 'emotossine', danno: '2d6' } },
        { nome: "Veleno: Neurotossine", cd: 22, costo: 6, tempo: 12, desc: "Paralizza per un turno su fallimento TS.", effetto: { tipo: 'veleno', sottotipo: 'neurotossine', eff: 'paralisi' } },
        { nome: "Veleno: Neurotossine Ottiche", cd: 22, costo: 6, tempo: 12, desc: "Acceca il bersaglio per 1 turno su fallimento.", effetto: { tipo: 'veleno', sottotipo: 'neurotossine_ottiche', eff: 'acceca' } },
        { nome: "Veleno: Allucinogeni", cd: 22, costo: 6, tempo: 12, desc: "Causa Paura per un turno su fallimento.", effetto: { tipo: 'veleno', sottotipo: 'allucinogeni', eff: 'paura' } },
        { nome: "Veleno: Miotossine", cd: 22, costo: 6, tempo: 12, desc: "Danno quando il bersaglio si muove (1d4) per 2 turni.", effetto: { tipo: 'veleno', sottotipo: 'miotossine', danno: '1d4', durata_turni: 2 } },
        { nome: "Veleno: Blocco Respirazione", cd: 22, costo: 6, tempo: 12, desc: "Incapacitato per un turno su fallimento.", effetto: { tipo: 'veleno', sottotipo: 'blocco_respiro', eff: 'incapacita' } },
        { nome: "Veleno: Gestrotossine", cd: 22, costo: 6, tempo: 12, desc: "Immobilizza per un turno su fallimento.", effetto: { tipo: 'veleno', sottotipo: 'gestrotossine', eff: 'immobilizza' } }
    ]
};

// Export compatibile con caricamento diretto nello script globale
window.RICETTE = RICETTE;