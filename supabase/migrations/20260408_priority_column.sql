-- Add priority column for refugee-relevance ranking.
-- Scale: 1 (low) – 10 (highest relevance for refugee populations).
-- Default 5 for all existing records; seed scripts set specific values.
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 5
    CHECK (priority BETWEEN 1 AND 10);

CREATE INDEX IF NOT EXISTS resources_priority_idx ON resources (priority DESC);
