// mappa-gen.js
// Generazione procedurale della mappa (1560x1000), lazy e deterministica.
//
// - La mappa è divisa in CHUNK da 48x48 caselle (= 4x4 isolati da 12).
// - Ogni isolato: 2 caselle di strada + 10x10 caselle interne (parco o edifici).
// - Un chunk viene generato (e salvato nel DB) solo quando serve: alla rivelazione
//   di un'area (campo, esplorazione) o su richiesta del Master.
// - Il risultato dipende solo da SEED + coordinate: stessa mappa, sempre.
//   NON cambiare SEED, PITCH, CHUNK dopo la prima generazione.
// - Quello che il Master ha già disegnato a mano non viene mai sovrascritto.

import { GRID_W, GRID_H } from './mappa-config.js';
import { TIPOLOGIE } from './mappa_tipologia.js';

export const SEED = 20260101;
export const CHUNK = 48;
const PITCH = 12;
const STRADA = 2;
const LATO = PITCH - STRADA; // 10
const BLOCCHI_PER_CHUNK = CHUNK / PITCH;

const FUORI = 255, VUOTO = 0, C_STRADA = 1, C_PARCO = 2, C_EDIFICIO = 3;

// Parametri di generazione (modificabili: valgono solo per i chunk NON ancora generati)
const P_PARCO = 0.12;
const DENSITA = [{ d: 0.4, peso: 25 }, { d: 0.6, peso: 45 }, { d: 0.8, peso: 30 }];
const PIANI_PESI = [{ n: 1, peso: 30 }, { n: 2, peso: 30 }, { n: 3, peso: 20 }, { n: 4, peso: 10 }, { n: 5, peso: 6 }, { n: 6, peso: 4 }];
const P_COMMERCIALE_TERRA = 0.75;
const P_COMMERCIALE_SOPRA = 0.12;
const P_ABITAZIONE_IN_COMMERCIALE = 0.2; // piano "misto"

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

// ---------- Edifici ----------
function nuovaAttivita(r, usate) {
  let t, tentativi = 0;
  do {
    t = pesato(r, TIPOLOGIE);
    tentativi++;
  } while (usate.has(t.chiave) && tentativi < 6);
  usate.add(t.chiave);
  let qualita = null;
  if (t.qualita) qualita = pesato(r, t.qualita.map(([k, p]) => ({ k, peso: p }))).k;
  return { categoria: t.chiave, qualita };
}

function costruisciPiano(r, terra) {
  const commerciale = r() < (terra ? P_COMMERCIALE_TERRA : P_COMMERCIALE_SOPRA);
  const attivita = [];
  if (commerciale) {
    const k = terra ? (r() < 0.3 ? 2 : 1) + (r() < 0.08 ? 1 : 0) : 1;
    const usate = new Set();
    for (let i = 0; i < k; i++) attivita.push(nuovaAttivita(r, usate));
    if (r() < P_ABITAZIONE_IN_COMMERCIALE) attivita.push({ categoria: 'abitazione', qualita: null });
  } else {
    const k = 1 + Math.floor(r() * 3);
    for (let i = 0; i < k; i++) attivita.push({ categoria: 'abitazione', qualita: null });
  }
  return { attivita };
}

function tipoPiano(piano) {
  const ab = piano.attivita.some(a => a.categoria === 'abitazione');
  const co = piano.attivita.some(a => a.categoria !== 'abitazione');
  return ab && co ? 'misto' : (ab ? 'abitazione' : 'commerciale');
}

function generaEdificio(r) {
  const n = pesato(r, PIANI_PESI).n;
  const piani = [];
  for (let p = 1; p <= n; p++) piani.push(costruisciPiano(r, p === 1));
  let tutteAbitazioni = piani.every(p => p.attivita.every(a => a.categoria === 'abitazione'));
  // Un "sistema di appartamenti" ha minimo 3 piani
  if (tutteAbitazioni) {
    while (piani.length < 3) piani.push({ attivita: [{ categoria: 'abitazione', qualita: null }] });
  }
  piani.forEach(p => { p.tipo = tipoPiano(p); });
  const tuttiCommerciali = piani.every(p => p.tipo === 'commerciale');
  const tipo = tutteAbitazioni ? 'appartamenti' : (tuttiCommerciali ? 'commerciale' : 'misto');
  return { tipo, piani };
}

function generaBlocco(gx, gy) {
  const r = creaRng(hash(SEED, gx, gy));
  if (r() < P_PARCO) return { parco: true };
  const dens = pesato(r, DENSITA).d;
  const celle = [];
  for (let i = 0; i < LATO * LATO; i++) celle.push(r() < dens ? generaEdificio(r) : null);
  return { parco: false, celle };
}

// ---------- Chunk ----------
export function generaChunk(cx, cy) {
  const x0 = cx * CHUNK, y0 = cy * CHUNK;
  const codici = new Uint8Array(CHUNK * CHUNK).fill(FUORI);
  const edifici = [];

  for (let ly = 0; ly < CHUNK; ly++) {
    for (let lx = 0; lx < CHUNK; lx++) {
      const x = x0 + lx, y = y0 + ly;
      if (x >= GRID_W || y >= GRID_H) continue;
      codici[ly * CHUNK + lx] = (x % PITCH < STRADA || y % PITCH < STRADA) ? C_STRADA : VUOTO;
    }
  }

  for (let by = 0; by < BLOCCHI_PER_CHUNK; by++) {
    for (let bx = 0; bx < BLOCCHI_PER_CHUNK; bx++) {
      const gx = cx * BLOCCHI_PER_CHUNK + bx;
      const gy = cy * BLOCCHI_PER_CHUNK + by;
      const blocco = generaBlocco(gx, gy);
      for (let ly = 0; ly < LATO; ly++) {
        for (let lx = 0; lx < LATO; lx++) {
          const x = gx * PITCH + STRADA + lx;
          const y = gy * PITCH + STRADA + ly;
          if (x >= GRID_W || y >= GRID_H) continue;
          const i = (y - y0) * CHUNK + (x - x0);
          if (blocco.parco) { codici[i] = C_PARCO; continue; }
          const def = blocco.celle[ly * LATO + lx];
          if (def) { codici[i] = C_EDIFICIO; edifici.push({ x, y, def }); }
        }
      }
    }
  }
  return { codici, edifici };
}

// Unisce le caselle adiacenti dello stesso tipo in rettangoli (coordinate locali al chunk)
function rettangoli(codici, codice) {
  const usato = new Uint8Array(CHUNK * CHUNK);
  const out = [];
  for (let y = 0; y < CHUNK; y++) {
    for (let x = 0; x < CHUNK; x++) {
      const i = y * CHUNK + x;
      if (codici[i] !== codice || usato[i]) continue;
      let x2 = x;
      while (x2 + 1 < CHUNK && codici[y * CHUNK + x2 + 1] === codice && !usato[y * CHUNK + x2 + 1]) x2++;
      let y2 = y;
      while (y2 + 1 < CHUNK) {
        let ok = true;
        for (let xx = x; xx <= x2; xx++) {
          const j = (y2 + 1) * CHUNK + xx;
          if (codici[j] !== codice || usato[j]) { ok = false; break; }
        }
        if (!ok) break;
        y2++;
      }
      for (let yy = y; yy <= y2; yy++) for (let xx = x; xx <= x2; xx++) usato[yy * CHUNK + xx] = 1;
      out.push({ codice, x1: x, y1: y, x2, y2 });
    }
  }
  return out;
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

async function _assicuraChunk(db, cx, cy) {
  if (await db.get('SELECT 1 AS ok FROM mappa_chunk WHERE cx = ? AND cy = ?', cx, cy)) return false;

  const { codici, edifici } = generaChunk(cx, cy);
  const x0 = cx * CHUNK, y0 = cy * CHUNK;
  const x1 = x0 + CHUNK - 1, y1 = y0 + CHUNK - 1;

  // Non sovrascrivere ciò che il Master ha già disegnato
  const occ = new Uint8Array(CHUNK * CHUNK);
  const edEsistenti = await db.all('SELECT x, y FROM mappa_edifici WHERE x BETWEEN ? AND ? AND y BETWEEN ? AND ?', x0, x1, y0, y1);
  edEsistenti.forEach(e => { occ[(e.y - y0) * CHUNK + (e.x - x0)] = 1; });
  const zoneEsistenti = await db.all('SELECT x1, y1, x2, y2 FROM mappa_zone WHERE x1 <= ? AND x2 >= ? AND y1 <= ? AND y2 >= ?', x1, x0, y1, y0);
  zoneEsistenti.forEach(z => {
    for (let y = Math.max(z.y1, y0); y <= Math.min(z.y2, y1); y++)
      for (let x = Math.max(z.x1, x0); x <= Math.min(z.x2, x1); x++) occ[(y - y0) * CHUNK + (x - x0)] = 1;
  });
  for (let i = 0; i < occ.length; i++) if (occ[i]) codici[i] = FUORI;
  const daCreare = edifici.filter(e => !occ[(e.y - y0) * CHUNK + (e.x - x0)]);

  await db.run('BEGIN');
  try {
    const rz = [...rettangoli(codici, C_STRADA), ...rettangoli(codici, C_PARCO)];
    await inserisciBatch(db, 'mappa_zone', ['tipo', 'nome', 'x1', 'y1', 'x2', 'y2', 'esplorato'],
      rz.map(r => [r.codice === C_STRADA ? 'strada' : 'parco', null, x0 + r.x1, y0 + r.y1, x0 + r.x2, y0 + r.y2, 0]));

    await inserisciBatch(db, 'mappa_edifici', ['x', 'y', 'nome', 'tipo'],
      daCreare.map(e => [e.x, e.y, null, e.def.tipo]));

    const idRighe = await db.all('SELECT id, x, y FROM mappa_edifici WHERE x BETWEEN ? AND ? AND y BETWEEN ? AND ?', x0, x1, y0, y1);
    const ids = new Map(idRighe.map(r => [`${r.x}:${r.y}`, r.id]));

    const piani = [], att = [];
    daCreare.forEach(e => {
      const id = ids.get(`${e.x}:${e.y}`);
      if (!id) return;
      e.def.piani.forEach((p, i) => {
        piani.push([id, i + 1, p.tipo, 0, '{}', null]);
        p.attivita.forEach(a => att.push([id, i + 1, a.categoria, a.qualita]));
      });
    });
    await inserisciBatch(db, 'mappa_piani', ['edificio_id', 'piano', 'tipo', 'esplorato', 'loot_json', 'grado'], piani);
    await inserisciBatch(db, 'mappa_attivita', ['edificio_id', 'piano', 'categoria', 'qualita'], att);
    await db.run('INSERT INTO mappa_chunk (cx, cy) VALUES (?, ?)', cx, cy);
    await db.run('COMMIT');
  } catch (e) {
    await db.run('ROLLBACK').catch(() => {});
    throw e;
  }
  return true;
}

const limita = (v, a, b) => Math.max(a, Math.min(b, v));

// Garantisce che tutti i chunk che toccano il rettangolo siano generati. Ritorna quanti ne ha creati.
export function assicuraArea(db, x1, y1, x2, y2) {
  x1 = limita(x1, 0, GRID_W - 1); x2 = limita(x2, 0, GRID_W - 1);
  y1 = limita(y1, 0, GRID_H - 1); y2 = limita(y2, 0, GRID_H - 1);
  return seriale(async () => {
    let nuovi = 0;
    for (let cy = Math.floor(y1 / CHUNK); cy <= Math.floor(y2 / CHUNK); cy++)
      for (let cx = Math.floor(x1 / CHUNK); cx <= Math.floor(x2 / CHUNK); cx++)
        if (await _assicuraChunk(db, cx, cy)) nuovi++;
    return nuovi;
  });
}

// ---------- Grado di esplorazione (algoritmo della spec) ----------
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

// Assegna il grado ai piani che non ce l'hanno ancora, nel rettangolo (alla "scoperta").
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