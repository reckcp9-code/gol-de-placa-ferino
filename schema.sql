-- Estrutura legada mantida para compatibilidade
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

-- Jogadores iniciais
INSERT OR IGNORE INTO players(name,active) VALUES('Adrian',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Alejandro',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Allef',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Bruno',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Caiam',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Clovis',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Cristian M',1);
INSERT OR IGNORE INTO players(name,active) VALUES('David',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Deco',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Diego',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Douglas',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Edvandro',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Emerson',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Felipe Chagas',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Ferreira',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Henry',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Irmão do Rodrigo',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Ismael',1);
INSERT OR IGNORE INTO players(name,active) VALUES('João',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Jucemar',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Luigi',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Marcos',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Miguel',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Mi',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Nicolas',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Ninja',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Quintão',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Richard',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Rodrigo',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Sapatenis',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Vascaino',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Vilson',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Wagner',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Welligton',1);
INSERT OR IGNORE INTO players(name,active) VALUES('Will',1);

-- Contagem já existente da temporada 2026
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Cheia','Ferreira',1);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Cheia','Allef',5);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Cheia','João',1);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Cheia','Wagner',2);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Cheia','Clovis',1);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Cheia','Luigi',3);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Cheia','Vilson',3);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Cheia','Alejandro',2);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Cheia','Douglas',1);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Cheia','Adrian',2);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Cheia','Emerson',1);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Cheia','Richard',2);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Cheia','Vascaino',1);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Cheia','Deco',1);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Murcha','Vilson',2);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Murcha','Welligton',1);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Murcha','Ismael',2);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Murcha','Bruno',3);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Murcha','David',4);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Murcha','Cristian M',1);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Murcha','Quintão',1);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Murcha','Diego',1);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Murcha','Henry',1);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Murcha','Caiam',1);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Murcha','Ninja',2);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Murcha','Deco',1);
INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(2026,'Bola Murcha','Will',1);

-- Garante uma partida inicial apenas se ainda não existir nenhuma
INSERT INTO matches(name,season,status)
SELECT 'Partida atual',2026,'open'
WHERE NOT EXISTS (SELECT 1 FROM matches);