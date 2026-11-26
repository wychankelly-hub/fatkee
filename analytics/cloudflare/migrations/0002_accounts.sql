-- 學生及老師的 Google 帳戶，以及每位學生每關的進度。
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,            -- Google 帳戶的 sub（不會改變的編號）
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  class_no TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  last_active TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  best_stars INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  in_review INTEGER NOT NULL DEFAULT 0,
  pass_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  hint_count INTEGER NOT NULL DEFAULT 0,
  last_at TEXT NOT NULL,
  PRIMARY KEY (user_id, level)
);
