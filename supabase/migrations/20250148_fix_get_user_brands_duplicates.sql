-- =============================================================================
-- FIX: get_user_brands returning duplicates due to IF instead of ELSIF
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_user_brands()
RETURNS SETOF public.brands AS $$
BEGIN
  -- Super admins see ALL brands - return immediately
  IF public.is_super_admin() THEN
    RETURN QUERY 
    SELECT DISTINCT b.* FROM public.brands b 
    ORDER BY b.name;
    RETURN;  -- EXIT the function here!
  END IF;
  
  -- Regular admins see all active brands - return immediately
  IF public.is_admin() THEN
    RETURN QUERY 
    SELECT DISTINCT b.* FROM public.brands b 
    WHERE b.status = 'active' 
    ORDER BY b.name;
    RETURN;  -- EXIT the function here!
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
