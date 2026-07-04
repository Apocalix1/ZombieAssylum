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

    CREATE TABLE IF NOT EXISTS proposte (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      descrizione TEXT NOT NULL,
      character_data TEXT NOT NULL DEFAULT '{}',
      stato TEXT NOT NULL DEFAULT 'in_attesa',
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
      FOREIGN KEY(personaggio_id) REFERENCES personaggi(id) ON DELETE SET NULL
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

    CREATE TABLE IF NOT EXISTS sessioni (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES utenti(id) ON DELETE CASCADE
    );
  `);

  await db.run(
    `INSERT OR IGNORE INTO utenti (id, username, password, role) VALUES (1, 'ospite', 'ospite', 'giocatore')`
  );

  await db.run(
    `INSERT OR IGNORE INTO utenti (id, username, password, role) VALUES (2, 'Apocalix1', 'Camelia75!', 'master')`
  );

  const personaggiColumns = await db.all('PRAGMA table_info(personaggi)');
  const columnNames = personaggiColumns.map(column => column.name);
  if (!columnNames.includes('updated_at')) {
    await db.run("ALTER TABLE personaggi ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
  }

  const proposalColumns = await db.all('PRAGMA table_info(proposte)');
  const proposalColumnNames = proposalColumns.map(column => column.name);
  if (!proposalColumnNames.includes('character_data')) {
    await db.run("ALTER TABLE proposte ADD COLUMN character_data TEXT NOT NULL DEFAULT '{}'");
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
        FOREIGN KEY(user_id) REFERENCES utenti(id) ON DELETE CASCADE
      );
    `);
  }

  return db;
}
