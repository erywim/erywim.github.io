CREATE TABLE IF NOT EXISTS greetings (
  key TEXT PRIMARY KEY NOT NULL,
  message TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO greetings (key, message) VALUES ('hello', 'hello world');
