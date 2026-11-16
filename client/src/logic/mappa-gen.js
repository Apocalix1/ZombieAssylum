// mappa-gen.js
// Generazione procedurale a BLOCCHI (lazy e deterministica).
//
// - La mappa è una griglia di strade da 1 casella che racchiudono blocchi da 2x2 a 5x5.
// - Un blocco viene generato (strade intorno + edifici dentro) solo quando un'area che lo tocca viene rivelata.
// - Tutto dipende solo da SEED + indici del blocco: stesso risultato, in qualunque ordine.
//   NON cambiare SEED o la logica di costruisciAsse dopo la prima generazione.
// - I parchi non si generano mai: li disegna il master. Le caselle già occupate non vengono toccate.

import { GRID_W, GRID_H } from './mappa-config.js';
import { TIPOLOGIE } from './mappa_tipologia.js';

export const SEED = 20260101;
// Le suddivisioni si calcolano ben oltre i limiti: allargare la mappa non le cambia.
const MAX_ASSE = 4096;

// Edifici
const P_PALAZZO = 60;        // % palazzo a 2 piani
const P_APPARTAMENTI = 30;   // % sistema di appartamenti (il resto, 10%, sono gli speciali)
const SPECIALI = [{ chiave: 'hotel', peso: 40 }, { chiave: 'conservazione', peso: 5 }]; // % sugli speciali; il resto = palazzo
const PALAZZO_ABITAZIONI = [{ n: 1, peso: 60 }, { n: 2, peso: 30 }, { n: 3, peso: 10 }];
const APP_PIANI = [{ n: 3, peso: 40 }, { n: 4, peso: 30 }, { n: 5, peso: 20 }, { n: 6, peso: 10 }];
const APP_PER_PIANO = [{ n: 2, peso: 50 }, { n: 3, peso: 30 }, { n: 4, peso: 20 }];
const P_ATTIVITA_APPARTAMENTI = 0.4;
const ABITAZIONI_PER_CELLA = 6;
const FORME = { 1: [[1, 1]], 2: [[2, 1], [1, 2]], 3: [[3, 1], [1, 3]], 4: [[2, 2], [4, 1], [1, 4]] };

// ---------- RNG deterministico ----------
function hash(...valori) {
  let h = 2166136261;
  for (const v of valori) {
    h ^= (v | 0) + 0x9e3779b9;
    h = Math.imul(h, 16777619);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

function creaRng(seme) {
  let a = seme | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pesato(r, voci, peso = v => v.peso) {
  const tot = voci.reduce((s, v) => s + peso(v), 0);
  let x = r() * tot;
  for (const v of voci) {
    x -= peso(v);
    if (x < 0) return v;
  }
  return voci[voci.length - 1];
}

// ---------- Griglia dei blocchi ----------
// Per ogni asse: strade[k] = coordinata della k-esima strada; blocchi[k] = intervallo subito dopo.
function costruisciAsse(seme) {
  const r = creaRng(seme);
  const strade = [], blocchi = [];
  let pos = 0;
  while (pos < MAX_ASSE) {
    strade.push(pos);
    pos += 1;
    const dim = 2 + Math.floor(r() * 4); // 2..5
    blocchi.push({ a: pos, b: pos + dim - 1 });
    pos += dim;
  }
  return { strade, blocchi };
}
const ASSE_X = costruisciAsse(hash(SEED, 1));
const ASSE_Y = costruisciAsse(hash(SEED, 2));

// Indici dei blocchi che intersecano [v1, v2]
function blocchiTra(asse, v1, v2) {
  let lo = 0, hi = asse.blocchi.length - 1, primo = asse.blocchi.length;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (asse.blocchi[m].b >= v1) { primo = m; hi = m - 1; } else lo = m + 1;
  }
  const out = [];
  for (let i = primo; i < asse.blocchi.length && asse.blocchi[i].a <= v2; i++) out.push(i);
  return out;
}

// ---------- Edifici ----------
function nuovaAttivita(r) {
  const t = pesato(r, TIPOLOGIE);
  let qualita = null;
  if (t.qualita) qualita = pesato(r, t.qualita.map(([k, p]) => ({ k, peso: p }))).k;
  return { categoria: t.chiave, qualita };
}

const abitazioni = n => Array.from({ length: n }, () => ({ categoria: 'abitazione', qualita: null }));

function generaPalazzo(r) {
  return {
    tipo: 'misto',
    celle: 1,
    piani: [
      { tipo: 'commerciale', attivita: [nuovaAttivita(r)] },
      { tipo: 'abitazione', attivita: abitazioni(pesato(r, PALAZZO_ABITAZIONI).n) }
    ]
  };
}

function generaAppartamenti(r) {
  const n = pesato(r, APP_PIANI).n;
  const perPiano = pesato(r, APP_PER_PIANO).n;
  const conAttivita = r() < P_ATTIVITA_APPARTAMENTI;
  const piani = [];
  for (let p = 1; p <= n; p++) {
    if (p === 1 && conAttivita) piani.push({ tipo: 'commerciale', attivita: [nuovaAttivita(r)] });
    else piani.push({ tipo: 'abitazione', attivita: abitazioni(perPiano) });
  }
  const totale = perPiano * (conAttivita ? n - 1 : n);
  return {
    tipo: conAttivita ? 'misto' : 'appartamenti',
    celle: Math.max(1, Math.ceil(totale / ABITAZIONI_PER_CELLA)),
    piani
  };
}

function generaSpeciale(chiave) {
  return {
    tipo: 'commerciale',
    celle: 1,
    piani: [{ tipo: 'commerciale', attivita: [{ categoria: chiave, qualita: null }] }]
  };
}

function generaEdificio(r) {
  const x = r() * 100;
  if (x < P_PALAZZO) return generaPalazzo(r);
  if (x < P_PALAZZO + P_APPARTAMENTI) return generaAppartamenti(r);
  const s = r() * 100;
  let acc = 0;
  for (const sp of SPECIALI) {
    acc += sp.peso;
    if (s < acc) return generaSpeciale(sp.chiave);
  }
  return generaPalazzo(r); // quota degli speciali non ancora definita
}

// Prova le forme possibili con l'angolo in (lx, ly); null se non ci sta
function trovaForma(celle, lx, ly, w, h, occ, r) {
  const forme = FORME[celle] || [[1, 1]];
  const start = Math.floor(r() * forme.length);
  for (let k = 0; k < forme.length; k++) {
    const [fw, fh] = forme[(start + k) % forme.length];
    if (lx + fw > w || ly + fh > h) continue;
    let libero = true;
    for (let dy = 0; dy < fh && libero; dy++)
      for (let dx = 0; dx < fw; dx++)
        if (occ[(ly + dy) * w + lx + dx]) { libero = false; break; }
    if (libero) return [fw, fh];
  }
  return null;
}

// Riempie il blocco (occ = celle già occupate, viene aggiornato). Coordinate assolute nel risultato.
function edificiDelBlocco(bi, bj, occ) {
  const X = ASSE_X.blocchi[bi], Y = ASSE_Y.blocchi[bj];
  const w = X.b - X.a + 1, h = Y.b - Y.a + 1;
  const r = creaRng(hash(SEED, bi, bj));
  const out = [];
  for (let ly = 0; ly < h; ly++) {
    for (let lx = 0; lx < w; lx++) {
      if (occ[ly * w + lx]) continue;
      let def = generaEdificio(r);
      let forma = def.celle > 1 ? trovaForma(def.celle, lx, ly, w, h, occ, r) : [1, 1];
      if (!forma) { def = generaPalazzo(r); forma = [1, 1]; } // non ci sta: ripiega su un palazzo da 1 casella
      for (let dy = 0; dy < forma[1]; dy++)
        for (let dx = 0; dx < forma[0]; dx++) occ[(ly + dy) * w + lx + dx] = 1;
      out.push({ x: X.a + lx, y: Y.a + ly, w: forma[0], h: forma[1], def });
    }
  }
  return out;
}

// ---------- Strade ----------
// Unità di strada (ognuna registrata una sola volta, così blocchi vicini non duplicano):
//  'H' (riga m, colonna di blocchi i): y = strada m, da x = strada i fino alla fine del blocco i
//  'V' (colonna k, riga di blocchi j): x = strada k, lungo l'altezza del blocco j
function rettangoloStrada(tipo, a, b) {
  if (tipo === 'H') {
    const bl = ASSE_X.blocchi[b], y = ASSE_Y.strade[a];
    if (!bl || y === undefined) return null;
    return { x1: ASSE_X.strade[b], y1: y, x2: bl.b, y2: y };
  }
  const bl = ASSE_Y.blocchi[b], x = ASSE_X.strade[a];
  if (!bl || x === undefined) return null;
  return { x1: x, y1: bl.a, x2: x, y2: bl.b };
}

async function _assicuraStrada(db, tipo, a, b) {
  const rc = rettangoloStrada(tipo, a, b);
  if (!rc) return;
  const x1 = Math.max(0, rc.x1), y1 = Math.max(0, rc.y1);
  const x2 = Math.min(GRID_W - 1, rc.x2), y2 = Math.min(GRID_H - 1, rc.y2);
  if (x1 > x2 || y1 > y2) return;
  const r = await db.run('INSERT OR IGNORE INTO mappa_strade_gen (tipo, a, b) VALUES (?, ?, ?)', tipo, a, b);
  if (!r.changes) return;
  await db.run("INSERT INTO mappa_zone (tipo, nome, x1, y1, x2, y2, esplorato) VALUES ('strada', NULL, ?, ?, ?, ?, 0)", x1, y1, x2, y2);
}

// ---------- Persistenza ----------
let coda = Promise.resolve();
function seriale(fn) {
  const p = coda.then(fn);
  coda = p.catch(() => {});
  return p;
}

async function inserisciBatch(db, tabella, colonne, righe, max = 100) {
  for (let i = 0; i < righe.length; i += max) {
    const parte = righe.slice(i, i + max);
    const ph = parte.map(() => `(${colonne.map(() => '?').join(',')})`).join(',');
    await db.run(`INSERT INTO ${tabella} (${colonne.join(',')}) VALUES ${ph}`, ...parte.flat());
  }
}

async function _assicuraBlocco(db, bi, bj) {
  if (await db.get('SELECT 1 AS ok FROM mappa_blocchi WHERE bi = ? AND bj = ?', bi, bj)) return false;
  const X = ASSE_X.blocchi[bi], Y = ASSE_Y.blocchi[bj];
  if (!X || !Y) return false;
  const w = X.b - X.a + 1, h = Y.b - Y.a + 1;

  // Caselle già occupate: edifici e zone esistenti (parchi del master compresi) e celle fuori griglia
  const occ = new Uint8Array(w * h);
  const segna = (x1, y1, x2, y2) => {
    for (let y = Math.max(y1, Y.a); y <= Math.min(y2, Y.b); y++)
      for (let x = Math.max(x1, X.a); x <= Math.min(x2, X.b); x++) occ[(y - Y.a) * w + (x - X.a)] = 1;
  };
  const ed = await db.all('SELECT x, y, w, h FROM mappa_edifici WHERE x <= ? AND x + w - 1 >= ? AND y <= ? AND y + h - 1 >= ?', X.b, X.a, Y.b, Y.a);
  ed.forEach(e => segna(e.x, e.y, e.x + e.w - 1, e.y + e.h - 1));
  const zone = await db.all('SELECT x1, y1, x2, y2 FROM mappa_zone WHERE x1 <= ? AND x2 >= ? AND y1 <= ? AND y2 >= ?', X.b, X.a, Y.b, Y.a);
  zone.forEach(z => segna(z.x1, z.y1, z.x2, z.y2));
  for (let ly = 0; ly < h; ly++)
    for (let lx = 0; lx < w; lx++)
      if (X.a + lx >= GRID_W || Y.a + ly >= GRID_H) occ[ly * w + lx] = 1;

  const nuovi = edificiDelBlocco(bi, bj, occ);

  await db.run('BEGIN');
  try {
    // 1) prima la struttura stradale che circonda il blocco
    const unita = [
      ['H', bj, bi], ['H', bj, bi + 1], ['H', bj + 1, bi], ['H', bj + 1, bi + 1],
      ['V', bi, bj], ['V', bi + 1, bj]
    ];
    for (const [tipo, a, b] of unita) await _assicuraStrada(db, tipo, a, b);

    // 2) poi gli edifici dentro il blocco
    await inserisciBatch(db, 'mappa_edifici', ['x', 'y', 'nome', 'tipo', 'w', 'h'],
      nuovi.map(e => [e.x, e.y, null, e.def.tipo, e.w, e.h]));

    const idRighe = await db.all('SELECT id, x, y FROM mappa_edifici WHERE x BETWEEN ? AND ? AND y BETWEEN ? AND ?', X.a, X.b, Y.a, Y.b);
    const ids = new Map(idRighe.map(r => [`${r.x}:${r.y}`, r.id]));

    const piani = [], att = [];
    nuovi.forEach(e => {
      const id = ids.get(`${e.x}:${e.y}`);
      if (!id) return;
      e.def.piani.forEach((p, i) => {
        piani.push([id, i + 1, p.tipo, 0, '{}', null]);
        p.attivita.forEach(a => att.push([id, i + 1, a.categoria, a.qualita]));
      });
    });
    await inserisciBatch(db, 'mappa_piani', ['edificio_id', 'piano', 'tipo', 'esplorato', 'loot_json', 'grado'], piani);
    await inserisciBatch(db, 'mappa_attivita', ['edificio_id', 'piano', 'categoria', 'qualita'], att);
    await db.run('INSERT INTO mappa_blocchi (bi, bj) VALUES (?, ?)', bi, bj);
    await db.run('COMMIT');
  } catch (e) {
    await db.run('ROLLBACK').catch(() => {});
    throw e;
  }
  return true;
}

const limita = (v, a, b) => Math.max(a, Math.min(b, v));

// Genera i blocchi che toccano il rettangolo (+1 casella di margine, per le strade di bordo).
// Ritorna quanti blocchi ha creato.
export function assicuraArea(db, x1, y1, x2, y2) {
  x1 = limita(x1 - 1, 0, GRID_W - 1); x2 = limita(x2 + 1, 0, GRID_W - 1);
  y1 = limita(y1 - 1, 0, GRID_H - 1); y2 = limita(y2 + 1, 0, GRID_H - 1);
  return seriale(async () => {
    let nuovi = 0;
    for (const bj of blocchiTra(ASSE_Y, y1, y2))
      for (const bi of blocchiTra(ASSE_X, x1, x2))
        if (await _assicuraBlocco(db, bi, bj)) nuovi++;
    return nuovi;
  });
}

// ---------- Grado di esplorazione (invariato) ----------
export function probabilitaGradi(giorno) {
  const t = Math.max(0, (giorno - 7) / 23);
  const w100 = Math.max(0, 40 * (1 - 0.5 * t));
  const w70 = Math.max(0, 35 * (1 - 0.75 * t));
  const w50 = 20 * (1 + 0.5 * t);
  const w20 = 5 * (1 + 0.25 * t);
  const s = w100 + w70 + w50 + w20;
  return { 100: w100 / s * 100, 70: w70 / s * 100, 50: w50 / s * 100, 20: w20 / s * 100 };
}

export function rollGrado(giorno) {
  const p = probabilitaGradi(giorno);
  const r = Math.random() * 100;
  if (r <= p[100]) return 100;
  if (r <= p[100] + p[70]) return 70;
  if (r <= p[100] + p[70] + p[50]) return 50;
  return 20;
}

export async function assegnaGradi(db, x1, y1, x2, y2) {
  const m = await db.get('SELECT ore_totali FROM mondo WHERE id = 1');
  const giorno = Math.floor((m?.ore_totali || 0) / 24);
  const righe = await db.all(
    `SELECT p.rowid AS rid FROM mappa_piani p JOIN mappa_edifici e ON e.id = p.edificio_id
     WHERE p.grado IS NULL AND e.x BETWEEN ? AND ? AND e.y BETWEEN ? AND ?`, x1, x2, y1, y2);
  const per = new Map();
  righe.forEach(r => {
    const g = rollGrado(giorno);
    if (!per.has(g)) per.set(g, []);
    per.get(g).push(r.rid);
  });
  for (const [g, rids] of per) {
    for (let i = 0; i < rids.length; i += 500) {
      const parte = rids.slice(i, i + 500);
      await db.run(`UPDATE mappa_piani SET grado = ? WHERE grado IS NULL AND rowid IN (${parte.map(() => '?').join(',')})`, g, ...parte);
    }
  }
}