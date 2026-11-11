// mappa-campo.js
// Conoscenza (fog of war) per campo + API della mappa vista dai giocatori.
//
// Modello: la conoscenza è salvata come "rivelazioni" (personaggio, centro, raggio).
// La mappa di un campo = unione di:
//   - area del campo stesso (pos_x, pos_y, raggio)
//   - rivelazioni dei personaggi VIVI attualmente in quel campo
//   - edifici con flag "autoctoni", se nel campo c'è un personaggio col perk Autoctono
// Di conseguenza:
//   - cambio campo  -> la conoscenza segue il personaggio (nessun codice extra)
//   - morte         -> le sue rivelazioni escono dall'unione (restano le altre)
//   - resurrezione  -> tornano

import { GRID_W, GRID_H, TILE, RAGGIO_CAMPO_DEFAULT } from './mappa-config.js';
import { assicuraArea, assegnaGradi } from './mappa-gen.js';

export const RAGGIO_RIVELAZIONE = 10;
const CACHE_MS = 5000;
const cache = new Map();

const limita = (v, a, b) => Math.max(a, Math.min(b, v));

export function invalidaConoscenza(campoId = null) {
  if (campoId === null) cache.clear();
  else cache.delete(campoId);
}

function quadrato(cx, cy, r) {
  return {
    x1: limita(cx - r, 0, GRID_W - 1), y1: limita(cy - r, 0, GRID_H - 1),
    x2: limita(cx + r, 0, GRID_W - 1), y2: limita(cy + r, 0, GRID_H - 1)
  };
}

async function getConoscenza(db, campoId) {
  const c = cache.get(campoId);
  if (c && Date.now() - c.t < CACHE_MS) return c.dati;

  const visti = new Set();
  const quadrati = [];
  const aggiungi = q => {
    const k = `${q.x1},${q.y1},${q.x2},${q.y2}`;
    if (!visti.has(k)) { visti.add(k); quadrati.push(q); }
  };

  const campo = await db.get('SELECT id, nome, pos_x, pos_y, raggio FROM campi_base WHERE id = ?', campoId);
  if (campo && Number.isInteger(campo.pos_x) && Number.isInteger(campo.pos_y)) {
    aggiungi(quadrato(campo.pos_x, campo.pos_y, campo.raggio ?? RAGGIO_CAMPO_DEFAULT));
  }

  const membri = await db.all("SELECT id, data FROM personaggi WHERE campo_base_id = ? AND status = 'vivo'", campoId);
  let autoctoni = false;
  membri.forEach(m => {
    try {
      const d = JSON.parse(m.data || '{}');
      if ((d.perks || []).some(p => (typeof p === 'string' ? p : p?.nome) === 'Autoctono')) autoctoni = true;
    } catch { /* dati corrotti: ignora */ }
  });

  if (membri.length) {
    const ids = membri.map(m => m.id);
    const riv = await db.all(
      `SELECT cx, cy, raggio FROM mappa_rivelazioni WHERE personaggio_id IN (${ids.map(() => '?').join(',')})`, ...ids);
    riv.forEach(r => aggiungi(quadrato(r.cx, r.cy, r.raggio)));
  }

  const dati = { campo, quadrati, autoctoni };
  cache.set(campoId, { t: Date.now(), dati });
  return dati;
}

const dentro = (q, x, y) => x >= q.x1 && x <= q.x2 && y >= q.y1 && y <= q.y2;

async function accessoCampo(db, user, campoId) {
  if (user.role === 'master' || user.role === 'ospite') return true;
  const r = await db.get("SELECT 1 AS ok FROM personaggi WHERE user_id = ? AND campo_base_id = ? AND status = 'vivo' LIMIT 1", user.id, campoId);
  return !!r;
}

async function accessoPersonaggio(db, user, pgId) {
  if (user.role === 'master') return true;
  if (user.role === 'ospite') return false;
  const r = await db.get('SELECT 1 AS ok FROM personaggi WHERE id = ? AND user_id = ?', pgId, user.id);
  return !!r;
}

// Mappa di UN personaggio: area del suo campo + ciò che ha esplorato lui.
async function getConoscenzaPersonaggio(db, pgId) {
  const chiave = `p${pgId}`;
  const c = cache.get(chiave);
  if (c && Date.now() - c.t < CACHE_MS) return c.dati;

  const pg = await db.get("SELECT id, campo_base_id, data FROM personaggi WHERE id = ? AND status = 'vivo'", pgId);
  if (!pg) return null;

  const visti = new Set();
  const quadrati = [];
  const aggiungi = q => {
    const k = `${q.x1},${q.y1},${q.x2},${q.y2}`;
    if (!visti.has(k)) { visti.add(k); quadrati.push(q); }
  };

  const campo = await db.get('SELECT id, nome, pos_x, pos_y, raggio FROM campi_base WHERE id = ?', pg.campo_base_id);
  if (campo && Number.isInteger(campo.pos_x) && Number.isInteger(campo.pos_y)) {
    aggiungi(quadrato(campo.pos_x, campo.pos_y, campo.raggio ?? RAGGIO_CAMPO_DEFAULT));
  }

  let autoctoni = false;
  try {
    autoctoni = (JSON.parse(pg.data || '{}').perks || [])
      .some(p => (typeof p === 'string' ? p : p?.nome) === 'Autoctono');
  } catch { /* dati corrotti */ }

  const riv = await db.all('SELECT cx, cy, raggio FROM mappa_rivelazioni WHERE personaggio_id = ?', pgId);
  riv.forEach(r => aggiungi(quadrato(r.cx, r.cy, r.raggio)));

  const dati = { campo, quadrati, autoctoni };
  cache.set(chiave, { t: Date.now(), dati });
  return dati;
}

// Sceglie la conoscenza (personaggio o campo) e risponde da sé in caso di errore.
async function risolviConoscenza(db, user, pgId, campoId, res) {
  if (pgId) {
    if (!(await accessoPersonaggio(db, user, pgId))) { res.status(403).json({ error: 'Non hai accesso a questo personaggio' }); return null; }
    const n = await getConoscenzaPersonaggio(db, pgId);
    if (!n) { res.status(404).json({ error: 'Personaggio non in gioco' }); return null; }
    return n;
  }
  if (!(await accessoCampo(db, user, campoId))) { res.status(403).json({ error: 'Non hai accesso a questo campo' }); return null; }
  return getConoscenza(db, campoId);
}

// ---------- Funzioni riusabili dalla logica di esplorazione (parte 2) ----------

// Genera l'area (se serve), assegna i gradi agli edifici scoperti e registra la rivelazione
export async function rivelaPerPersonaggi(db, personaggioIds, cx, cy, raggio = RAGGIO_RIVELAZIONE) {
  const q = quadrato(cx, cy, raggio);
  await assicuraArea(db, q.x1, q.y1, q.x2, q.y2);
  await assegnaGradi(db, q.x1, q.y1, q.x2, q.y2);
  for (const id of personaggioIds) {
    await db.run('INSERT OR IGNORE INTO mappa_rivelazioni (personaggio_id, cx, cy, raggio) VALUES (?, ?, ?, ?)', id, cx, cy, raggio);
  }
  invalidaConoscenza();
}
function RAGGIO_REVELAZIONE_SAFE() { return RAGGIO_RIVELAZIONE; }

// Da chiamare quando un campo viene creato o spostato
export async function assicuraAreaCampo(db, campo) {
  if (!campo || !Number.isInteger(campo.pos_x) || !Number.isInteger(campo.pos_y)) return;
  const q = quadrato(campo.pos_x, campo.pos_y, campo.raggio ?? RAGGIO_CAMPO_DEFAULT);
  await assicuraArea(db, q.x1, q.y1, q.x2, q.y2);
  await assegnaGradi(db, q.x1, q.y1, q.x2, q.y2);
  invalidaConoscenza(campo.id);
}

// ---------- Rotte ----------
export function registraRotteMappaCampo(app, { dbPromise, authenticateUser, requireMaster }) {

  // Tile visibile da un campo: solo ciò che il campo conosce, ritagliato sull'area nota
  app.get('/api/mappa/campo/tile', authenticateUser, async (req, res) => {
    try {
      const db = await dbPromise;
      const x = parseInt(req.query.x, 10), y = parseInt(req.query.y, 10);
      const w = parseInt(req.query.w, 10), h = parseInt(req.query.h, 10);
      const campoId = parseInt(req.query.campoBaseId, 10);
      const pgId = req.query.personaggioId ? parseInt(req.query.personaggioId, 10) : null;
      if ([x, y, w, h].some(Number.isNaN) || Number.isNaN(pgId) || (pgId === null && Number.isNaN(campoId))) {
        return res.status(400).json({ error: 'x, y, w, h e campoBaseId (o personaggioId) obbligatori' });
      }
      if (w <= 0 || h <= 0 || w > TILE || h > TILE) return res.status(400).json({ error: `w e h tra 1 e ${TILE}` });
      if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return res.status(400).json({ error: 'Tile fuori griglia' });
      if (!(await accessoCampo(db, req.user, campoId))) return res.status(403).json({ error: 'Non hai accesso a questo campo' });

       const x2 = Math.min(GRID_W - 1, x + w - 1), y2 = Math.min(GRID_H - 1, y + h - 1);
      const noti = await risolviConoscenza(db, req.user, pgId, campoId, res);
      if (!noti) return;

      const locali = noti.quadrati
        .filter(q => q.x1 <= x2 && q.x2 >= x && q.y1 <= y2 && q.y2 >= y)
        .map(q => ({ x1: Math.max(q.x1, x), y1: Math.max(q.y1, y), x2: Math.min(q.x2, x2), y2: Math.min(q.y2, y2) }));

      const edRaw = await db.all(
        `SELECT e.id, e.x, e.y, e.nome, e.tipo, e.autoctoni,
                COUNT(p.piano) AS num_piani, COALESCE(MAX(p.esplorato), 0) AS esplorato_max
         FROM mappa_edifici e LEFT JOIN mappa_piani p ON p.edificio_id = e.id
         WHERE e.x BETWEEN ? AND ? AND e.y BETWEEN ? AND ?
         GROUP BY e.id`, x, x2, y, y2);

      const edifici = [];
      for (const e of edRaw) {
        const noto = locali.some(q => dentro(q, e.x, e.y));
        if (noto) { edifici.push(e); continue; }
        if (noti.autoctoni && e.autoctoni) {
          edifici.push(e);
          locali.push({ x1: e.x, y1: e.y, x2: e.x, y2: e.y });
        }
      }

      // Zone ritagliate sull'area nota (niente geometria fuori dalla nebbia)
      const zone = [];
      if (locali.length) {
        const zRaw = await db.all('SELECT id, tipo, nome, x1, y1, x2, y2 FROM mappa_zone WHERE x1 <= ? AND x2 >= ? AND y1 <= ? AND y2 >= ?', x2, x, y2, y);
        for (const z of zRaw) {
          for (const q of locali) {
            const ix1 = Math.max(z.x1, q.x1), iy1 = Math.max(z.y1, q.y1);
            const ix2 = Math.min(z.x2, q.x2), iy2 = Math.min(z.y2, q.y2);
            if (ix1 <= ix2 && iy1 <= iy2) zone.push({ id: z.id, tipo: z.tipo, nome: z.nome, x1: ix1, y1: iy1, x2: ix2, y2: iy2 });
          }
        }
      }

      // Insegne: solo le attività del piano terra
      const insegne = new Map();
      if (edifici.length) {
        const ids = edifici.map(e => e.id);
        const att = await db.all(
          `SELECT edificio_id, categoria FROM mappa_attivita WHERE piano = 1 AND edificio_id IN (${ids.map(() => '?').join(',')})`, ...ids);
        att.forEach(a => {
          if (!insegne.has(a.edificio_id)) insegne.set(a.edificio_id, []);
          const l = insegne.get(a.edificio_id);
          if (!l.includes(a.categoria)) l.push(a.categoria);
        });
      }

      res.json({
        zone,
        known: locali,
        edifici: edifici.map(e => ({
          id: e.id, x: e.x, y: e.y, tipo: e.tipo,
          nome: e.nome && e.nome.trim() ? e.nome : `Edificio #${e.id}`,
          num_piani: e.num_piani, esplorato_max: e.esplorato_max,
          insegne: insegne.get(e.id) || []
        })),
        campo: noti.campo
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

    app.post('/api/mappa/esplora-rivela', authenticateUser, async (req, res) => {
    try {
      const db = await dbPromise;
      const id = parseInt(req.body?.personaggioId, 10);
      const lista = Array.isArray(req.body?.edifici) ? req.body.edifici.slice(0, 3) : [];
      if (!Number.isInteger(id) || !lista.length) return res.status(400).json({ error: 'personaggioId ed edifici richiesti' });
      if (!(await accessoPersonaggio(db, req.user, id))) return res.status(403).json({ error: 'Non autorizzato' });

      let rivelati = 0;
      for (const e of lista) {
        const x = parseInt(e?.x, 10), y = parseInt(e?.y, 10);
        if ([x, y].some(Number.isNaN) || x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) continue;
        // solo edifici che esistono davvero: niente rivelazioni di coordinate inventate
        if (!(await db.get('SELECT 1 AS ok FROM mappa_edifici WHERE x = ? AND y = ?', x, y))) continue;
        await rivelaPerPersonaggi(db, [id], x, y, RAGGIO_RIVELAZIONE);
        rivelati++;
      }
      res.json({ success: true, rivelati });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Dettaglio edificio visto da un campo (grado e attività interne solo se esplorato)
  app.get('/api/mappa/campo/edificio/:id', authenticateUser, async (req, res) => {
    try {
      const db = await dbPromise;
      const id = parseInt(req.params.id, 10);
      const campoId = parseInt(req.query.campoBaseId, 10);
      const pgId = req.query.personaggioId ? parseInt(req.query.personaggioId, 10) : null;
      if (Number.isNaN(id) || Number.isNaN(pgId) || (pgId === null && Number.isNaN(campoId))) return res.status(400).json({ error: 'Parametri non validi' });

      const ed = await db.get('SELECT id, x, y, nome, tipo, autoctoni FROM mappa_edifici WHERE id = ?', id);
      if (!ed) return res.status(404).json({ error: 'Edificio non trovato' });
      const noti = await risolviConoscenza(db, req.user, pgId, campoId, res);
      if (!noti) return;
      const noto = noti.quadrati.some(q => dentro(q, ed.x, ed.y)) || (noti.autoctoni && ed.autoctoni);
      if (!noto) return res.status(404).json({ error: 'Edificio non visibile' });

      const piani = await db.all('SELECT piano, tipo, esplorato, grado FROM mappa_piani WHERE edificio_id = ? ORDER BY piano', id);
      const att = await db.all('SELECT piano, categoria, qualita FROM mappa_attivita WHERE edificio_id = ?', id);
      res.json({
        edificio: { id: ed.id, x: ed.x, y: ed.y, tipo: ed.tipo, nome: ed.nome && ed.nome.trim() ? ed.nome : `Edificio #${ed.id}` },
        piani: piani.map(p => ({
          piano: p.piano, tipo: p.tipo, esplorato: p.esplorato,
          grado: p.esplorato >= 1 ? p.grado : null,
          attivita: (p.piano === 1 || p.esplorato >= 1)
            ? att.filter(a => a.piano === p.piano).map(a => ({ categoria: a.categoria, qualita: a.qualita }))
            : null
        }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Master: rivela un'area a uno o più personaggi (genera la mappa se manca)
  app.post('/api/mappa/rivela', authenticateUser, requireMaster, async (req, res) => {
    try {
      const db = await dbPromise;
      const x = parseInt(req.body?.x, 10), y = parseInt(req.body?.y, 10);
      const raggio = req.body?.raggio === undefined ? RAGGIO_RIVELAZIONE : parseInt(req.body.raggio, 10);
      const ids = (req.body?.personaggioIds || []).map(n => parseInt(n, 10)).filter(n => Number.isInteger(n) && n > 0);
      if ([x, y, raggio].some(Number.isNaN) || raggio < 0 || x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) {
        return res.status(400).json({ error: 'x, y, raggio non validi' });
      }
      if (!ids.length) return res.status(400).json({ error: 'personaggioIds richiesto' });
      await rivelaPerPersonaggi(db, ids, x, y, raggio);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Master: pre-genera un'area senza rivelarla a nessuno
  app.post('/api/mappa/genera', authenticateUser, requireMaster, async (req, res) => {
    try {
      const db = await dbPromise;
      const x = parseInt(req.body?.x, 10), y = parseInt(req.body?.y, 10);
      const raggio = parseInt(req.body?.raggio ?? RAGGIO_CAMPO_DEFAULT, 10);
      if ([x, y, raggio].some(Number.isNaN) || raggio < 0 || raggio > 300) return res.status(400).json({ error: 'x, y, raggio non validi (raggio max 300)' });
      const q = quadrato(x, y, raggio);
      const nuovi = await assicuraArea(db, q.x1, q.y1, q.x2, q.y2);
      res.json({ success: true, chunkCreati: nuovi });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Master: flag "conosciuta da autoctoni" su un edificio
  app.post('/api/mappa/autoctoni', authenticateUser, requireMaster, async (req, res) => {
    try {
      const db = await dbPromise;
      const x = parseInt(req.body?.x, 10), y = parseInt(req.body?.y, 10);
      if ([x, y].some(Number.isNaN)) return res.status(400).json({ error: 'x e y obbligatori' });
      const r = await db.run('UPDATE mappa_edifici SET autoctoni = ? WHERE x = ? AND y = ?', req.body?.valore ? 1 : 0, x, y);
      if (!r.changes) return res.status(404).json({ error: 'Nessun edificio in quella casella' });
      invalidaConoscenza();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}