CREATE TABLE IF NOT EXISTS visit_locations (
  location_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  country TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  visit_count INTEGER NOT NULL DEFAULT 0
);
