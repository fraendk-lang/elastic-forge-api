import Database from 'better-sqlite3'
import { DB_PATH } from './env.js'

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    migrate(_db)
  }
  return _db
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT 'Anon',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS community_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      tagline TEXT,
      description TEXT,
      fragment TEXT NOT NULL,
      uniforms TEXT NOT NULL,
      layers TEXT,
      thumbnail_data_url TEXT,
      views INTEGER NOT NULL DEFAULT 0,
      published_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS likes (
      user_id TEXT NOT NULL REFERENCES users(id),
      entry_id TEXT NOT NULL REFERENCES community_entries(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, entry_id)
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id TEXT NOT NULL REFERENCES users(id),
      entry_id TEXT NOT NULL REFERENCES community_entries(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, entry_id)
    );

    CREATE INDEX IF NOT EXISTS idx_entries_user ON community_entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_entries_published ON community_entries(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_entries_views ON community_entries(views DESC);
    CREATE INDEX IF NOT EXISTS idx_likes_entry ON likes(entry_id);
    CREATE INDEX IF NOT EXISTS idx_favorites_entry ON favorites(entry_id);
  `)
}
