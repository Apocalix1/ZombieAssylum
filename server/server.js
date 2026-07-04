import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { openDatabase } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../client')));

const dbPromise = openDatabase();

// 🟢 FIX: Funzione per rimuovere la password dall'oggetto utente prima di inviarlo al client
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
      'SELECT s.token AS token, s.expires_at AS expires_at, u.id AS id, u.username AS username, u.role AS role FROM sessioni s JOIN utenti u ON u.id = s.user_id WHERE s.token = ?',
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

async function handleProposalDecision(db, proposal, decision) {
  await db.run('UPDATE proposte SET stato = ? WHERE id = ?', decision, proposal.id);
  if (decision === 'approved') {
    const characterData = JSON.parse(proposal.character_data || '{}');
    const classe = characterData.classe || 'Sopravvissuto';
    const characterJson = stringifyCharacterData(characterData);
    const existingChar = await db.get('SELECT * FROM personaggi WHERE user_id = ? AND nome = ?', proposal.user_id, proposal.nome);
    if (existingChar) {
      await db.run(
        'UPDATE personaggi SET data = ?, classe = ?, updated_at = ? WHERE id = ?',
        characterJson,
        classe,
        new Date().toISOString(),
        existingChar.id,
      );
    } else {
      await db.run(
        'INSERT INTO personaggi (user_id, nome, classe, data, updated_at) VALUES (?, ?, ?, ?, ?)',
        proposal.user_id,
        proposal.nome,
        classe,
        characterJson,
        new Date().toISOString(),
      );
    }
  }
  return db.get('SELECT * FROM proposte WHERE id = ?', proposal.id);
}

app.get('/api/ping', async (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
    if (countRow && countRow.count >= 15) {
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

app.get('/api/characters', authenticateUser, async (req, res) => {
  try {
    const db = await dbPromise;
    if (req.user.role === 'master' && req.query.all === 'true') {
      const characters = await db.all('SELECT * FROM personaggi ORDER BY created_at DESC');
      return res.json({ characters });
    }

    const targetUserId = req.user.role === 'master' && req.query.userId ? Number(req.query.userId) : req.user.id;
    if (!targetUserId) {
      return res.status(400).json({ error: 'userId mancante' });
    }

    const characters = await db.all(
      'SELECT * FROM personaggi WHERE user_id = ? ORDER BY created_at DESC',
      targetUserId,
    );
    res.json({ characters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/personaggi/:nome', authenticateUser, async (req, res) => {
  const nome = req.params.nome;
  if (!nome) {
    return res.status(400).json({ error: 'nome mancante' });
  }

  try {
    const db = await dbPromise;
    const character = await db.get(
      req.user.role === 'master'
        ? 'SELECT * FROM personaggi WHERE nome = ? ORDER BY updated_at DESC LIMIT 1'
        : 'SELECT * FROM personaggi WHERE user_id = ? AND nome = ?',
      ...(req.user.role === 'master' ? [nome] : [req.user.id, nome]),
    );
    if (!character) {
      return res.status(404).json({ error: 'Personaggio non trovato' });
    }
    // Parse data field if it's a string
    if (character.data && typeof character.data === 'string') {
      try {
        character.data = JSON.parse(character.data);
      } catch (e) {
        character.data = {};
      }
    }
    res.json({ personaggio: character });
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

app.get('/api/personaggi/:id/stati', authenticateUser, async (req, res) => {
  const targetId = Number(req.params.id);
  try {
    const db = await dbPromise;
    const now = new Date().toISOString();
    const query = targetId
      ? 'SELECT * FROM stati_alterati WHERE personaggio_id = ? AND (durata_minuti = 0 OR datetime(applicato_il, "+" || durata_minuti || " minutes") > datetime(?)) ORDER BY applicato_il DESC'
      : 'SELECT * FROM stati_alterati WHERE personaggio_id = (SELECT id FROM personaggi WHERE nome = ? LIMIT 1) AND (durata_minuti = 0 OR datetime(applicato_il, "+" || durata_minuti || " minutes") > datetime(?)) ORDER BY applicato_il DESC';
    const params = targetId ? [targetId, now] : [req.params.id, now];
    const stati = await db.all(query, ...params);
    res.json({ stati });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/documenti', authenticateUser, async (req, res) => {
  try {
    const db = await dbPromise;
    const personaggioId = req.query.personaggioId ? Number(req.query.personaggioId) : null;
    let documents;
    if (req.user.role === 'master') {
      documents = personaggioId
        ? await db.all('SELECT * FROM documenti WHERE personaggio_id = ? ORDER BY created_at DESC', personaggioId)
        : await db.all('SELECT * FROM documenti ORDER BY created_at DESC');
    } else {
      // Un giocatore vede i documenti assegnati a lui (tramite personaggio_id)
      // ma dobbiamo assicurarci che il personaggio appartenga all'utente loggato
      if (personaggioId) {
        documents = await db.all(
          'SELECT d.* FROM documenti d JOIN personaggi p ON p.id = d.personaggio_id WHERE d.personaggio_id = ? AND p.user_id = ? ORDER BY d.created_at DESC',
          personaggioId, req.user.id
        );
      } else {
        documents = await db.all(
          'SELECT d.* FROM documenti d JOIN personaggi p ON p.id = d.personaggio_id WHERE p.user_id = ? ORDER BY d.created_at DESC',
          req.user.id
        );
      }
    }

    // Parsa il contenuto se è un JSON (lingua_richiesta, etc.)
    documents = documents.map(doc => {
      if (doc.contenuto && doc.contenuto.startsWith('{')) {
        try {
          const parsed = JSON.parse(doc.contenuto);
          return { ...doc, ...parsed };
        } catch (e) {
          return doc;
        }
      }
      return doc;
    });

    res.json({ documenti: documents });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/characters', authenticateUser, async (req, res) => {
  const { nome, classe, data, updated_at } = req.body;
  if (!nome || !classe) {
    return res.status(400).json({ error: 'nome e classe richiesti' });
  }

  try {
    const db = await dbPromise;
    const existing = await db.get('SELECT * FROM personaggi WHERE user_id = ? AND nome = ?', req.user.id, nome);
    if (existing) {
      await db.run(
        'UPDATE personaggi SET data = ?, updated_at = ?, classe = ? WHERE id = ?',
        typeof data === 'string' ? data : JSON.stringify(data || {}),
        updated_at || new Date().toISOString(),
        classe,
        existing.id,
      );
      const character = await db.get('SELECT * FROM personaggi WHERE id = ?', existing.id);
      return res.json({ character });
    }

    const result = await db.run(
      'INSERT INTO personaggi (user_id, nome, classe, data, updated_at) VALUES (?, ?, ?, ?, ?)',
      req.user.id,
      nome,
      classe,
      typeof data === 'string' ? data : JSON.stringify(data || {}),
      updated_at || new Date().toISOString(),
    );
    const character = await db.get('SELECT * FROM personaggi WHERE id = ?', result.lastID);
    res.json({ character });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET PROPOSTE IN ATTESA
app.get('/api/proposals', authenticateUser, requireMaster, async (req, res) => {
  try {
    const db = await dbPromise;
    const proposals = await db.all(
      `SELECT p.*, u.username AS user_name
       FROM proposte p
       JOIN utenti u ON p.user_id = u.id
       WHERE p.stato = ?
       ORDER BY p.created_at DESC`,
      'in_attesa'
    );
    res.json({ proposals });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREA NUOVA PROPOSTA DA PARTE DEL GIOCATORE
app.post('/api/proposals', authenticateUser, async (req, res) => {
  const { nome, descrizione, characterData } = req.body;
  if (!nome) {
    return res.status(400).json({ error: 'nome del personaggio richiesto' });
  }

  try {
    const db = await dbPromise;
    const desc = descrizione || `Proposta personaggio: ${nome}`;
    const characterPayload = stringifyCharacterData(characterData || {});
    const result = await db.run(
      'INSERT INTO proposte (user_id, nome, descrizione, stato, character_data) VALUES (?, ?, ?, ?, ?)',
      req.user.id,
      nome,
      desc,
      'in_attesa',
      characterPayload,
    );
    const proposal = await db.get('SELECT * FROM proposte WHERE id = ?', result.lastID);
    res.json({ proposal });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// 👑 DECISIONE DEL MASTER (APPROVA/RIFIUTA) CON INIEZIONE AUTOMATICA NEL PARTY
app.post('/api/proposals/:id/decision', authenticateUser, requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  const { decision } = req.body;
  if (!id || !decision || !['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'id e decisione valida (approved/rejected) richiesti' });
  }

  try {
    const db = await dbPromise;
    const proposal = await db.get('SELECT * FROM proposte WHERE id = ?', id);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposta non trovata' });
    }

    const updatedProposal = await handleProposalDecision(db, proposal, decision);
    res.json({ proposal: updatedProposal });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/master/push-commands', authenticateUser, requireMaster, async (req, res) => {
  const { target, tipo, valore, note } = req.body;
  if (!target || !tipo) {
    return res.status(400).json({ error: 'target e tipo richiesti' });
  }

  try {
    res.json({ success: true, target, tipo, valore, note });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/master/documents', authenticateUser, requireMaster, async (req, res) => {
  const { titolo, contenuto, personaggio_id, personaggioId, lingua_richiesta, testo_originale, testo_criptato } = req.body;
  if (!titolo || (!contenuto && !(testo_originale || testo_criptato))) {
    return res.status(400).json({ error: 'titolo e contenuto richiesti' });
  }

  try {
    const db = await dbPromise;
    const payload = contenuto || JSON.stringify({ lingua_richiesta, testo_originale, testo_criptato });
    const result = await db.run(
      'INSERT INTO documenti (master_id, personaggio_id, titolo, contenuto) VALUES (?, ?, ?, ?)',
      req.user.id,
      personaggio_id || personaggioId || null,
      titolo,
      payload,
    );
    const document = await db.get('SELECT * FROM documenti WHERE id = ?', result.lastID);
    res.json({ document });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/master/apply-state', authenticateUser, requireMaster, async (req, res) => {
  const {
    personaggio_id,
    personaggioId,
    nome,
    tipo,
    descrizione = '',
    durata_minuti = 0,
    valore = 0,
    fonte = 'master'
  } = req.body;

  const targetId = personaggio_id || personaggioId;
  if (!targetId || !tipo) {
    return res.status(400).json({ error: 'personaggio_id e tipo richiesti' });
  }

  try {
    const db = await dbPromise;
    await db.run(
      'INSERT INTO stati_alterati (personaggio_id, nome, tipo, descrizione, durata_minuti, valore, fonte) VALUES (?, ?, ?, ?, ?, ?, ?)',
      targetId,
      nome || '',
      tipo,
      descrizione,
      durata_minuti,
      typeof valore === 'number' ? valore : 0,
      fonte,
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



app.get('/api/master/count-proposals', authenticateUser, requireMaster, async (req, res) => {
  try {
    const db = await dbPromise;
    const row = await db.get('SELECT COUNT(*) AS count FROM proposte WHERE stato = ?', 'in_attesa');
    res.json({ count: row.count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../client/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Zombie Asylum server in ascolto su http://localhost:${PORT}`);
});