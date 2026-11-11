// Database setup. We use libSQL (SQLite) through @libsql/client.
// - On your computer, with no settings, it uses the local file leads.db.
// - On Vercel, set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to use a hosted
//   Turso database (Vercel's servers can't keep a local file between requests).

import { createClient, type Client } from "@libsql/client";
import type { Lead, WebsiteStatus } from "./types";

// In development Next.js reloads modules often. We keep one client and one
// "table is ready" promise on globalThis so we don't redo the setup each time.
const globalForDb = globalThis as unknown as { leadsDb?: Client; leadsDbReady?: Promise<void> };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS leads (
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
  )`,
  // Duplicate protection: the same name + address + city can only be saved once.
  // COLLATE NOCASE means "Glow Salon" and "glow salon" count as the same.
  `CREATE UNIQUE INDEX IF NOT EXISTS leads_unique_business
    ON leads (name COLLATE NOCASE, address COLLATE NOCASE, city COLLATE NOCASE)`,
];

export async function getDb(): Promise<Client> {
  if (!globalForDb.leadsDb) {
    globalForDb.leadsDb = createClient({
      url: process.env.TURSO_DATABASE_URL || "file:leads.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    // Create the table the first time the app runs.
    globalForDb.leadsDbReady = globalForDb.leadsDb.batch(SCHEMA, "write").then(() => undefined);
  }
  await globalForDb.leadsDbReady;
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

const FIND_SQL = `SELECT * FROM leads
  WHERE name = ? COLLATE NOCASE AND address = ? COLLATE NOCASE AND city = ? COLLATE NOCASE`;

/**
 * Save a lead. If the same business (name + address + city) already exists,
 * we refresh its details (phone, rating, etc.) but keep your status and notes.
 * Returns the saved row and whether it was brand new.
 */
export async function saveLead(lead: NewLead): Promise<{ lead: Lead; isNew: boolean }> {
  const db = await getDb();
  const key = [lead.name, lead.address, lead.city];
  const args = { ...lead };

  const existing = await db.execute({ sql: FIND_SQL, args: key });
  const isNew = existing.rows.length === 0;

  if (isNew) {
    await db.execute({
      sql: `INSERT INTO leads
              (name, category, city, address, phone, website, website_status,
               email, whatsapp, rating, review_count, score)
            VALUES
              (@name, @category, @city, @address, @phone, @website, @website_status,
               @email, @whatsapp, @rating, @review_count, @score)`,
      args,
    });
  } else {
    await db.execute({
      sql: `UPDATE leads SET
              phone = @phone, website = @website, website_status = @website_status,
              email = COALESCE(@email, email), whatsapp = COALESCE(@whatsapp, whatsapp),
              rating = @rating, review_count = @review_count, score = @score,
              updated_at = datetime('now')
            WHERE id = @id`,
      // Turso rejects unused values, so pass only the ones this UPDATE uses.
      args: {
        phone: lead.phone,
        website: lead.website,
        website_status: lead.website_status,
        email: lead.email,
        whatsapp: lead.whatsapp,
        rating: lead.rating,
        review_count: lead.review_count,
        score: lead.score,
        id: Number(existing.rows[0].id),
      },
    });
  }

  const saved = await db.execute({ sql: FIND_SQL, args: key });
  // Turn the libSQL row into a plain object so it can be sent as JSON.
  const lead_ = Object.fromEntries(Object.entries(saved.rows[0])) as unknown as Lead;
  return { lead: lead_, isNew };
}
