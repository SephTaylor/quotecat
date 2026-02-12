-- Create locations table for per-city pricing support
-- Kalamazoo, Battle Creek, Lansing (Michigan)

CREATE TABLE locations (
  id TEXT PRIMARY KEY,           -- 'kalamazoo', 'battle_creek', 'lansing'
  name TEXT NOT NULL,            -- 'Kalamazoo'
  state TEXT NOT NULL,           -- 'MI'
  region TEXT,                   -- 'Southwest Michigan'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial cities
INSERT INTO locations (id, name, state, region) VALUES
  ('kalamazoo', 'Kalamazoo', 'MI', 'Southwest Michigan'),
  ('battle_creek', 'Battle Creek', 'MI', 'Southwest Michigan'),
  ('lansing', 'Lansing', 'MI', 'Central Michigan');

-- RLS - public read, service role write
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view locations"
  ON locations FOR SELECT
  USING (true);

CREATE POLICY "Service role manages locations"
  ON locations FOR ALL
  USING (auth.role() = 'service_role');
