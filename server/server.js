import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { openDatabase } from './db.js';

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

async function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await db.run('INSERT INTO sessioni (token, user_id, expires_at) VALUES (?, ?, ?)', token, userId, expiresAt);
  return token;
}

function redactCharacterData(data) {
  if (!data) return {};
  return {
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
    let characters = await db.all(`
      SELECT p.*, u.username AS owner_username
      FROM personaggi p JOIN utenti u ON u.id = p.user_id
      WHERE p.status != 'morto' ORDER BY p.created_at DESC`);

    characters = characters.map(c => {
      if (c.data && typeof c.data === 'string') {
        try { c.data = JSON.parse(c.data); } catch (e) { c.data = {}; }
      }
      if (req.user.role !== 'master' && c.user_id !== req.user.id) {
        c.data = redactCharacterData(c.data);
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

// ========================= ROUTE: PERSONAGGI =========================

// GET /api/party – unica route, gestisce master, giocatore, ospite
app.get('/api/party', authenticateUser, async (req, res) => {
  try {
    const db = await dbPromise;
    let characters;
    if (req.user.role === 'master' || req.user.role === 'giocatore' || req.user.role === 'ospite') {
      characters = await db.all(`
        SELECT p.*, u.username AS owner_username
        FROM personaggi p JOIN utenti u ON u.id = p.user_id
        WHERE p.status != 'morto' ORDER BY p.created_at DESC`);
    } else {
      characters = [];
    }
    characters = characters.map(c => {
      if (c.data && typeof c.data === 'string') {
        try { c.data = JSON.parse(c.data); } catch (e) { c.data = {}; }
      }
      return c;
    });
    res.json({ party: characters });
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
  const { nome, classe, data, updated_at } = req.body;
  try {
    const db = await dbPromise;

    if (req.user.role !== 'master') {
      const count = await db.get(
          'SELECT COUNT(*) as count FROM personaggi WHERE user_id = ? AND status != "morto"',
          req.user.id
      );
      if (count.count >= 2) {
        return res.status(403).json({ error: 'Hai già 2 personaggi attivi. Eliminane uno prima di crearne un altro.' });
      }
    }
    if (!nome || !classe) {
      return res.status(400).json({ error: 'nome e classe richiesti' });
    }

    const existing = await db.get('SELECT * FROM personaggi WHERE user_id = ? AND nome = ?', req.user.id, nome);
    if (existing) {
      await db.run(
          'UPDATE personaggi SET data = ?, updated_at = ?, classe = ? WHERE id = ?',
          typeof data === 'string' ? data : JSON.stringify(data || {}),
          updated_at || new Date().toISOString(), classe, existing.id
      );
      const character = await db.get('SELECT * FROM personaggi WHERE id = ?', existing.id);
      return res.json({ character });
    }
    const result = await db.run(
        'INSERT INTO personaggi (user_id, nome, classe, data, updated_at) VALUES (?, ?, ?, ?, ?)',
        req.user.id, nome, classe,
        typeof data === 'string' ? data : JSON.stringify(data || {}),
        updated_at || new Date().toISOString()
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
    
    // Se non è master, forziamo il mantenimento dello status attuale o comunque impediamo di resuscitare
    let finalStatus = status || personaggio.status;
    if (req.user.role !== 'master') {
       finalStatus = personaggio.status; // I giocatori non possono cambiare lo status (es. da morto a vivo)
    }
    const staRiattivando = req.user.role === 'master'
        ? false
        : (personaggio.status !== 'vivo' && status === 'vivo');
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
        'UPDATE personaggi SET data = ?, status = ?, updated_at = ? WHERE id = ?',
        dataJson, finalStatus, new Date().toISOString(), personaggioId,
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
  const { contenuto, personaggio_id, personaggioId, titolo } = req.body;
  try {
    const db = await dbPromise;
    const payload = contenuto || JSON.stringify({});
    const targetId = (personaggio_id !== undefined && personaggio_id !== null && personaggio_id !== '')
        ? personaggio_id
        : (personaggioId !== undefined && personaggioId !== null && personaggioId !== '' ? personaggioId : 0);
    const result = await db.run(
        'INSERT INTO documenti (master_id, personaggio_id, titolo, contenuto) VALUES (?, ?, ?, ?)',
        req.user.id, targetId, titolo, payload,
    );
    const document = await db.get('SELECT * FROM documenti WHERE id = ?', result.lastID);
    res.json({ document });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/documenti', authenticateUser, async (req, res) => {
  const personaggioId = req.query.personaggioId || req.query.personaggio_id;
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
      }
      documenti = await db.all('SELECT * FROM documenti WHERE personaggio_id = ? ORDER BY id DESC', id);
    } else if (req.user.role === 'master') {
      documenti = await db.all('SELECT * FROM documenti ORDER BY id DESC');
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
  try {
    const db = await dbPromise;
    const row = await db.get('SELECT * FROM magazzino WHERE id = 1');
    if (row && row.data && typeof row.data === 'string') {
      try {
        row.data = JSON.parse(row.data);
      } catch (e) {
        row.data = {};
      }
    }
    res.json({ magazzino: row || { id: 1, data: {}, updated_at: new Date().toISOString() } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/magazzino', authenticateUser, requireMaster, async (req, res) => {
  const payload = req.body?.data || req.body || {};
  try {
    const db = await dbPromise;
    const current = await db.get('SELECT * FROM magazzino WHERE id = 1');
    const currentData = current?.data ? JSON.parse(current.data) : {};
    const mergedData = { ...currentData, ...(payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}) };
    await db.run(
        'UPDATE magazzino SET data = ?, updated_at = ? WHERE id = 1',
        JSON.stringify(mergedData),
        new Date().toISOString(),
    );
    const updated = await db.get('SELECT * FROM magazzino WHERE id = 1');
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

app.post('/api/magazzino/transfer', authenticateUser, requireNotGuest, async (req, res) => {
  const payload = req.body?.data || {};
  if (!payload || Object.keys(payload).length === 0) {
    return res.status(400).json({ error: 'Dati mancanti' });
  }
  try {
    const db = await dbPromise;
    const current = await db.get('SELECT * FROM magazzino WHERE id = 1');
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
    await db.run(
        'UPDATE magazzino SET data = ?, updated_at = ? WHERE id = 1',
        JSON.stringify(mergedData),
        new Date().toISOString(),
    );
    const updated = await db.get('SELECT * FROM magazzino WHERE id = 1');
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