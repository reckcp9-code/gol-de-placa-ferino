-- Estrutura legada mantida para migração automática dos votos já existentes
CREATE TABLE IF NOT EXISTS voter_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, used_at TEXT);
CREATE TABLE IF NOT EXISTS votes (id INTEGER PRIMARY KEY AUTOINCREMENT, code_id INTEGER NOT NULL, category TEXT NOT NULL, player TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_votes_category ON votes(category);
CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO app_state(key,value) VALUES('voting_open','1');

-- Estrutura atual por partida
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  season INTEGER NOT NULL DEFAULT 2026,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS match_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL,
  code TEXT UNIQUE NOT NULL,
  used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_match_codes_match ON match_codes(match_id);

CREATE TABLE IF NOT EXISTS match_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL,
  code_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  player TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(code_id, category)
);
CREATE INDEX IF NOT EXISTS idx_match_votes_match ON match_votes(match_id);
CREATE INDEX IF NOT EXISTS idx_match_votes_category ON match_votes(match_id, category);

CREATE TABLE IF NOT EXISTS season_seed (
  season INTEGER NOT NULL,
  category TEXT NOT NULL,
  player TEXT NOT NULL,
  titles INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(season, category, player)
);

CREATE TABLE IF NOT EXISTS season_awards (
  season INTEGER NOT NULL,
  match_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  player TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(match_id, category, player)
);