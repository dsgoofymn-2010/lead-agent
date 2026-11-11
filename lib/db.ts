// Database setup. We use SQLite (a single file called leads.db) through better-sqlite3.
// better-sqlite3 is synchronous, which keeps the code simple: no "await" needed for queries.

import Database from "better-sqlite3";
import path from "path";
import type { Lead, WebsiteStatus } from "./types";

// The database file lives in the project folder.
const DB_PATH = path.join(process.cwd(), "leads.db");

// In development Next.js reloads modules often. We keep one connection on
// globalThis so we don't open a new one on every reload.
const globalForDb = globalThis as unknown as { leadsDb?: Database.Database };

function openDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL"); // better performance for reads + writes

  // Create the table the first time the app runs.
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      category       TEXT NOT NULL,
      city           TEXT NOT NULL,
      address        TEXT NOT NULL DEFAULT '',
      phone          TEXT,
      website        TEXT,
      website_status TEXT NOT NULL DEFAULT 'unknown'
                     CHECK (website_status IN ('none','weak','good','unknown')),
      email          TEXT,
      whatsapp       TEXT,
      rating         REAL,
      review_count   INTEGER,
      score          INTEGER NOT NULL DEFAULT 0,
      source         TEXT NOT NULL DEFAULT 'google_places',
      status         TEXT NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new','contacted','replied','paid','rejected')),
      notes          TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Duplicate protection: the same name + address + city can only be saved once.
    -- COLLATE NOCASE means "Glow Salon" and "glow salon" count as the same.
    CREATE UNIQUE INDEX IF NOT EXISTS leads_unique_business
      ON leads (name COLLATE NOCASE, address COLLATE NOCASE, city COLLATE NOCASE);
  `);

  return db;
}

export function getDb(): Database.Database {
  if (!globalForDb.leadsDb) {
    globalForDb.leadsDb = openDb();
  }
  return globalForDb.leadsDb;
}

// The data needed to save one lead.
export interface NewLead {
  name: string;
  category: string;
  city: string;
  address: string;
  phone: string | null;
  website: string | null;
  website_status: WebsiteStatus;
  email: string | null;
  whatsapp: string | null;
  rating: number | null;
  review_count: number | null;
  score: number;
}

/**
 * Save a lead. If the same business (name + address + city) already exists,
 * we refresh its details (phone, rating, etc.) but keep your status and notes.
 * Returns the saved row and whether it was brand new.
 */
export function saveLead(lead: NewLead): { lead: Lead; isNew: boolean } {
  const db = getDb();

  const existing = db
    .prepare(
      `SELECT id FROM leads
       WHERE name = ? COLLATE NOCASE AND address = ? COLLATE NOCASE AND city = ? COLLATE NOCASE`
    )
    .get(lead.name, lead.address, lead.city) as { id: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE leads SET
         phone = @phone, website = @website, website_status = @website_status,
         email = COALESCE(@email, email), whatsapp = COALESCE(@whatsapp, whatsapp),
         rating = @rating, review_count = @review_count, score = @score,
         updated_at = datetime('now')
       WHERE id = @id`
    ).run({ ...lead, id: existing.id });
  } else {
    db.prepare(
      `INSERT INTO leads
         (name, category, city, address, phone, website, website_status,
          email, whatsapp, rating, review_count, score)
       VALUES
         (@name, @category, @city, @address, @phone, @website, @website_status,
          @email, @whatsapp, @rating, @review_count, @score)`
    ).run(lead);
  }

  const saved = db
    .prepare(
      `SELECT * FROM leads
       WHERE name = ? COLLATE NOCASE AND address = ? COLLATE NOCASE AND city = ? COLLATE NOCASE`
    )
    .get(lead.name, lead.address, lead.city) as Lead;

  return { lead: saved, isNew: !existing };
}
