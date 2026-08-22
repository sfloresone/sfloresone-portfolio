CREATE TABLE visit_locations_new (
  location_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  country TEXT NOT NULL,
  visit_count INTEGER NOT NULL DEFAULT 0
);

INSERT INTO visit_locations_new (location_key, label, country, visit_count)
SELECT location_key, label, country, visit_count FROM visit_locations;

DROP TABLE visit_locations;

ALTER TABLE visit_locations_new RENAME TO visit_locations;
