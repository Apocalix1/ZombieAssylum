import sqlite3 from 'sqlite3';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = `${__dirname}/zombieasylum.db`;

function wrapDatabase(db) {
  return {
    run(sql, ...params) {
      return new Promise((resolve, reject) => {
        db.run(sql, ...params, function (err) {
          if (err) return reject(err);
          resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },
    get(sql, ...params) {
      return new Promise((resolve, reject) => {
        db.get(sql, ...params, (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });
    },
    all(sql, ...params) {
      return new Promise((resolve, reject) => {
        db.all(sql, ...params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
    },
    exec(sql) {
      return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }
  };
}

export async function openDatabase() {
  const rawDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);
  const db = wrapDatabase(rawDb);

  await db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS utenti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'giocatore',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS personaggi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      classe TEXT NOT NULL,
      livello INTEGER NOT NULL DEFAULT 1,
      stamina INTEGER NOT NULL DEFAULT 100,
      hunger INTEGER NOT NULL DEFAULT 100,
      thirst INTEGER NOT NULL DEFAULT 100,
      sleep INTEGER NOT NULL DEFAULT 100,
      status TEXT NOT NULL DEFAULT 'attivo',
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES utenti(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS documenti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      master_id INTEGER NOT NULL,
      personaggio_id INTEGER,
      titolo TEXT NOT NULL,
      contenuto TEXT NOT NULL,
      stato TEXT NOT NULL DEFAULT 'aperto',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(master_id) REFERENCES utenti(id) ON DELETE CASCADE,
      FOREIGN KEY(personaggio_id) REFERENCES personaggi(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stati_alterati (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personaggio_id INTEGER NOT NULL,
      nome TEXT NOT NULL DEFAULT '',
      tipo TEXT NOT NULL,
      descrizione TEXT NOT NULL DEFAULT '',
      durata_minuti INTEGER NOT NULL DEFAULT 0,
      valore INTEGER NOT NULL DEFAULT 0,
      fonte TEXT NOT NULL DEFAULT 'sistema',
      applicato_il TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(personaggio_id) REFERENCES personaggi(id) ON DELETE CASCADE
    );
      CREATE TABLE IF NOT EXISTS inviti_esplorazione (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_spedizione TEXT NOT NULL,
      mittente_personaggio_id INTEGER NOT NULL,
      destinatario_personaggio_id INTEGER NOT NULL,
      stato TEXT NOT NULL DEFAULT 'in_attesa',
      creato_il TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      scade_il TEXT NOT NULL,
      FOREIGN KEY(mittente_personaggio_id) REFERENCES personaggi(id) ON DELETE CASCADE,
      FOREIGN KEY(destinatario_personaggio_id) REFERENCES personaggi(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS proposte (
  id TEXT PRIMARY KEY,
  mittente_id INTEGER NOT NULL,
  destinatario_id INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  dati TEXT NOT NULL,
  stato TEXT NOT NULL DEFAULT 'in_attesa',
  creato_il TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  scade_il TEXT NOT NULL
);
    

    CREATE TABLE IF NOT EXISTS sessioni (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT,
      FOREIGN KEY(user_id) REFERENCES utenti(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS magazzino (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT OR IGNORE INTO magazzino (id, data) VALUES (1, '{}');
  `);

  // MIGRAZIONE: Correggi il ruolo dell'utente ospite se esiste con ruolo sbagliato
  const ospiteEsistente = await db.get('SELECT id, role FROM utenti WHERE username = ?', 'ospite');
  if (ospiteEsistente) {
    if (ospiteEsistente.role !== 'ospite') {
      await db.run('UPDATE utenti SET role = ? WHERE id = ?', 'ospite', ospiteEsistente.id);
      console.log('Migrazione: ruolo utente ospite corretto in "ospite".');
    }
  } else {
    // Se non esiste, crealo con il ruolo corretto
    await db.run(
        `INSERT OR IGNORE INTO utenti (id, username, password, role) VALUES (1, 'ospite', 'ospite', 'ospite')`
    );
  }

  // Crea l'account master (se non esiste)
  await db.run(
      `INSERT OR IGNORE INTO utenti (username, password, role) VALUES ('Apocalix1', 'Camelia75!', 'master')`
  );

  // --- Migrazioni per colonne mancanti ---
  const personaggiColumns = await db.all('PRAGMA table_info(personaggi)');
  const columnNames = personaggiColumns.map(column => column.name);
  if (!columnNames.includes('updated_at')) {
    await db.run("ALTER TABLE personaggi ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
  }

  const documentColumns = await db.all('PRAGMA table_info(documenti)');
  const documentColumnNames = documentColumns.map(column => column.name);
  if (!documentColumnNames.includes('personaggio_id')) {
    await db.run('ALTER TABLE documenti ADD COLUMN personaggio_id INTEGER');
  }

  const stateColumns = await db.all('PRAGMA table_info(stati_alterati)');
  const stateColumnNames = stateColumns.map(column => column.name);
  if (!stateColumnNames.includes('nome')) {
    await db.run('ALTER TABLE stati_alterati ADD COLUMN nome TEXT NOT NULL DEFAULT ""');
  }
  if (!stateColumnNames.includes('descrizione')) {
    await db.run('ALTER TABLE stati_alterati ADD COLUMN descrizione TEXT NOT NULL DEFAULT ""');
  }
  if (!stateColumnNames.includes('durata_minuti')) {
    await db.run('ALTER TABLE stati_alterati ADD COLUMN durata_minuti INTEGER NOT NULL DEFAULT 0');
  }
  const sessionColumns = await db.all('PRAGMA table_info(sessioni)');
  const sessionColumnNames = sessionColumns.map(column => column.name);
  if (!sessionColumnNames.length) {
    await db.run(`
      CREATE TABLE IF NOT EXISTS sessioni (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT,
        FOREIGN KEY(user_id) REFERENCES utenti(id) ON DELETE CASCADE
      );
    `);
  }
  if (!sessionColumnNames.includes('expires_at')) {
    await db.run('ALTER TABLE sessioni ADD COLUMN expires_at TEXT');
  }
  if (!stateColumnNames.includes('modificatori')) {
    await db.run("ALTER TABLE stati_alterati ADD COLUMN modificatori TEXT NOT NULL DEFAULT '[]'");
  }
  if (!documentColumnNames.includes('traduzioni')) {
    await db.run("ALTER TABLE documenti ADD COLUMN traduzioni TEXT NOT NULL DEFAULT '[]'");
  }
  if (!documentColumnNames.includes('campo_base_id')) {
    await db.run("ALTER TABLE documenti ADD COLUMN campo_base_id INTEGER NOT NULL DEFAULT 1");
  }

  // --- MULTI CAMPO BASE ---
  await db.exec(`
    CREATE TABLE IF NOT EXISTS campi_base (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      creato_il TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS mondo (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      ore_totali REAL NOT NULL DEFAULT 0
    );
    INSERT OR IGNORE INTO mondo (id, ore_totali) VALUES (1, 0);
    CREATE TABLE IF NOT EXISTS magazzini (
      campo_base_id INTEGER PRIMARY KEY,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(campo_base_id) REFERENCES campi_base(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS eventi_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campo_base_id INTEGER NOT NULL,
      ora_gioco REAL NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'info',
      messaggio TEXT NOT NULL,
      personaggio_nome TEXT,
      letto INTEGER NOT NULL DEFAULT 0,
      creato_il TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(campo_base_id) REFERENCES campi_base(id) ON DELETE CASCADE
    );
  `);

    // Crea i campi base iniziali se non esistono (retrocompatibilità + seed richiesto)
  const campoDefault = await db.get('SELECT id, nome FROM campi_base WHERE id = 1');
  if (!campoDefault) {
    await db.run('INSERT INTO campi_base (id, nome) VALUES (1, ?)', 'Casa di Maria');
  } else if (campoDefault.nome === 'Campo Base 1') {
    // Rinomina il campo di default creato da una versione precedente della migrazione
    await db.run('UPDATE campi_base SET nome = ? WHERE id = 1', 'Casa di Maria');
  }
  const campoSuga = await db.get('SELECT id FROM campi_base WHERE nome = ?', 'Suga Toddie');
  if (!campoSuga) {
    const result = await db.run('INSERT INTO campi_base (nome) VALUES (?)', 'Suga Toddie');
    await db.run('INSERT OR IGNORE INTO magazzini (campo_base_id, data) VALUES (?, ?)', result.lastID, '{}');
  }

  // Migrazione: sposta l'unica riga legacy `magazzino` (id=1) dentro `magazzini` (campo 1),
  // solo se `magazzini` non ha già quella riga.
  const magazziniRow1 = await db.get('SELECT campo_base_id FROM magazzini WHERE campo_base_id = 1');
  if (!magazziniRow1) {
    const legacyMag = await db.get('SELECT data FROM magazzino WHERE id = 1');
    const legacyData = legacyMag?.data || '{}';
    await db.run('INSERT INTO magazzini (campo_base_id, data) VALUES (1, ?)', legacyData);
    // Se il vecchio magazzino aveva un oreTotali salvato, lo riportiamo nell'orologio globale
    try {
      const parsed = JSON.parse(legacyData);
      if (typeof parsed.oreTotali === 'number' && parsed.oreTotali > 0) {
        await db.run('UPDATE mondo SET ore_totali = ? WHERE id = 1', parsed.oreTotali);
      }
    } catch (e) { /* dati legacy corrotti, ignoriamo */ }
  }

  if (!columnNames.includes('campo_base_id')) {
    await db.run("ALTER TABLE personaggi ADD COLUMN campo_base_id INTEGER NOT NULL DEFAULT 1");
  }

  return db;
}