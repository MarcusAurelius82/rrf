-- Mark all federal resettlement agency resources as documentation_required = 'none'
-- These organizations have explicit no-barrier intake policies under federal resettlement programs.
-- Sources: IRC, World Relief, Catholic Charities, Global Refuge (formerly LIRS), RAICES, Lutheran Services.

UPDATE resources
SET documentation_required = 'none'
WHERE name ILIKE '%IRC%'
   OR name ILIKE '%International Rescue%'
   OR name ILIKE '%World Relief%'
   OR name ILIKE '%Catholic Charities%'
   OR name ILIKE '%Global Refuge%'
   OR name ILIKE '%RAICES%'
   OR name ILIKE '%Lutheran%';
