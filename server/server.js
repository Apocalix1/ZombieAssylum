import express from 'express';
import cors from 'cors';
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

app.get('/api/ping', async (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/auth/register', async (req, res) => {
  const { username, password, role = 'giocatore' } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username e password richiesti' });
  }

  try {
    const db = await dbPromise;
    const result = await db.run(
      'INSERT INTO utenti (username, password, role) VALUES (?, ?, ?)',
      username,
      password,
      role,
    );

    const user = await db.get('SELECT id, username, role FROM utenti WHERE id = ?', result.lastID);
    res.json({ user });
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
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'credenziali non valide' });
    }

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/characters', async (req, res) => {
  const userId = Number(req.query.userId || 0);
  if (!userId) {
    return res.status(400).json({ error: 'userId mancante' });
  }

  try {
    const db = await dbPromise;
    const characters = await db.all(
      'SELECT * FROM personaggi WHERE user_id = ? ORDER BY created_at DESC',
      userId,
    );
    res.json({ characters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/characters', async (req, res) => {
  const { userId, nome, classe, data, updated_at } = req.body;
  if (!userId || !nome || !classe) {
    return res.status(400).json({ error: 'userId, nome e classe richiesti' });
  }

  try {
    const db = await dbPromise;
    const existing = await db.get('SELECT * FROM personaggi WHERE user_id = ? AND nome = ?', userId, nome);
    if (existing) {
      await db.run(
        'UPDATE personaggi SET data = ?, updated_at = ?, classe = ? WHERE id = ?',
        typeof data === 'string' ? data : JSON.stringify(data || {}),
        updated_at || new Date().toISOString(),
        classe,
        existing.id
      );
      const character = await db.get('SELECT * FROM personaggi WHERE id = ?', existing.id);
      return res.json({ character });
    }

    const result = await db.run(
      'INSERT INTO personaggi (user_id, nome, classe, data, updated_at) VALUES (?, ?, ?, ?, ?)',
      userId,
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
app.get('/api/proposals', async (req, res) => {
  try {
    const db = await dbPromise;
    const proposals = await db.all('SELECT * FROM proposte WHERE stato = ? ORDER BY created_at DESC', 'in_attesa');
    res.json({ proposals });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREA NUOVA PROPOSTA DA PARTE DEL GIOCATORE
app.post('/api/proposals', async (req, res) => {
  const { userId, nome, descrizione } = req.body;
  if (!userId || !nome) {
    return res.status(400).json({ error: 'userId e nome del personaggio richiesti' });
  }

  try {
    const db = await dbPromise;
    // Forniamo un fallback alla descrizione se vuota
    const desc = descrizione || `Proposta personaggio: ${nome}`;
    const result = await db.run(
      'INSERT INTO proposte (user_id, nome, descrizione, stato) VALUES (?, ?, ?, ?)',
      userId,
      nome,
      desc,
      'in_attesa'
    );
    const proposal = await db.get('SELECT * FROM proposte WHERE id = ?', result.lastID);
    res.json({ proposal });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 👑 DECISIONE DEL MASTER (APPROVA/RIFIUTA) CON INIEZIONE AUTOMATICA NEL PARTY
app.post('/api/proposals/:id/decision', async (req, res) => {
  const id = Number(req.params.id);
  const { decision } = req.body;
  if (!id || !decision || !['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'id e decisione valida (approved/rejected) richiesti' });
  }

  try {
    const db = await dbPromise;
    
    // Recuperiamo la proposta originale per sapere di chi si tratta
    const proposal = await db.get('SELECT * FROM proposte WHERE id = ?', id);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposta non trovata' });
    }

    // Aggiorniamo lo stato della proposta
    await db.run('UPDATE proposte SET stato = ? WHERE id = ?', decision, id);

    // Se approvato, inseriamo direttamente il personaggio nella tabella ufficiale "personaggi"
    if (decision === 'approved') {
      const defaultData = JSON.stringify({
        nome: proposal.nome,
        giornoInizio: 0,
        puntiFeritaReali: 20,
        puntiFeritaRealiMax: 20,
        puntiFortuna: 3,
        puntiFortunaMax: 3,
        stats: { Forza: 10, Destrezza: 10, Costituzione: 10, Intelligenza: 10, Saggezza: 10, Carisma: 10 },
        perks: [],
        pca: {}
      });

      // Controlliamo se esiste già, altrimenti inseriamo
      const existingChar = await db.get('SELECT * FROM personaggi WHERE user_id = ? AND nome = ?', proposal.user_id, proposal.nome);
      if (!existingChar) {
        await db.run(
          'INSERT INTO personaggi (user_id, nome, classe, data, updated_at) VALUES (?, ?, ?, ?, ?)',
          proposal.user_id,
          proposal.nome,
          'Sopravvissuto',
          defaultData,
          new Date().toISOString()
        );
      }
    }

    const updatedProposal = await db.get('SELECT * FROM proposte WHERE id = ?', id);
    res.json({ proposal: updatedProposal });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/master/documents', async (req, res) => {
  const { masterId, titolo, contenuto } = req.body;
  if (!masterId || !titolo || !contenuto) {
    return res.status(400).json({ error: 'masterId, titolo e contenuto richiesti' });
  }

  try {
    const db = await dbPromise;
    const result = await db.run(
      'INSERT INTO documenti (master_id, titolo, contenuto) VALUES (?, ?, ?)',
      masterId,
      titolo,
      contenuto,
    );
    const document = await db.get('SELECT * FROM documenti WHERE id = ?', result.lastID);
    res.json({ document });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/master/apply-state', async (req, res) => {
  const { personaggioId, tipo, valore, fonte = 'master' } = req.body;
  if (!personaggioId || !tipo || typeof valore !== 'number') {
    return res.status(400).json({ error: 'personaggioId, tipo e valore numerico richiesti' });
  }

  try {
    const db = await dbPromise;
    await db.run(
      'INSERT INTO stati_alterati (personaggio_id, tipo, valore, fonte) VALUES (?, ?, ?, ?)',
      personaggioId,
      tipo,
      valore,
      fonte,
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/master/count-proposals', async (req, res) => {
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