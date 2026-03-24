const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'bets.db');
const db = new Database(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    market_id TEXT NOT NULL,
    market_ticker TEXT,
    market_title TEXT NOT NULL,
    side TEXT NOT NULL CHECK(side IN ('yes', 'no')),
    odds REAL NOT NULL,
    amount REAL NOT NULL,
    created_at TEXT NOT NULL,
    close_time TEXT,
    resolved_at TEXT,
    result TEXT CHECK(result IN ('win', 'loss', 'push', NULL)),
    pnl REAL,
    market_data TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_market_id ON bets(market_id);
  CREATE INDEX IF NOT EXISTS idx_resolved ON bets(resolved_at);
`);

// Bet operations
const insertBet = db.prepare(`
  INSERT INTO bets (
    market_id, market_ticker, market_title, side, odds, amount, 
    created_at, close_time, market_data
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getOpenBets = db.prepare(`
  SELECT * FROM bets 
  WHERE resolved_at IS NULL 
  ORDER BY created_at DESC
`);

const resolveBet = db.prepare(`
  UPDATE bets 
  SET resolved_at = ?, result = ?, pnl = ?
  WHERE id = ?
`);

const getStats = db.prepare(`
  SELECT 
    COUNT(*) as total_bets,
    SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
    SUM(CASE WHEN result = 'push' THEN 1 ELSE 0 END) as pushes,
    SUM(COALESCE(pnl, 0)) as total_pnl,
    ROUND(AVG(CASE WHEN result IN ('win', 'loss') 
      THEN CASE WHEN result = 'win' THEN 100 ELSE 0 END 
      END), 1) as win_rate
  FROM bets
  WHERE resolved_at IS NOT NULL
`);

const getAllBets = db.prepare(`
  SELECT * FROM bets 
  ORDER BY created_at DESC 
  LIMIT ?
`);

module.exports = {
  db,
  insertBet,
  getOpenBets,
  resolveBet,
  getStats,
  getAllBets
};
