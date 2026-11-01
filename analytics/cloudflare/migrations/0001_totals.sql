CREATE TABLE IF NOT EXISTS totals (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  level TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (day, event, level)
);
