export const GRID_W = 1560;
export const GRID_H = 1000;
export const QUARTIERE = 1000;
export const TILE = 100;

export const TIPI_ZONA = ['parco', 'strada'];
export const TIPI_EDIFICIO = ['appartamenti', 'commerciale', 'misto'];
export const TIPI_PIANO = ['abitazione', 'commerciale', 'misto'];

export const MIN_PIANI = { appartamenti: 3, commerciale:2};

export const ESPLORAZIONE = {
  0: 'Ignoto',
  1: 'Parziale',
  2: 'Esplorato'
};

export const TIPOLOGIE = [
  { chiave: 'abitazione', nome: 'Abitazione' },
  { chiave: 'commerciale', nome: 'Commerciale', qualita: [['bassa', 'Bassa'], ['media', 'Media'], ['alta', 'Alta']] },
  { chiave: 'misto', nome: 'Misto', qualita: [['bassa', 'Bassa'], ['media', 'Media'], ['alta', 'Alta']] }
];

export const CATEGORIE_VALIDE = new Set(TIPOLOGIE.map(t => t.chiave));

export const RAGGIO_CAMPO_DEFAULT = 10;
