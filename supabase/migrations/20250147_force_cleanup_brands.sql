-- =============================================================================
-- FORCE CLEANUP: Remove ALL duplicate Boscotek entries
-- =============================================================================

-- Step 1: Keep only ONE Boscotek - the oldest one
DO $$
DECLARE
  keep_id UUID;
BEGIN
  -- Find the oldest Boscotek to keep
  SELECT id INTO keep_id 
  FROM public.brands 
  WHERE slug = 'boscotek' 
  ORDER BY created_at ASC 
  LIMIT 1;
  
  -- Delete all other Boscotek entries
  IF keep_id IS NOT NULL THEN
    DELETE FROM public.brands 
    WHERE slug = 'boscotek' AND id != keep_id;
  END IF;
  
  -- Same for any other potential duplicates
  FOR keep_id IN 
    SELECT DISTINCT ON (slug) id 
    FROM public.brands 
    ORDER BY slug, created_at ASC
  LOOP
    DELETE FROM public.brands 
    WHERE slug = (SELECT slug FROM public.brands WHERE id = keep_id)
    AND id != keep_id;
  END LOOP;
END $$;

-- Step 2: Verify we only have the 4 brands we want
DELETE FROM public.brands 
WHERE slug NOT IN ('argent', 'boscotek', 'gilkon', 'lectrum');

-- Step 3: Clean up orphaned user_brand_access
DELETE FROM public.user_brand_access
WHERE brand_id NOT IN (SELECT id FROM public.brands);

-- Show what's left (for debugging)
-- SELECT id, name, slug, created_at FROM public.brands ORDER BY name;
