// mappa-tipologie.js
// Tipologie di attività commerciali generabili. I pesi sono quelli della spec:
// vengono normalizzati, quindi non serve che sommino a 100.
// Le abitazioni NON sono qui: sono una categoria a parte ('abitazione').
// TODO: quando arriva l'elenco delle abitazioni, aggiungere i sottotipi in ABITAZIONI.
 
export const TIPOLOGIE = [
  { chiave: 'alimentari',     nome: 'Alimentari, ristoranti e artigiani', peso: 22 },
  { chiave: 'taverna',        nome: 'Taverna',                            peso: 9 },
  { chiave: 'vestiti',        nome: 'Negozio di vestiti / sartoria',      peso: 7.5 },
  { chiave: 'parrucchiere',   nome: 'Parrucchiere / barbiere',            peso: 2 },
  { chiave: 'hotel',          nome: 'Hotel',                              peso: 2 },
  { chiave: 'biblioteca',     nome: 'Biblioteca / libreria',              peso: 8 },
  { chiave: 'farmacia',       nome: 'Farmacia',                           peso: 5 },
  { chiave: 'comp_alchemici', nome: 'Componenti alchemici',               peso: 4 },
  { chiave: 'pozioni',        nome: 'Negozio di pozioni',                 peso: 2.5 },
  { chiave: 'ospedale',       nome: 'Ospedale / clinica privata',         peso: 4 },
  { chiave: 'conservazione',  nome: 'Centro di conservazione',            peso: 0.5 },
  { chiave: 'armi',           nome: 'Negozio di armi',                    peso: 8 },
  {
    chiave: 'artefatti', nome: 'Negozio di artefatti magici', peso: 8.5,
    qualita: [['bassa', 6], ['media', 2], ['alta', 0.5]]
  },
  { chiave: 'forgia',         nome: 'Forgia / officina',                  peso: 5 },
  { chiave: 'palestra',       nome: 'Palestra / dojo',                    peso: 4 },
  { chiave: 'cimeli',         nome: 'Cimeli e antiquariato',              peso: 4 },
  { chiave: 'animali',        nome: 'Animali e componenti animali',       peso: 2 }
];
 
export const ABITAZIONI = []; // sottotipi di abitazione (da definire)
 
export const CATEGORIE_VALIDE = new Set(['abitazione', ...TIPOLOGIE.map(t => t.chiave)]);
 