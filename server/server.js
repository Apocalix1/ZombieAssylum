import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { openDatabase, magazzinoVuoto } from './db.js';
import {
  GRID_W,
  GRID_H,
  QUARTIERE,
  TILE,
  TIPI_ZONA,
  TIPI_EDIFICIO,
  TIPI_PIANO,
  MIN_PIANI,
  ESPLORAZIONE,
  RAGGIO_CAMPO_DEFAULT
} from './mappa-config.js';
import { creaContenutoDocumento } from './documento-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Static files
const staticPath = join(__dirname, '..', 'client');
console.log('📁 Static path:', staticPath);
app.use(express.static(staticPath));

// Database
const dbPromise = openDatabase();

// ========================= UTILITY =========================

function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...sanitized } = user;
  return sanitized;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(storedPassword, password) {
  if (!storedPassword || !password) return false;
  if (storedPassword.startsWith('scrypt$')) {
    const [, salt, derived] = storedPassword.split('$');
    if (!salt || !derived) return false;
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
  }
  return storedPassword === password;
}

function stringifyCharacterData(value) {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value));
    } catch {
      return JSON.stringify({});
    }
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return JSON.stringify({});
}

function parseIntStrict(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return parsed;
}

function minPianiPerTipo(tipo) {
  return MIN_PIANI[tipo] || 1;
}

function validateGridPoint(x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return 'Coordinate non valide: usa interi';
  }
  if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) {
    return `Coordinate fuori griglia (x: 0..${GRID_W - 1}, y: 0..${GRID_H - 1})`;
  }
  return null;
}

function intersectsRect(a, b) {
  return !(a.x2 < b.x1 || b.x2 < a.x1 || a.y2 < b.y1 || b.y2 < a.y1);
}

async function validateZonaPayload(db, payload, excludeZoneId = null) {
  const tipo = String(payload?.tipo || '').trim().toLowerCase();
  if (!TIPI_ZONA.includes(tipo)) {
    return { status: 400, error: `Tipo zona non valido. Tipi ammessi: ${TIPI_ZONA.join(', ')}` };
  }
  const x1 = parseIntStrict(payload?.x1);
  const y1 = parseIntStrict(payload?.y1);
  const x2 = parseIntStrict(payload?.x2);
  const y2 = parseIntStrict(payload?.y2);
  const esplorato = parseIntStrict(payload?.esplorato ?? 0);

  const p1Err = validateGridPoint(x1, y1);
  if (p1Err) return { status: 400, error: p1Err };
  const p2Err = validateGridPoint(x2, y2);
  if (p2Err) return { status: 400, error: p2Err };
  if (x1 > x2 || y1 > y2) {
    return { status: 400, error: 'Coordinate rettangolo non valide: richiede x1<=x2 e y1<=y2' };
  }
  if ((x2 - x1 + 1) > QUARTIERE || (y2 - y1 + 1) > QUARTIERE) {
    return { status: 400, error: `Una zona non puo superare ${QUARTIERE}x${QUARTIERE}` };
  }
  if (![0, 1, 2].includes(esplorato)) {
    return { status: 400, error: 'Esplorazione non valida (0, 1, 2)' };
  }

  const zone = await db.all('SELECT id, x1, y1, x2, y2 FROM mappa_zone');
  const rect = { x1, y1, x2, y2 };
  for (const zone of zone) {
    if (excludeZoneId && zone.id === excludeZoneId) continue;
    if (intersectsRect(rect, zone)) {
      return { status: 409, error: `Sovrapposizione con zona esistente #${zone.id}` };
    }
  }

  const edificioDentro = await db.get(
    'SELECT id FROM mappa_edifici WHERE x BETWEEN ? AND ? AND y BETWEEN ? AND ? LIMIT 1',
    x1,
    x2,
    y1,
    y2
  );
  if (edificioDentro) {
    return { status: 409, error: `La zona contiene l'edificio #${edificioDentro.id}` };
  }

  return {
    ok: true,
    value: {
      tipo,
      nome: payload?.nome ? String(payload.nome).trim() : null,
      x1,
      y1,
      x2,
      y2,
      esplorato
    }
  };
}

function validatePianiPayload(piani) {
  if (!Array.isArray(piani) || piani.length === 0) {
    return { status: 400, error: 'Un edificio deve avere almeno un piano' };
  }
  const clean = [];
  for (let i = 0; i < piani.length; i += 1) {
    const pianoPayload = piani[i] || {};
    const tipoPiano = String(pianoPayload.tipo || '').trim().toLowerCase();
    if (!TIPI_PIANO.includes(tipoPiano)) {
      return { status: 400, error: `Tipo piano non valido al piano ${i + 1}` };
    }
    const esplorato = parseIntStrict(pianoPayload.esplorato ?? 0);
    if (![0, 1, 2].includes(esplorato)) {
      return { status: 400, error: `Esplorazione non valida al piano ${i + 1}` };
    }
    let lootJson = '{}';
    if (pianoPayload.loot_json !== undefined && pianoPayload.loot_json !== null) {
      lootJson = String(pianoPayload.loot_json);
    } else if (pianoPayload.loot !== undefined && pianoPayload.loot !== null) {
      lootJson = String(pianoPayload.loot);
    }
    clean.push({
      piano: i + 1,
      tipo: tipoPiano,
      esplorato,
      loot_json: lootJson
    });
  }
  return { ok: true, value: clean };
}

async function validateEdificioPayload(db, payload, { edificioId = null } = {}) {
  const x = parseIntStrict(payload?.x);
  const y = parseIntStrict(payload?.y);
  const tipo = payload?.tipo ? String(payload.tipo).trim().toLowerCase() : null;

  if (x !== null || y !== null) {
    const coordError = validateGridPoint(x, y);
    if (coordError) return { status: 400, error: coordError };
  }

  if (tipo !== null && !TIPI_EDIFICIO.includes(tipo)) {
    if (TIPI_ZONA.includes(tipo)) {
      return { status: 400, error: 'Tipo edificio non valido: usa una zona' };
    }
    return { status: 400, error: `Tipo edificio non valido. Tipi ammessi: ${TIPI_EDIFICIO.join(', ')}` };
  }

  if (x !== null && y !== null) {
    const zoneCover = await db.get(
      'SELECT id FROM mappa_zone WHERE ? BETWEEN x1 AND x2 AND ? BETWEEN y1 AND y2 LIMIT 1',
      x,
      y
    );
    if (zoneCover) {
      return { status: 409, error: `Non puoi creare un edificio dentro la zona #${zoneCover.id}` };
    }

    const existing = await db.get('SELECT id FROM mappa_edifici WHERE x = ? AND y = ? LIMIT 1', x, y);
    if (existing && existing.id !== edificioId) {
      return { status: 409, error: `Esiste gia un edificio nella casella (${x}:${y})` };
    }
  }

  return { ok: true, value: { x, y, tipo } };
}

async function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await db.run('INSERT INTO sessioni (token, user_id, expires_at) VALUES (?, ?, ?)', token, userId, expiresAt);
  return token;
}

function redactCharacterData(data, mostraInventario = false) {
  if (!data) return {};
  return {
    inventario: mostraInventario ? data.inventario : undefined,
    nome: data.nome,
    isRobot: data.isRobot,
    inSpedizione: data.inSpedizione,
    azioneCorrente: data.azioneCorrente
        ? { tipo: data.azioneCorrente.tipo, oreRimanenti: data.azioneCorrente.oreRimanenti }
        : null,
    perks: [] // niente perk visibili a chi non possiede il personaggio
  };
}

app.get('/api/party', authenticateUser, async (req, res) => {
  try {
    const db = await dbPromise;
    const campoBaseId = req.query.campoBaseId ? parseInt(req.query.campoBaseId, 10) : null;
    let characters = campoBaseId
      ? await db.all(`
          SELECT p.*, u.username AS owner_username
          FROM personaggi p JOIN utenti u ON u.id = p.user_id
          WHERE p.status = 'vivo' AND p.campo_base_id = ? ORDER BY p.created_at DESC`, campoBaseId)
      : await db.all(`
          SELECT p.*, u.username AS owner_username
          FROM personaggi p JOIN utenti u ON u.id = p.user_id
          WHERE p.status = 'vivo' ORDER BY p.created_at DESC`);

    characters = characters.map(c => {
      if (c.data && typeof c.data === 'string') {
        try { c.data = JSON.parse(c.data); } catch (e) { c.data = {}; }
      }
      if (req.user.role !== 'master' && c.user_id !== req.user.id) {
        c.data = redactCharacterData(c.data, req.user.role === 'ospite');
      }
      return c;
    });
    res.json({ party: characters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================= MIDDLEWARE =========================

async function authenticateUser(req, res, next) {
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: 'Token mancante o non valido' });
  }
  const token = match[1];
  try {
    const db = await dbPromise;
    const session = await db.get(
        `SELECT s.token AS token, s.expires_at AS expires_at, u.id AS id, u.username AS username, u.role AS role
       FROM sessioni s
       JOIN utenti u ON u.id = s.user_id
       WHERE s.token = ?`,
        token,
    );
    if (!session) {
      return res.status(401).json({ error: 'Token non valido' });
    }
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      await db.run('DELETE FROM sessioni WHERE token = ?', token);
      return res.status(401).json({ error: 'Sessione scaduta, accedi nuovamente' });
    }
    req.user = session;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

function requireMaster(req, res, next) {
  if (!req.user || req.user.role !== 'master') {
    return res.status(403).json({ error: 'Richiesto ruolo master' });
  }
  next();
}

function requireNotGuest(req, res, next) {
  if (req.user && req.user.role === 'ospite') {
    return res.status(403).json({ error: 'Operazione non consentita per utenti ospite' });
  }
  next();
}

// ========================= ROUTE: PING =========================

app.get('/api/ping', async (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========================= ROUTE: CAMPI BASE =========================

app.get('/api/campi', authenticateUser, async (req, res) => {
  try {
    const db = await dbPromise;
    const campi = await db.all(`
      SELECT c.*, (SELECT COUNT(*) FROM personaggi p WHERE p.campo_base_id = c.id AND p.status = 'vivo') AS pg_attivi
      FROM campi_base c ORDER BY c.id ASC
    `);
    res.json({ campi });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/campi', authenticateUser, requireMaster, async (req, res) => {
  const { nome, pos_x, pos_y, raggio } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome campo base richiesto' });
  const x = parseIntStrict(pos_x);
  const y = parseIntStrict(pos_y);
  if (x === null || y === null) {
    return res.status(400).json({ error: 'Per creare un campo base servono pos_x e pos_y' });
  }
  const coordErr = validateGridPoint(x, y);
  if (coordErr) return res.status(400).json({ error: coordErr });
  const raggioPulito = parseIntStrict(raggio);
  const raggioFinale = raggioPulito === null ? RAGGIO_CAMPO_DEFAULT : raggioPulito;
  if (raggioFinale < 0) {
    return res.status(400).json({ error: 'Raggio non valido' });
  }
  try {
    const db = await dbPromise;
    const result = await db.run(
      'INSERT INTO campi_base (nome, pos_x, pos_y, raggio) VALUES (?, ?, ?, ?)',
      nome.trim(),
      x,
      y,
      raggioFinale
    );
    await db.run('INSERT INTO magazzini (campo_base_id, data) VALUES (?, ?)', result.lastID, JSON.stringify(magazzinoVuoto()));
    const campo = await db.get('SELECT * FROM campi_base WHERE id = ?', result.lastID);
    res.json({ campo });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Esiste già un campo base con questo nome' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/campi/:id/posizione', authenticateUser, requireMaster, async (req, res) => {
  const id = parseIntStrict(req.params.id);
  if (id === null || id <= 0) return res.status(400).json({ error: 'ID campo base non valido' });
  const x = parseIntStrict(req.body?.pos_x);
  const y = parseIntStrict(req.body?.pos_y);
  if (x === null || y === null) {
    return res.status(400).json({ error: 'pos_x e pos_y sono obbligatori' });
  }
  const coordErr = validateGridPoint(x, y);
  if (coordErr) return res.status(400).json({ error: coordErr });
  const raggioPulito = parseIntStrict(req.body?.raggio);
  const raggioFinale = raggioPulito === null ? null : raggioPulito;
  if (raggioFinale !== null && raggioFinale < 0) {
    return res.status(400).json({ error: 'Raggio non valido' });
  }
  try {
    const db = await dbPromise;
    const campo = await db.get('SELECT id, raggio FROM campi_base WHERE id = ?', id);
    if (!campo) return res.status(404).json({ error: 'Campo base non trovato' });
    await db.run(
      'UPDATE campi_base SET pos_x = ?, pos_y = ?, raggio = ? WHERE id = ?',
      x,
      y,
      raggioFinale === null ? campo.raggio : raggioFinale,
      id
    );
    const updated = await db.get('SELECT * FROM campi_base WHERE id = ?', id);
    res.json({ campo: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/campi/:id', authenticateUser, requireMaster, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id === 1) return res.status(400).json({ error: 'Impossibile eliminare questo campo base' });
  try {
    const db = await dbPromise;
    // I personaggi vivi nel campo eliminato non vengono cancellati: passano "in attesa"
    // nel menù del loro giocatore, pronti a rientrare scegliendo un nuovo campo base.
    await db.run(
      "UPDATE personaggi SET status = 'in_attesa' WHERE campo_base_id = ? AND status = 'vivo'",
      id
    );
    await db.run('DELETE FROM campi_base WHERE id = ?', id);
    await db.run('DELETE FROM magazzini WHERE campo_base_id = ?', id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================= ROUTE: MAPPA =========================

app.get('/api/mappa/config', authenticateUser, async (_req, res) => {
  res.json({
    GRID_W,
    GRID_H,
    QUARTIERE,
    TILE,
    TIPI_ZONA,
    TIPI_EDIFICIO,
    TIPI_PIANO,
    MIN_PIANI,
    ESPLORAZIONE,
    RAGGIO_CAMPO_DEFAULT
  });
});

app.get('/api/mappa/tile', authenticateUser, async (req, res) => {
  const x = parseIntStrict(req.query.x);
  const y = parseIntStrict(req.query.y);
  const w = parseIntStrict(req.query.w);
  const h = parseIntStrict(req.query.h);
  if ([x, y, w, h].some(v => v === null)) {
    return res.status(400).json({ error: 'x, y, w, h sono obbligatori e devono essere interi' });
  }
  if (w <= 0 || h <= 0 || w > TILE || h > TILE) {
    return res.status(400).json({ error: `w e h devono essere tra 1 e ${TILE}` });
  }
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) {
    return res.status(400).json({ error: 'Coordinate tile fuori griglia' });
  }

  const x2 = Math.min(GRID_W - 1, x + w - 1);
  const y2 = Math.min(GRID_H - 1, y + h - 1);

  try {
    const db = await dbPromise;
    let zone = await db.all(
      `SELECT id, tipo, nome, x1, y1, x2, y2, esplorato
       FROM mappa_zone
       WHERE x1 <= ? AND x2 >= ? AND y1 <= ? AND y2 >= ?`,
      x2,
      x,
      y2,
      y
    );

    let edifici = await db.all(
      `SELECT e.id, e.x, e.y, e.nome, e.tipo,
              COUNT(p.piano) AS num_piani,
              COALESCE(MAX(p.esplorato), 0) AS esplorato_max
       FROM mappa_edifici e
       LEFT JOIN mappa_piani p ON p.edificio_id = e.id
       WHERE e.x BETWEEN ? AND ? AND e.y BETWEEN ? AND ?
       GROUP BY e.id
       ORDER BY e.id ASC`,
      x,
      x2,
      y,
      y2
    );

    if (req.user.role !== 'master') {
      zone = zone.filter(z => Number(z.esplorato) >= 1);
      edifici = edifici.filter(e => Number(e.esplorato_max) >= 1);
    }

    edifici = edifici.map(e => ({
      ...e,
      nome: e.nome && e.nome.trim() ? e.nome : `Edificio #${e.id}`
    }));

    const campi = await db.all('SELECT id, nome, pos_x, pos_y, raggio FROM campi_base ORDER BY id ASC');
    res.json({ zone, edifici, campi });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/mappa/edificio/:id', authenticateUser, async (req, res) => {
  const edificioId = parseIntStrict(req.params.id);
  if (edificioId === null || edificioId <= 0) {
    return res.status(400).json({ error: 'ID edificio non valido' });
  }
  try {
    const db = await dbPromise;
    const edificio = await db.get('SELECT id, x, y, nome, tipo FROM mappa_edifici WHERE id = ?', edificioId);
    if (!edificio) return res.status(404).json({ error: 'Edificio non trovato' });
    let piani = await db.all(
      'SELECT piano, tipo, esplorato, loot_json FROM mappa_piani WHERE edificio_id = ? ORDER BY piano ASC',
      edificioId
    );
    if (req.user.role !== 'master') {
      const hasVisible = piani.some(p => Number(p.esplorato) >= 1);
      if (!hasVisible) {
        return res.status(404).json({ error: 'Edificio non visibile' });
      }
      piani = piani
        .filter(p => Number(p.esplorato) >= 1)
        .map(p => ({
          piano: p.piano,
          tipo: p.tipo,
          esplorato: p.esplorato,
          loot_json: p.loot_json
        }));
    }
    res.json({
      edificio: {
        ...edificio,
        nome: edificio.nome && edificio.nome.trim() ? edificio.nome : `Edificio #${edificio.id}`
      },
      piani
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/mappa/cerca', authenticateUser, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Parametro q obbligatorio' });

  const coordParts = q.split(':').map(part => part.trim());
  const isCoord = coordParts.length >= 2 && coordParts.length <= 3 && coordParts.every(part => /^-?\d+$/.test(part));

  try {
    const db = await dbPromise;
    if (isCoord) {
      const x = parseIntStrict(coordParts[0]);
      const y = parseIntStrict(coordParts[1]);
      const err = validateGridPoint(x, y);
      if (err) return res.status(400).json({ error: err });

      const zone = await db.get(
        'SELECT id, tipo, nome, x1, y1, x2, y2, esplorato FROM mappa_zone WHERE ? BETWEEN x1 AND x2 AND ? BETWEEN y1 AND y2 LIMIT 1',
        x,
        y
      );
      const edificio = await db.get(
        `SELECT e.id, e.x, e.y, e.nome, e.tipo, COALESCE(MAX(p.esplorato),0) AS esplorato_max
         FROM mappa_edifici e
         LEFT JOIN mappa_piani p ON p.edificio_id = e.id
         WHERE e.x = ? AND e.y = ?
         GROUP BY e.id
         LIMIT 1`,
        x,
        y
      );

      const risultati = [];
      if (zone && (req.user.role === 'master' || Number(zone.esplorato) >= 1)) {
        risultati.push({ tipo: 'zona', ...zone });
      }
      if (edificio && (req.user.role === 'master' || Number(edificio.esplorato_max) >= 1)) {
        risultati.push({
          tipo: 'edificio',
          ...edificio,
          nome: edificio.nome && edificio.nome.trim() ? edificio.nome : `Edificio #${edificio.id}`
        });
      }
      return res.json({ risultati });
    }

    const like = `%${q}%`;
    let zone = await db.all(
      `SELECT id, tipo, nome, x1, y1, x2, y2, esplorato
       FROM mappa_zone
       WHERE nome IS NOT NULL AND nome LIKE ?
       ORDER BY id DESC
       LIMIT 50`,
      like
    );
    let edifici = await db.all(
      `SELECT e.id, e.x, e.y, e.nome, e.tipo, COALESCE(MAX(p.esplorato),0) AS esplorato_max
       FROM mappa_edifici e
       LEFT JOIN mappa_piani p ON p.edificio_id = e.id
       WHERE e.nome IS NOT NULL AND e.nome LIKE ?
       GROUP BY e.id
       ORDER BY e.id DESC
       LIMIT 50`,
      like
    );

    if (req.user.role !== 'master') {
      zone = zone.filter(z => Number(z.esplorato) >= 1);
      edifici = edifici.filter(e => Number(e.esplorato_max) >= 1);
    }

    const risultati = [
      ...zone.map(z => ({ tipo: 'zona', ...z })),
      ...edifici.map(e => ({
        tipo: 'edificio',
        ...e,
        nome: e.nome && e.nome.trim() ? e.nome : `Edificio #${e.id}`
      }))
    ].slice(0, 50);

    res.json({ risultati });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/mappa/zone', authenticateUser, requireMaster, async (req, res) => {
  try {
    const db = await dbPromise;
    const check = await validateZonaPayload(db, req.body);
    if (!check.ok) return res.status(check.status).json({ error: check.error });
    const z = check.value;
    const result = await db.run(
      `INSERT INTO mappa_zone (tipo, nome, x1, y1, x2, y2, esplorato)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      z.tipo,
      z.nome,
      z.x1,
      z.y1,
      z.x2,
      z.y2,
      z.esplorato
    );
    const zona = await db.get('SELECT * FROM mappa_zone WHERE id = ?', result.lastID);
    res.json({ zona });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/mappa/zone/:id', authenticateUser, requireMaster, async (req, res) => {
  const id = parseIntStrict(req.params.id);
  if (id === null || id <= 0) return res.status(400).json({ error: 'ID zona non valido' });
  try {
    const db = await dbPromise;
    const zonaEsistente = await db.get('SELECT * FROM mappa_zone WHERE id = ?', id);
    if (!zonaEsistente) return res.status(404).json({ error: 'Zona non trovata' });
    const merged = {
      ...zonaEsistente,
      ...req.body
    };
    const check = await validateZonaPayload(db, merged, id);
    if (!check.ok) return res.status(check.status).json({ error: check.error });
    const z = check.value;
    await db.run(
      `UPDATE mappa_zone
       SET tipo = ?, nome = ?, x1 = ?, y1 = ?, x2 = ?, y2 = ?, esplorato = ?
       WHERE id = ?`,
      z.tipo,
      z.nome,
      z.x1,
      z.y1,
      z.x2,
      z.y2,
      z.esplorato,
      id
    );
    const zona = await db.get('SELECT * FROM mappa_zone WHERE id = ?', id);
    res.json({ zona });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/mappa/zone/:id', authenticateUser, requireMaster, async (req, res) => {
  const id = parseIntStrict(req.params.id);
  if (id === null || id <= 0) return res.status(400).json({ error: 'ID zona non valido' });
  try {
    const db = await dbPromise;
    const zona = await db.get('SELECT id FROM mappa_zone WHERE id = ?', id);
    if (!zona) return res.status(404).json({ error: 'Zona non trovata' });
    await db.run('DELETE FROM mappa_zone WHERE id = ?', id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/mappa/edifici', authenticateUser, requireMaster, async (req, res) => {
  try {
    const db = await dbPromise;
    const { x, y, nome, tipo, piani } = req.body || {};

    if (x === undefined || y === undefined || !tipo) {
      return res.status(400).json({ error: 'x, y e tipo sono obbligatori' });
    }

    const checkEdificio = await validateEdificioPayload(db, { x, y, tipo });
    if (!checkEdificio.ok) return res.status(checkEdificio.status).json({ error: checkEdificio.error });

    const pianiCheck = validatePianiPayload(piani);
    if (!pianiCheck.ok) return res.status(pianiCheck.status).json({ error: pianiCheck.error });

    const minPiani = minPianiPerTipo(tipo);
    if (pianiCheck.value.length < minPiani) {
      return res.status(400).json({ error: `Il tipo ${tipo} richiede almeno ${minPiani} piani` });
    }

    await db.run('BEGIN');
    const result = await db.run(
      'INSERT INTO mappa_edifici (x, y, nome, tipo) VALUES (?, ?, ?, ?)',
      x,
      y,
      nome ? String(nome).trim() : null,
      String(tipo).trim().toLowerCase()
    );

    for (const piano of pianiCheck.value) {
      await db.run(
        'INSERT INTO mappa_piani (edificio_id, piano, tipo, esplorato, loot_json) VALUES (?, ?, ?, ?, ?)',
        result.lastID,
        piano.piano,
        piano.tipo,
        piano.esplorato,
        piano.loot_json
      );
    }
    await db.run('COMMIT');

    const edificio = await db.get('SELECT * FROM mappa_edifici WHERE id = ?', result.lastID);
    res.json({ edificio: { ...edificio, nome: edificio.nome || `Edificio #${edificio.id}` } });
  } catch (error) {
    try {
      const db = await dbPromise;
      await db.run('ROLLBACK');
    } catch (_) {
      // no-op
    }
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Esiste gia un edificio in questa casella' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/mappa/edifici/:id', authenticateUser, requireMaster, async (req, res) => {
  const id = parseIntStrict(req.params.id);
  if (id === null || id <= 0) return res.status(400).json({ error: 'ID edificio non valido' });
  try {
    const db = await dbPromise;
    const edificio = await db.get('SELECT * FROM mappa_edifici WHERE id = ?', id);
    if (!edificio) return res.status(404).json({ error: 'Edificio non trovato' });

    const newTipo = req.body?.tipo ? String(req.body.tipo).trim().toLowerCase() : edificio.tipo;
    const checkTipo = await validateEdificioPayload(db, { tipo: newTipo }, { edificioId: id });
    if (!checkTipo.ok) return res.status(checkTipo.status).json({ error: checkTipo.error });

    const pianiCountRow = await db.get('SELECT COUNT(*) AS count FROM mappa_piani WHERE edificio_id = ?', id);
    const minPiani = minPianiPerTipo(newTipo);
    if ((pianiCountRow?.count || 0) < minPiani) {
      return res.status(400).json({ error: `Il tipo ${newTipo} richiede almeno ${minPiani} piani` });
    }

    const hasNome = Object.prototype.hasOwnProperty.call(req.body || {}, 'nome');
    const nomeFinale = hasNome
      ? (req.body?.nome ? String(req.body.nome).trim() : null)
      : edificio.nome;
    await db.run('UPDATE mappa_edifici SET nome = ?, tipo = ? WHERE id = ?', nomeFinale, newTipo, id);
    const updated = await db.get('SELECT * FROM mappa_edifici WHERE id = ?', id);
    res.json({ edificio: { ...updated, nome: updated.nome || `Edificio #${updated.id}` } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/mappa/edifici/:id', authenticateUser, requireMaster, async (req, res) => {
  const id = parseIntStrict(req.params.id);
  if (id === null || id <= 0) return res.status(400).json({ error: 'ID edificio non valido' });
  try {
    const db = await dbPromise;
    const edificio = await db.get('SELECT id FROM mappa_edifici WHERE id = ?', id);
    if (!edificio) return res.status(404).json({ error: 'Edificio non trovato' });
    await db.run('DELETE FROM mappa_edifici WHERE id = ?', id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/mappa/edifici/:id/piani', authenticateUser, requireMaster, async (req, res) => {
  const id = parseIntStrict(req.params.id);
  if (id === null || id <= 0) return res.status(400).json({ error: 'ID edificio non valido' });
  try {
    const db = await dbPromise;
    const edificio = await db.get('SELECT id, tipo FROM mappa_edifici WHERE id = ?', id);
    if (!edificio) return res.status(404).json({ error: 'Edificio non trovato' });

    const pianiCheck = validatePianiPayload(req.body?.piani);
    if (!pianiCheck.ok) return res.status(pianiCheck.status).json({ error: pianiCheck.error });

    const minPiani = minPianiPerTipo(edificio.tipo);
    if (pianiCheck.value.length < minPiani) {
      return res.status(400).json({ error: `Non puoi scendere sotto il minimo di ${minPiani} piani` });
    }

    await db.run('BEGIN');
    await db.run('DELETE FROM mappa_piani WHERE edificio_id = ?', id);
    for (const piano of pianiCheck.value) {
      await db.run(
        'INSERT INTO mappa_piani (edificio_id, piano, tipo, esplorato, loot_json) VALUES (?, ?, ?, ?, ?)',
        id,
        piano.piano,
        piano.tipo,
        piano.esplorato,
        piano.loot_json
      );
    }
    await db.run('COMMIT');
    const piani = await db.all('SELECT piano, tipo, esplorato, loot_json FROM mappa_piani WHERE edificio_id = ? ORDER BY piano ASC', id);
    res.json({ piani });
  } catch (error) {
    try {
      const db = await dbPromise;
      await db.run('ROLLBACK');
    } catch (_) {
      // no-op
    }
    res.status(500).json({ error: error.message });
  }
});

// ========================= ROUTE: OROLOGIO GLOBALE =========================

app.get('/api/mondo', authenticateUser, async (req, res) => {
  try {
    const db = await dbPromise;
    const row = await db.get('SELECT * FROM mondo WHERE id = 1');
    res.json({ mondo: row || { id: 1, ore_totali: 0 } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/mondo', authenticateUser, requireMaster, async (req, res) => {
  const { ore_totali } = req.body;
  if (typeof ore_totali !== 'number' || ore_totali < 0) {
    return res.status(400).json({ error: 'ore_totali non valido' });
  }
  try {
    const db = await dbPromise;
    await db.run('UPDATE mondo SET ore_totali = ? WHERE id = 1', ore_totali);
    res.json({ success: true, ore_totali });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================= ROUTE: LOG EVENTI (per campo) =========================

app.get('/api/eventi', authenticateUser, async (req, res) => {
  const campoBaseId = parseInt(req.query.campoBaseId, 10);
  if (isNaN(campoBaseId)) return res.status(400).json({ error: 'campoBaseId richiesto' });
  try {
    const db = await dbPromise;
    const eventi = await db.all(
      'SELECT * FROM eventi_log WHERE campo_base_id = ? ORDER BY id DESC LIMIT 200',
      campoBaseId
    );
    res.json({ eventi });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/eventi', authenticateUser, async (req, res) => {
  const { campoBaseId, oraGioco, tipo, messaggio, personaggioNome } = req.body;
  if (!campoBaseId || !messaggio) return res.status(400).json({ error: 'Dati mancanti' });
  try {
    const db = await dbPromise;
    await db.run(
      'INSERT INTO eventi_log (campo_base_id, ora_gioco, tipo, messaggio, personaggio_nome) VALUES (?, ?, ?, ?, ?)',
      campoBaseId, oraGioco || 0, tipo || 'info', messaggio, personaggioNome || null
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/eventi/segna-letti', authenticateUser, async (req, res) => {
  const { campoBaseId } = req.body;
  if (!campoBaseId) return res.status(400).json({ error: 'campoBaseId richiesto' });
  try {
    const db = await dbPromise;
    await db.run('UPDATE eventi_log SET letto = 1 WHERE campo_base_id = ?', campoBaseId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================= ROUTE: AUTENTICAZIONE =========================

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username e password richiesti' });
  }
  try {
    const db = await dbPromise;
    const countRow = await db.get(
        "SELECT COUNT(*) AS count FROM utenti WHERE role = ? AND username != 'ospite'",
        'giocatore',
    );
    if (countRow && countRow.count >= 50) {
      return res.status(403).json({ error: 'Limite massimo di account giocatore raggiunto' });
    }
    const result = await db.run(
        'INSERT INTO utenti (username, password, role) VALUES (?, ?, ?)',
        username,
        hashPassword(password),
        'giocatore',
    );
    const user = await db.get('SELECT id, username, role FROM utenti WHERE id = ?', result.lastID);
    const token = await createSession(db, user.id);
    res.json({ user, token });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'username già in uso' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username e password richiesti' });
  }
  try {
    const db = await dbPromise;
    const user = await db.get('SELECT id, username, role, password FROM utenti WHERE username = ?', username);
    if (!user || !verifyPassword(user.password, password)) {
      return res.status(401).json({ error: 'credenziali non valide' });
    }
    if (!user.password.startsWith('scrypt$')) {
      await db.run('UPDATE utenti SET password = ? WHERE id = ?', hashPassword(password), user.id);
    }
    const token = await createSession(db, user.id);
    res.json({ user: sanitizeUser(user), token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/logout', authenticateUser, async (req, res) => {
  try {
    const db = await dbPromise;
    await db.run('DELETE FROM sessioni WHERE token = ?', req.user.token);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================= ROUTE: PROPOSTE =========================
async function scadiProposte(db) {
  await db.run("UPDATE proposte SET stato = 'scaduta' WHERE stato = 'in_attesa' AND scade_il < ?", new Date().toISOString());
}

app.post('/api/proposte', authenticateUser, requireNotGuest, async (req, res) => {
  const { id, mittenteId, destinatarioId, tipo, dati } = req.body;
  if (!id || !mittenteId || !destinatarioId || !tipo) return res.status(400).json({ error: 'Dati mancanti' });
  try {
    const db = await dbPromise;
    const mitt = await db.get('SELECT user_id FROM personaggi WHERE id = ?', mittenteId);
    if (!mitt || (req.user.role !== 'master' && mitt.user_id !== req.user.id)) {
      return res.status(403).json({ error: 'Non sei il proprietario del mittente' });
    }
    const scadeIl = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    await db.run(
      'INSERT INTO proposte (id, mittente_id, destinatario_id, tipo, dati, scade_il) VALUES (?, ?, ?, ?, ?, ?)',
      id, mittenteId, destinatarioId, tipo, JSON.stringify(dati || {}), scadeIl
    );
    res.json({ success: true, scadeIl });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/proposte', authenticateUser, async (req, res) => {
  try {
    const db = await dbPromise;
    await scadiProposte(db);
    const proposte = req.user.role === 'master'
      ? await db.all("SELECT * FROM proposte WHERE stato IN ('in_attesa','accettata')")
      : await db.all(`
          SELECT pr.* FROM proposte pr
          JOIN personaggi d ON d.id = pr.destinatario_id
          JOIN personaggi m ON m.id = pr.mittente_id
          WHERE pr.stato = 'in_attesa' AND (d.user_id = ? OR m.user_id = ?)`, req.user.id, req.user.id);
    res.json({ proposte });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/proposte/:id/rispondi', authenticateUser, requireNotGuest, async (req, res) => {
  const { risposta } = req.body;
  if (!['accetta', 'rifiuta'].includes(risposta)) return res.status(400).json({ error: 'Risposta non valida' });
  try {
    const db = await dbPromise;
    await scadiProposte(db);
    const pr = await db.get('SELECT * FROM proposte WHERE id = ?', req.params.id);
    if (!pr) return res.status(404).json({ error: 'Proposta non trovata' });
    if (pr.stato !== 'in_attesa') return res.status(409).json({ error: 'Proposta già gestita o scaduta' });
    const dest = await db.get('SELECT user_id FROM personaggi WHERE id = ?', pr.destinatario_id);
    if (req.user.role !== 'master' && (!dest || dest.user_id !== req.user.id)) {
      return res.status(403).json({ error: 'Non sei il destinatario' });
    }
    await db.run('UPDATE proposte SET stato = ? WHERE id = ?', risposta === 'accetta' ? 'accettata' : 'rifiutata', pr.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// ========================= ROUTE: PERSONAGGI =========================

app.get('/api/personaggi/:id', authenticateUser, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID non valido' });
  try {
    const db = await dbPromise;
    const personaggio = await db.get(`
      SELECT p.*, u.username AS owner_username
      FROM personaggi p JOIN utenti u ON u.id = p.user_id
      WHERE p.id = ?`, id);
    if (!personaggio) return res.status(404).json({ error: 'Personaggio non trovato' });
    if (req.user.role !== 'master' && personaggio.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }
    res.json({ personaggio });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/inviti', authenticateUser, requireNotGuest, async (req, res) => {
  const { idSpedizione, mittenteId, destinatariIds } = req.body;
  if (!idSpedizione || !mittenteId || !Array.isArray(destinatariIds) || destinatariIds.length === 0) {
    return res.status(400).json({ error: 'Dati mancanti' });
  }
  const db = await dbPromise;
  const scadeIl = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  const creati = [];
  for (const destId of destinatariIds) {
    const result = await db.run(
        'INSERT INTO inviti_esplorazione (id_spedizione, mittente_personaggio_id, destinatario_personaggio_id, stato, scade_il) VALUES (?, ?, ?, ?, ?)',
        idSpedizione, mittenteId, destId, 'in_attesa', scadeIl
    );
    creati.push(result.lastID);
  }
  res.json({ success: true, invitiId: creati, scadeIl });
});

app.get('/api/inviti', authenticateUser, async (req, res) => {
  const { personaggioId, idSpedizione } = req.query;
  const db = await dbPromise;
  let rows;
  if (idSpedizione) {
    rows = await db.all('SELECT * FROM inviti_esplorazione WHERE id_spedizione = ?', idSpedizione);
  } else if (personaggioId) {
    rows = await db.all('SELECT * FROM inviti_esplorazione WHERE destinatario_personaggio_id = ? AND stato = "in_attesa"', personaggioId);
  } else {
    return res.status(400).json({ error: 'personaggioId o idSpedizione richiesto' });
  }
  const now = new Date();
  for (const r of rows) {
    if (r.stato === 'in_attesa' && new Date(r.scade_il) < now) {
      await db.run('UPDATE inviti_esplorazione SET stato = ? WHERE id = ?', 'scaduto', r.id);
      r.stato = 'scaduto';
    }
  }
  res.json({ inviti: rows });
});

app.post('/api/inviti/:id/rispondi', authenticateUser, requireNotGuest, async (req, res) => {
  const inviteId = parseInt(req.params.id, 10);
  const { risposta } = req.body;
  if (!['accetta', 'rifiuta'].includes(risposta)) return res.status(400).json({ error: 'Risposta non valida' });
  const db = await dbPromise;
  const invito = await db.get('SELECT * FROM inviti_esplorazione WHERE id = ?', inviteId);
  if (!invito) return res.status(404).json({ error: 'Invito non trovato' });
  if (invito.stato !== 'in_attesa') return res.status(409).json({ error: 'Invito già gestito' });
  if (new Date(invito.scade_il) < new Date()) {
    await db.run('UPDATE inviti_esplorazione SET stato = ? WHERE id = ?', 'scaduto', inviteId);
    return res.status(409).json({ error: 'Invito scaduto' });
  }
  await db.run('UPDATE inviti_esplorazione SET stato = ? WHERE id = ?', risposta === 'accetta' ? 'accettato' : 'rifiutato', inviteId);
  res.json({ success: true });
});
// GET /api/characters - Supporta il fetch di tutti i personaggi per il Master
app.get('/api/characters', authenticateUser, async (req, res) => {
  try {
    const db = await dbPromise;
    let characters;

    // Se viene richiesto all=true, restituisci tutto (inclusi i morti)
    if (req.query.all === 'true') {
      characters = await db.all("SELECT * FROM personaggi ORDER BY created_at DESC");
    } else {
      // Di base restituiamo i vivi dell'utente, ma il client ora usa all=true per la lobby
      characters = await db.all("SELECT * FROM personaggi WHERE user_id = ? AND status != 'morto' ORDER BY created_at DESC", req.user.id);
    }

    // Parsing del campo JSON "data" per il frontend
    characters = characters.map(c => {
      if (c.data && typeof c.data === 'string') {
        try {
          c.data = JSON.parse(c.data);
        } catch (e) {
          c.data = {};
        }
      }

      // Assicuriamoci che la stamina sia esposta a livello radice per l'UI del master
      if (c.stamina === undefined && c.data) {
        c.stamina = c.data.staminaAttuale || c.data.stamina || 0;
      }

      return c;
    });

    res.json({ characters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cimitero', authenticateUser, async (req, res) => {
  try {
    const db = await dbPromise;
    const rows = await db.all("SELECT * FROM personaggi WHERE status = 'morto' ORDER BY updated_at DESC");
    const cimitero = rows.map(c => {
      let data = {};
      if (c.data && typeof c.data === 'string') {
        try { data = JSON.parse(c.data); } catch (e) { data = {}; }
      }
      return { id: c.id, nome: c.nome, data };
    });
    res.json({ cimitero });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/characters', authenticateUser, requireNotGuest, async (req, res) => {
  const { nome, classe, data, updated_at, campoBaseId } = req.body;
  try {
    const db = await dbPromise;

    if (req.user.role !== 'master') {
      const count = await db.get("SELECT COUNT(*) as count FROM personaggi WHERE user_id = ? AND status = 'vivo' AND nome != ?", req.user.id, nome);
      if (count.count >= 4) {
        return res.status(403).json({ error: 'Hai già 4 personaggi attivi. Eliminane uno prima di crearne un altro.' });
      }
    }
    if (!nome || !classe) {
      return res.status(400).json({ error: 'nome e classe richiesti' });
    }

    let campoFinale = parseInt(campoBaseId, 10);
    if (isNaN(campoFinale)) campoFinale = 1;
    const campoEsiste = await db.get('SELECT id FROM campi_base WHERE id = ?', campoFinale);
    if (!campoEsiste) return res.status(400).json({ error: 'Campo base non trovato' });

    const existing = await db.get('SELECT * FROM personaggi WHERE user_id = ? AND nome = ?', req.user.id, nome);
    if (existing) {
  if (existing.status === 'morto') return res.status(409).json({ error: 'Questo personaggio è morto.' });
  await db.run(
          'UPDATE personaggi SET data = ?, updated_at = ?, classe = ?, campo_base_id = ?, status = ? WHERE id = ?',
          typeof data === 'string' ? data : JSON.stringify(data || {}),
          updated_at || new Date().toISOString(), classe, campoFinale, 'vivo', existing.id
      );
      const character = await db.get('SELECT * FROM personaggi WHERE id = ?', existing.id);
      return res.json({ character });
    }
    const result = await db.run(
        'INSERT INTO personaggi (user_id, nome, classe, data, updated_at, campo_base_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        req.user.id, nome, classe,
        typeof data === 'string' ? data : JSON.stringify(data || {}),
        updated_at || new Date().toISOString(), campoFinale, 'vivo'
    );
    const character = await db.get('SELECT * FROM personaggi WHERE id = ?', result.lastID);
    res.json({ character });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/personaggi/:id', authenticateUser, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID non valido' });

  const db = await dbPromise;
  const personaggio = await db.get('SELECT * FROM personaggi WHERE id = ?', id);
  if (!personaggio) return res.status(404).json({ error: 'Personaggio non trovato' });

  if (req.user.role !== 'master' && personaggio.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  // Se vuoi eliminare anche i documenti (in caso di ON DELETE SET NULL)
  await db.run('DELETE FROM documenti WHERE personaggio_id = ?', id);
  // Elimina il personaggio (gli stati alterati saranno eliminati per CASCADE)
  await db.run('DELETE FROM personaggi WHERE id = ?', id);

  res.json({ success: true });
});

app.put('/api/personaggi/:id', authenticateUser, requireNotGuest, async (req, res) => {
  const personaggioId = parseInt(req.params.id, 10);
  const { data, status } = req.body;
  if (isNaN(personaggioId)) {
    return res.status(400).json({ error: 'ID personaggio non valido' });
  }
  if (!data) {
    return res.status(400).json({ error: 'campo data richiesto' });
  }
  try {
    const db = await dbPromise;
    const personaggio = await db.get('SELECT * FROM personaggi WHERE id = ?', personaggioId);
    if (!personaggio) {
      return res.status(404).json({ error: 'Personaggio non trovato' });
    }
    if (req.user.role !== 'master' && personaggio.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Non hai il permesso di modificare questo personaggio' });
    }

        const { campoBaseId } = req.body;
    const isMaster = req.user.role === 'master';
    const staRiattivando = !isMaster && personaggio.status === 'in_attesa' && status === 'vivo';

    let campoFinale = personaggio.campo_base_id;
    if (campoBaseId !== undefined && (isMaster || staRiattivando)) {
      const nuovoCampo = parseInt(campoBaseId, 10);
      const campoEsiste = await db.get('SELECT id FROM campi_base WHERE id = ?', nuovoCampo);
      if (!campoEsiste) return res.status(400).json({ error: 'Campo base non trovato' });
      campoFinale = nuovoCampo;
    }

    let finalStatus = personaggio.status;
    if (isMaster) {
      finalStatus = status || personaggio.status;
    } else if (staRiattivando) {
      const count = await db.get(
          "SELECT COUNT(*) as count FROM personaggi WHERE user_id = ? AND status = 'vivo' AND id != ?",
          req.user.id, personaggioId
      );
      if (count.count >= 2) {
        return res.status(403).json({ error: 'Hai già 2 personaggi attivi. Eliminane uno prima di riattivarne un altro.' });
      }
      finalStatus = 'vivo';
    } else if (status === 'morto' && personaggio.status === 'vivo') {
      finalStatus = 'morto';
    }
    if (staRiattivando) {
      const count = await db.get(
          'SELECT COUNT(*) as count FROM personaggi WHERE user_id = ? AND status = "vivo" AND id != ?',
          req.user.id, personaggioId
      );
      if (count.count >= 2) {
        return res.status(403).json({ error: 'Hai già 2 personaggi attivi. Eliminane uno prima di riattivarne un altro.' });
      }
      finalStatus = 'vivo';
    }

      const dataJson = typeof data === 'string' ? data : JSON.stringify(data);

    await db.run(
        'UPDATE personaggi SET data = ?, status = ?, updated_at = ?, campo_base_id = ? WHERE id = ?',
        dataJson, finalStatus, new Date().toISOString(), campoFinale, personaggioId,
    );

    const updated = await db.get('SELECT * FROM personaggi WHERE id = ?', personaggioId);
    if (updated.data && typeof updated.data === 'string') {
      try { updated.data = JSON.parse(updated.data); } catch (e) { updated.data = {}; }
    }
    res.json({ personaggio: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// ========================= ROUTE: DOCUMENTI =========================

app.post('/api/documenti', authenticateUser, requireMaster, async (req, res) => {
  const { contenuto, personaggio_id, personaggioId, titolo, campoBaseId, lingua, testo } = req.body;
  try {
    const db = await dbPromise;
    const payload = contenuto || creaContenutoDocumento({
      lingua: lingua || 'Verbum',
      testo: testo || ''
    });
    const targetId = (personaggio_id !== undefined && personaggio_id !== null && personaggio_id !== '')
        ? personaggio_id
        : (personaggioId !== undefined && personaggioId !== null && personaggioId !== '' ? personaggioId : 0);

    // Ricava il campo base dal personaggio destinatario, se presente, altrimenti usa quello passato esplicitamente
    let campoFinale = parseInt(campoBaseId, 10);
    if (isNaN(campoFinale)) {
      if (targetId) {
        const char = await db.get('SELECT campo_base_id FROM personaggi WHERE id = ?', targetId);
        campoFinale = char ? char.campo_base_id : 1;
      } else {
        campoFinale = 1;
      }
    }

    const result = await db.run(
        'INSERT INTO documenti (master_id, personaggio_id, titolo, contenuto, campo_base_id) VALUES (?, ?, ?, ?, ?)',
      req.user.id, targetId, titolo || 'Documento senza titolo', payload, campoFinale,
    );
    const document = await db.get('SELECT * FROM documenti WHERE id = ?', result.lastID);
    res.json({ document });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/archivio-documenti', authenticateUser, requireMaster, async (_req, res) => {
  try {
    const db = await dbPromise;
    const documenti = await db.all('SELECT * FROM documenti_archivio ORDER BY id DESC');
    res.json({ documenti });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/archivio-documenti', authenticateUser, requireMaster, async (req, res) => {
  const titolo = String(req.body?.titolo || '').trim();
  const lingua = String(req.body?.lingua || '').trim();
  const testo = String(req.body?.testo || '');
  if (!titolo || !lingua || !testo) {
    return res.status(400).json({ error: 'titolo, lingua e testo sono obbligatori' });
  }
  try {
    const db = await dbPromise;
    const contenuto = JSON.parse(creaContenutoDocumento({ lingua, testo }));
    const result = await db.run(
      'INSERT INTO documenti_archivio (titolo, lingua, testo_originale, testo_criptato) VALUES (?, ?, ?, ?)',
      titolo,
      lingua,
      contenuto.testo_originale,
      contenuto.testo_criptato
    );
    const documento = await db.get('SELECT * FROM documenti_archivio WHERE id = ?', result.lastID);
    res.json({ documento });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/archivio-documenti/:id', authenticateUser, requireMaster, async (req, res) => {
  const id = parseIntStrict(req.params.id);
  if (id === null || id <= 0) return res.status(400).json({ error: 'ID documento non valido' });
  const titolo = String(req.body?.titolo || '').trim();
  const lingua = String(req.body?.lingua || '').trim();
  const testo = String(req.body?.testo || '');
  if (!titolo || !lingua || !testo) {
    return res.status(400).json({ error: 'titolo, lingua e testo sono obbligatori' });
  }
  try {
    const db = await dbPromise;
    const existing = await db.get('SELECT id FROM documenti_archivio WHERE id = ?', id);
    if (!existing) return res.status(404).json({ error: 'Documento archivio non trovato' });
    const contenuto = JSON.parse(creaContenutoDocumento({ lingua, testo }));
    await db.run(
      'UPDATE documenti_archivio SET titolo = ?, lingua = ?, testo_originale = ?, testo_criptato = ? WHERE id = ?',
      titolo,
      lingua,
      contenuto.testo_originale,
      contenuto.testo_criptato,
      id
    );
    const documento = await db.get('SELECT * FROM documenti_archivio WHERE id = ?', id);
    res.json({ documento });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/archivio-documenti/:id', authenticateUser, requireMaster, async (req, res) => {
  const id = parseIntStrict(req.params.id);
  if (id === null || id <= 0) return res.status(400).json({ error: 'ID documento non valido' });
  try {
    const db = await dbPromise;
    const existing = await db.get('SELECT id FROM documenti_archivio WHERE id = ?', id);
    if (!existing) return res.status(404).json({ error: 'Documento archivio non trovato' });
    await db.run('DELETE FROM documenti_archivio WHERE id = ?', id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/archivio-documenti/:id/dai', authenticateUser, requireMaster, async (req, res) => {
  const id = parseIntStrict(req.params.id);
  const personaggioId = parseIntStrict(req.body?.personaggioId);
  if (id === null || id <= 0 || personaggioId === null || personaggioId <= 0) {
    return res.status(400).json({ error: 'ID documento o personaggio non valido' });
  }
  try {
    const db = await dbPromise;
    const archivioDoc = await db.get('SELECT * FROM documenti_archivio WHERE id = ?', id);
    if (!archivioDoc) return res.status(404).json({ error: 'Documento archivio non trovato' });

    const personaggio = await db.get('SELECT id, campo_base_id FROM personaggi WHERE id = ?', personaggioId);
    if (!personaggio) return res.status(404).json({ error: 'Personaggio non trovato' });

    const contenuto = JSON.stringify({
      lingua_richiesta: archivioDoc.lingua,
      testo_originale: archivioDoc.testo_originale,
      testo_criptato: archivioDoc.testo_criptato
    });

    const result = await db.run(
      'INSERT INTO documenti (master_id, personaggio_id, titolo, contenuto, campo_base_id) VALUES (?, ?, ?, ?, ?)',
      req.user.id,
      personaggioId,
      archivioDoc.titolo,
      contenuto,
      personaggio.campo_base_id || 1
    );
    const document = await db.get('SELECT * FROM documenti WHERE id = ?', result.lastID);
    res.json({ document });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/documenti', authenticateUser, async (req, res) => {
  const personaggioId = req.query.personaggioId || req.query.personaggio_id;
  const campoBaseId = req.query.campoBaseId ? parseInt(req.query.campoBaseId, 10) : null;
  try {
    const db = await dbPromise;
    let documenti = [];
    if (personaggioId !== undefined) {
      const id = Number(personaggioId);
      if (id !== 0) {
        const char = await db.get('SELECT user_id FROM personaggi WHERE id = ?', id);
        if (!char || (char.user_id !== req.user.id && req.user.role !== 'master')) {
          return res.status(403).json({ error: 'Accesso negato a questi documenti' });
        }
        documenti = await db.all('SELECT * FROM documenti WHERE personaggio_id = ? ORDER BY id DESC', id);
      } else {
        // Biblioteca (personaggio_id=0): serve il campo base per non mischiare biblioteche diverse
        if (!campoBaseId) return res.status(400).json({ error: 'campoBaseId richiesto per la biblioteca' });
        documenti = await db.all('SELECT * FROM documenti WHERE personaggio_id = 0 AND campo_base_id = ? ORDER BY id DESC', campoBaseId);
      }
    } else if (req.user.role === 'master') {
      documenti = campoBaseId
        ? await db.all('SELECT * FROM documenti WHERE campo_base_id = ? ORDER BY id DESC', campoBaseId)
        : await db.all('SELECT * FROM documenti ORDER BY id DESC');
    } else {
      return res.status(400).json({ error: 'personaggioId richiesto' });
    }
    res.json({ documenti });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/documenti/:id/passa', authenticateUser, requireNotGuest, async (req, res) => {
  const docId = parseInt(req.params.id, 10);
  const { nuovoProprietarioId } = req.body;
  if (isNaN(docId) || isNaN(nuovoProprietarioId)) {
    return res.status(400).json({ error: 'Dati non validi.' });
  }
  try {
    const db = await dbPromise;
    const doc = await db.get('SELECT personaggio_id FROM documenti WHERE id = ?', docId);
    if (!doc) return res.status(404).json({ error: 'Documento non trovato' });
    const mittenteChar = await db.get('SELECT user_id FROM personaggi WHERE id = ?', doc.personaggio_id);
    if (!mittenteChar || (mittenteChar.user_id !== req.user.id && req.user.role !== 'master')) {
      return res.status(403).json({ error: 'Non sei il proprietario del documento' });
    }
    const destChar = await db.get('SELECT id FROM personaggi WHERE id = ?', nuovoProprietarioId);
    if (!destChar) return res.status(404).json({ error: 'Personaggio destinatario non trovato' });
    await db.run('UPDATE documenti SET personaggio_id = ? WHERE id = ?', [nuovoProprietarioId, docId]);
    res.json({ success: true, message: 'Documento trasferito.' });
  } catch (err) {
    res.status(500).json({ error: 'Errore interno.' });
  }
});

app.post('/api/documenti/:id/archivia', authenticateUser, requireNotGuest, async (req, res) => {
  const docId = parseInt(req.params.id, 10);
  if (isNaN(docId)) return res.status(400).json({ error: 'ID non valido.' });
  try {
    const db = await dbPromise;
    const doc = await db.get('SELECT personaggio_id FROM documenti WHERE id = ?', docId);
    if (!doc) return res.status(404).json({ error: 'Documento non trovato' });
    const mittenteChar = await db.get('SELECT user_id FROM personaggi WHERE id = ?', doc.personaggio_id);
    if (!mittenteChar || (mittenteChar.user_id !== req.user.id && req.user.role !== 'master')) {
      return res.status(403).json({ error: 'Non sei il proprietario del documento' });
    }
    await db.run('UPDATE documenti SET personaggio_id = 0 WHERE id = ?', [docId]);
    res.json({ success: true, message: 'Documento archiviato.' });
  } catch (err) {
    res.status(500).json({ error: 'Errore interno.' });
  }
});

app.delete('/api/documenti/:id', authenticateUser, requireMaster, async (req, res) => {
  const docId = parseInt(req.params.id, 10);
  if (isNaN(docId)) return res.status(400).json({ error: 'ID non valido.' });
  try {
    const db = await dbPromise;
    const doc = await db.get('SELECT id FROM documenti WHERE id = ?', docId);
    if (!doc) return res.status(404).json({ error: 'Documento non trovato' });
    await db.run('DELETE FROM documenti WHERE id = ?', docId);
    res.json({ success: true, message: 'Documento eliminato.' });
  } catch (err) {
    res.status(500).json({ error: 'Errore interno.' });
  }
});

// ========================= ROUTE: MAGAZZINO =========================
app.put('/api/documenti/:id/rinomina', authenticateUser, requireNotGuest, async (req, res) => {
  const docId = parseInt(req.params.id, 10);
  const { titolo } = req.body;
  if (isNaN(docId) || !titolo) return res.status(400).json({ error: 'Dati non validi.' });
  try {
    const db = await dbPromise;
    const doc = await db.get('SELECT * FROM documenti WHERE id = ?', docId);
    if (!doc) return res.status(404).json({ error: 'Documento non trovato' });
    if (doc.personaggio_id) {
      const char = await db.get('SELECT user_id FROM personaggi WHERE id = ?', doc.personaggio_id);
      if (char && char.user_id !== req.user.id && req.user.role !== 'master') {
        return res.status(403).json({ error: 'Non sei il proprietario del documento' });
      }
    }
    await db.run('UPDATE documenti SET titolo = ? WHERE id = ?', [titolo, docId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Errore interno.' });
  }
});

app.put('/api/documenti/:id/traduci', authenticateUser, requireNotGuest, async (req, res) => {
  const docId = parseInt(req.params.id, 10);
  const { lingua } = req.body;
  if (isNaN(docId) || !lingua) return res.status(400).json({ error: 'Dati non validi.' });
  try {
    const db = await dbPromise;
    const doc = await db.get('SELECT * FROM documenti WHERE id = ?', docId);
    if (!doc) return res.status(404).json({ error: 'Documento non trovato' });
    let traduzioni = [];
    try { traduzioni = JSON.parse(doc.traduzioni || '[]'); } catch {}
    if (!traduzioni.includes(lingua)) traduzioni.push(lingua);
    await db.run('UPDATE documenti SET traduzioni = ? WHERE id = ?', [JSON.stringify(traduzioni), docId]);
    res.json({ success: true, traduzioni });
  } catch (err) {
    res.status(500).json({ error: 'Errore interno.' });
  }
});

app.get('/api/magazzino', authenticateUser, async (req, res) => {
  const campoBaseId = req.query.campoBaseId ? parseInt(req.query.campoBaseId, 10) : 1;
  if (isNaN(campoBaseId)) return res.status(400).json({ error: 'campoBaseId non valido' });
  try {
    const db = await dbPromise;
    let row = await db.get('SELECT * FROM magazzini WHERE campo_base_id = ?', campoBaseId);
    if (!row) {
      await db.run('INSERT INTO magazzini (campo_base_id, data) VALUES (?, ?)', campoBaseId, '{}');
      row = await db.get('SELECT * FROM magazzini WHERE campo_base_id = ?', campoBaseId);
    }
    if (row && row.data && typeof row.data === 'string') {
      try {
        row.data = JSON.parse(row.data);
      } catch (e) {
        row.data = {};
      }
    }
    res.json({ magazzino: row });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/magazzino', authenticateUser, requireNotGuest, async (req, res) => {
  const campoBaseId = req.query.campoBaseId ? parseInt(req.query.campoBaseId, 10) : (req.body?.campoBaseId ? parseInt(req.body.campoBaseId, 10) : 1);
  if (isNaN(campoBaseId)) return res.status(400).json({ error: 'campoBaseId non valido' });
  const payload = req.body?.data || req.body || {};
  try {
    const db = await dbPromise;
    const current = await db.get('SELECT * FROM magazzini WHERE campo_base_id = ?', campoBaseId);
    const currentData = current?.data ? JSON.parse(current.data) : {};
    const mergedData = { ...currentData, ...(payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}) };
    if (current) {
      await db.run(
          'UPDATE magazzini SET data = ?, updated_at = ? WHERE campo_base_id = ?',
          JSON.stringify(mergedData), new Date().toISOString(), campoBaseId,
      );
    } else {
      await db.run(
          'INSERT INTO magazzini (campo_base_id, data, updated_at) VALUES (?, ?, ?)',
          campoBaseId, JSON.stringify(mergedData), new Date().toISOString(),
      );
    }
    const updated = await db.get('SELECT * FROM magazzini WHERE campo_base_id = ?', campoBaseId);
    if (updated && updated.data && typeof updated.data === 'string') {
      try {
        updated.data = JSON.parse(updated.data);
      } catch (e) {
        updated.data = {};
      }
    }
    res.json({ magazzino: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/proposte/:id/esegui', authenticateUser, requireMaster, async (req, res) => {
  try {
    const db = await dbPromise;
    const r = await db.run("UPDATE proposte SET stato = 'eseguita' WHERE id = ? AND stato = 'accettata'", req.params.id);
    if (!r.changes) return res.status(409).json({ error: 'Proposta non eseguibile' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/magazzino/transfer', authenticateUser, requireNotGuest, async (req, res) => {
  const payload = req.body?.data || {};
  const campoBaseId = req.body?.campoBaseId ? parseInt(req.body.campoBaseId, 10) : 1;
  if (!payload || Object.keys(payload).length === 0) {
    return res.status(400).json({ error: 'Dati mancanti' });
  }
  if (isNaN(campoBaseId) || campoBaseId <= 0) {
    return res.status(400).json({ error: 'campoBaseId non valido' });
  }
  try {
    const db = await dbPromise;
    const current = await db.get('SELECT * FROM magazzini WHERE campo_base_id = ?', campoBaseId);
    const currentData = current?.data ? JSON.parse(current.data) : {};
    const allowedFields = ['cibo', 'acqua', 'conserve', 'piattiDeliziosi', 'materialiAlchemici', 'ingranaggi', 'materialiMedici'];
    const mergedData = { ...currentData };
    for (const field of allowedFields) {
      if (payload[field] !== undefined) {
        if (field === 'materialiMedici' && typeof payload[field] === 'object') {
          mergedData.materialiMedici = {
            ...(mergedData.materialiMedici || {}),
            ...payload[field],
          };
        } else {
          mergedData[field] = payload[field];
        }
      }
    }
    for (const [key, val] of Object.entries(mergedData)) {
      if (typeof val === 'number' && val < 0) {
        return res.status(400).json({ error: `Valore negativo per ${key}` });
      }
    }
    if (current) {
      await db.run(
        'UPDATE magazzini SET data = ?, updated_at = ? WHERE campo_base_id = ?',
        JSON.stringify(mergedData),
        new Date().toISOString(),
        campoBaseId
      );
    } else {
      await db.run(
        'INSERT INTO magazzini (campo_base_id, data, updated_at) VALUES (?, ?, ?)',
        campoBaseId,
        JSON.stringify(mergedData),
        new Date().toISOString()
      );
    }
    const updated = await db.get('SELECT * FROM magazzini WHERE campo_base_id = ?', campoBaseId);
    if (updated && updated.data && typeof updated.data === 'string') {
      try {
        updated.data = JSON.parse(updated.data);
      } catch (e) {
        updated.data = {};
      }
    }
    res.json({ magazzino: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================= ROUTE: STATI ALTERATI =========================

app.get('/api/personaggi/:id/stati', authenticateUser, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (isNaN(targetId) || targetId <= 0) {
      return res.status(400).json({ error: 'ID personaggio non valido' });
    }

    const db = await dbPromise;

    // Verifica esistenza e permessi
    const personaggio = await db.get(
        'SELECT id, user_id FROM personaggi WHERE id = ?',
        targetId
    );
    if (!personaggio) {
      return res.status(404).json({ error: 'Personaggio non trovato' });
    }
    // Solo master o il proprietario possono vedere gli stati
    if (req.user.role !== 'master' && personaggio.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    const now = new Date().toISOString();
    const query = `
      SELECT *
      FROM stati_alterati
      WHERE personaggio_id = ?
        AND (durata_minuti = 0 OR datetime(applicato_il, '+' || durata_minuti || ' minutes') > datetime(?))
      ORDER BY applicato_il DESC
    `;
    const stati = await db.all(query, [targetId, now]);

    // (Opzionale) se la tabella ha un campo modificatori JSON, lo gestiamo
    const parsed = stati.map(s => {
      let modificatori = [];
      try {
        if (s.modificatori) modificatori = JSON.parse(s.modificatori);
      } catch (_) {}
      return { ...s, modificatori };
    });

    res.json({ stati: parsed });
  } catch (error) {
    console.error('Errore nel recupero stati alterati:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ========================= ROUTE: MASTER UTILITIES =========================
app.post('/api/master/push-commands', authenticateUser, requireMaster, async (req, res) => {
  const { target, tipo, valore, note } = req.body;
  if (!target || !tipo) {
    return res.status(400).json({ error: 'target e tipo richiesti' });
  }
  res.json({ success: true, target, tipo, valore, note });
});

app.post('/api/master/apply-state', authenticateUser, requireMaster, async (req, res) => {
  const { personaggio_id, personaggioId, nome, tipo, descrizione = '', durata_minuti = 0, modificatori = [], fonte = 'master' } = req.body;
  const targetId = personaggio_id || personaggioId;
  if (!targetId || !tipo) return res.status(400).json({ error: 'personaggio_id e tipo richiesti' });
  const db = await dbPromise;
  await db.run(
      'INSERT INTO stati_alterati (personaggio_id, nome, tipo, descrizione, durata_minuti, valore, modificatori, fonte) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      targetId, nome || '', tipo, descrizione, durata_minuti, 0, JSON.stringify(modificatori), fonte,
  );
  res.json({ success: true });
});

// ========================= FALLBACK SPA =========================

app.get('*', (req, res) => {
  res.sendFile(join(staticPath, 'index.html'));
});

// ========================= AVVIO =========================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Zombie Asylum server in ascolto su http://localhost:${PORT}`);
});