// Dev-only seed: inserts one fake lead into the local leads.db.
// Run with: npm run seed:test
// Safe to run repeatedly — the unique index on (name, address, city) plus
// INSERT OR IGNORE keeps it from duplicating.

import { createClient } from "@libsql/client";

// Same schema as lib/db.ts. Creating it here means the script also works
// before the app has handled its first search.
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
  `CREATE UNIQUE INDEX IF NOT EXISTS leads_unique_business
    ON leads (name COLLATE NOCASE, address COLLATE NOCASE, city COLLATE NOCASE)`,
];

const LEAD = {
  name: "VJ Salon",
  category: "salon",
  city: "Chennai",
  address: "Anna Nagar, Chennai",
  phone: "+91 98765 43210",
  website: null,
  website_status: "none",
  email: null,
  whatsapp: null,
  rating: 4.6,
  review_count: 210,
  score: 0,
  source: "test",
};

const db = createClient({ url: "file:leads.db" });

try {
  await db.batch(SCHEMA, "write");

  const inserted = await db.execute({
    sql: `INSERT OR IGNORE INTO leads
            (name, category, city, address, phone, website, website_status,
             email, whatsapp, rating, review_count, score, source)
          VALUES
            (@name, @category, @city, @address, @phone, @website, @website_status,
             @email, @whatsapp, @rating, @review_count, @score, @source)`,
    args: LEAD,
  });

  const found = await db.execute({
    sql: `SELECT id FROM leads
          WHERE name = ? COLLATE NOCASE
            AND address = ? COLLATE NOCASE
            AND city = ? COLLATE NOCASE`,
    args: [LEAD.name, LEAD.address, LEAD.city],
  });

  if (found.rows.length === 0) {
    console.error("Could not find the seeded lead after inserting.");
    process.exitCode = 1;
  } else {
    const id = found.rows[0].id;
    console.log(
      inserted.rowsAffected > 0
        ? `Inserted test lead "${LEAD.name}".`
        : `Test lead "${LEAD.name}" already exists; nothing inserted.`
    );
    console.log(`Lead id: ${id}`);
    console.log(`Open: http://localhost:3000/lead/${id}`);
  }
} catch (err) {
  console.error("Seeding failed:", err);
  process.exitCode = 1;
} finally {
  db.close();
}
