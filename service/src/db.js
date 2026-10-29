// Eigene SQLite-Datenbank des Dienstes (node:sqlite). Yuvomis Datenbank wird nie geöffnet.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = [
  // 1: Pläne, Zieländerungen, Lesungen, Einstellungen
  `CREATE TABLE plan (
     id INTEGER PRIMARY KEY,
     besitzer INTEGER NOT NULL,
     name TEXT NOT NULL,
     art TEXT NOT NULL CHECK (art IN ('privat', 'sichtbar', 'gemeinsam')),
     kopie_von INTEGER,
     rezept TEXT NOT NULL,
     einheiten TEXT NOT NULL,
     einheiten_vorher TEXT,
     version INTEGER NOT NULL DEFAULT 1,
     begonnen_am TEXT NOT NULL,
     lesetage TEXT,
     woerter_je_minute INTEGER NOT NULL,
     ziel TEXT,
     durchgang INTEGER NOT NULL DEFAULT 1,
     erstellt_am TEXT NOT NULL,
     geloescht_am TEXT
   );
   CREATE TABLE ziel_aenderung (
     id INTEGER PRIMARY KEY,
     plan_id INTEGER NOT NULL REFERENCES plan(id),
     am TEXT NOT NULL,
     von TEXT,
     nach TEXT NOT NULL,
     person_id INTEGER NOT NULL,
     zurueckgenommen_am TEXT
   );
   CREATE TABLE lesung (
     id INTEGER PRIMARY KEY,
     plan_id INTEGER REFERENCES plan(id),
     person_id INTEGER NOT NULL,
     quelle TEXT NOT NULL CHECK (quelle IN ('plan', 'frei')),
     gelesen_am TEXT NOT NULL,
     uhrzeit TEXT,
     einheit_nr INTEGER,
     plan_version INTEGER,
     durchgang INTEGER,
     stuecke TEXT NOT NULL,
     notiz TEXT NOT NULL DEFAULT '',
     dabei TEXT,
     erstellt_am TEXT NOT NULL,
     geloescht_am TEXT
   );
   CREATE INDEX lesung_plan ON lesung (plan_id, durchgang) WHERE geloescht_am IS NULL;
   CREATE INDEX lesung_person ON lesung (person_id, gelesen_am) WHERE geloescht_am IS NULL;
   CREATE TABLE einstellung (
     bereich TEXT NOT NULL,      -- 'person' oder 'haushalt'
     person_id INTEGER NOT NULL, -- 0 für den Haushalt
     schluessel TEXT NOT NULL,
     wert TEXT NOT NULL,
     PRIMARY KEY (bereich, person_id, schluessel)
   );`,
  // 2: Was beim Abhaken herausgenommen wurde (zweiter Strang, Parallelstellen); zählt nicht als gelesen.
  `ALTER TABLE lesung ADD COLUMN ausgelassen TEXT;`,
];

export function oeffneDatenbank(pfad) {
  if (pfad !== ':memory:') fs.mkdirSync(path.dirname(pfad), { recursive: true });
  const db = new DatabaseSync(pfad);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  const stand = db.prepare('PRAGMA user_version').get().user_version;
  for (let v = stand; v < SCHEMA.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(SCHEMA[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
  return db;
}

/** Mehrere Schreibvorgänge als eine Transaktion. */
export function transaktion(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const ergebnis = fn();
    db.exec('COMMIT');
    return ergebnis;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
