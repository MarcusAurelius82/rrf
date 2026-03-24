-- ─── Enable PostGIS extension for geospatial queries ─────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;

-- ─── Resources table ─────────────────────────────────────────────────────────
CREATE TABLE resources (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('shelter','food','legal','medical','language')),
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','closing_soon','appointment_only')),
  address      TEXT NOT NULL,
  city         TEXT NOT NULL,
  state        CHAR(2) NOT NULL,
  zip          TEXT,
  lat          DOUBLE PRECISION NOT NULL,
  lng          DOUBLE PRECISION NOT NULL,
  location     GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (ST_Point(lng, lat)) STORED,
  phone        TEXT,
  website      TEXT,
  hours        JSONB,               -- { "mon": "09:00-17:00", "sun": null }
  languages    TEXT[] DEFAULT '{}', -- ["EN","AR","ES"]
  urgent       BOOLEAN DEFAULT false,
  verified     BOOLEAN DEFAULT false,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name,'') || ' ' || coalesce(address,'') || ' ' || coalesce(city,''))
  ) STORED,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX resources_location_idx ON resources USING GIST (location);
CREATE INDEX resources_state_idx ON resources (state);
CREATE INDEX resources_category_idx ON resources (category);
CREATE INDEX resources_search_idx ON resources USING GIN (search_vector);
CREATE INDEX resources_urgent_idx ON resources (urgent) WHERE urgent = true;

-- ─── PostGIS radius function ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION resources_within_radius(lat FLOAT, lng FLOAT, radius_miles FLOAT)
RETURNS SETOF resources AS $$
  SELECT * FROM resources
  WHERE ST_DWithin(
    location,
    ST_Point(lng, lat)::geography,
    radius_miles * 1609.34  -- miles to meters
  )
  ORDER BY ST_Distance(location, ST_Point(lng, lat)::geography);
$$ LANGUAGE sql STABLE;

-- ─── User profiles ────────────────────────────────────────────────────────────
CREATE TABLE user_profiles (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_id          TEXT UNIQUE NOT NULL,
  role              TEXT DEFAULT 'viewer' CHECK (role IN ('admin','contributor','viewer')),
  preferred_language TEXT DEFAULT 'EN',
  saved_resources   UUID[] DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Public can read verified resources
CREATE POLICY "Public read verified resources"
  ON resources FOR SELECT
  USING (verified = true);

-- Contributors can insert (pending review)
CREATE POLICY "Authenticated users can insert"
  ON resources FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Admins can do everything
CREATE POLICY "Admins full access"
  ON resources FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE clerk_id = auth.uid()::text AND role = 'admin')
  );
