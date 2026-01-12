-- =============================================================================
-- CLEANUP: Remove unwanted brands and duplicates
-- Keep ONLY: Argent, Boscotek (1 only), Gilkon, Lectrum
-- =============================================================================

-- Step 1: Delete all unwanted brands by slug
DELETE FROM public.brands 
WHERE slug NOT IN ('argent', 'boscotek', 'gilkon', 'lectrum');

-- Step 2: Remove duplicate Boscotek entries (keep oldest by created_at)
WITH duplicates AS (
  SELECT id, slug, 
    ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at ASC) as rn
  FROM public.brands
)
DELETE FROM public.brands 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Step 3: Also clean up user_brand_access for deleted brands
DELETE FROM public.user_brand_access
WHERE brand_id NOT IN (SELECT id FROM public.brands);

-- Step 4: Update the get_user_brands function to properly return brands for super admin
CREATE OR REPLACE FUNCTION public.get_user_brands()
RETURNS SETOF public.brands AS $$
BEGIN
  -- Super admins see ALL brands (including draft) - no filtering
  IF public.is_super_admin() THEN
    RETURN QUERY 
    SELECT DISTINCT b.* FROM public.brands b 
    ORDER BY b.name;
  END IF;
  
  -- Regular admins see all active brands
  IF public.is_admin() THEN
    RETURN QUERY 
    SELECT DISTINCT b.* FROM public.brands b 
    WHERE b.status = 'active' 
    ORDER BY b.name;
  END IF;
  
  -- Others see only brands they have explicit access to
  RETURN QUERY
  SELECT DISTINCT b.* FROM public.brands b
  JOIN public.user_brand_access uba ON uba.brand_id = b.id
  WHERE uba.user_id = auth.uid()
  AND uba.is_active = true
  AND b.status = 'active'
  ORDER BY b.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Ensure proper grants
GRANT EXECUTE ON FUNCTION public.get_user_brands() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_brands() TO anon;

-- Step 5: Grant super admin access to remaining brands
INSERT INTO public.user_brand_access (user_id, brand_id, access_level, is_active)
SELECT 
  '47b5f0a3-fb5b-4399-b3c5-08fc8762a039'::UUID,
  b.id,
  'admin'::public.brand_access_level,
  true
FROM public.brands b
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_brand_access uba 
  WHERE uba.user_id = '47b5f0a3-fb5b-4399-b3c5-08fc8762a039'::UUID 
  AND uba.brand_id = b.id
);
