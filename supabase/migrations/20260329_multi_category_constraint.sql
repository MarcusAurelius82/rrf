-- Allow multiple rows per office (one per category) by changing the unique
-- constraint from (name, zip) to (name, zip, category).
ALTER TABLE resources
  DROP CONSTRAINT IF EXISTS resources_name_zip_unique,
  ADD CONSTRAINT resources_name_zip_category_unique UNIQUE (name, zip, category);
