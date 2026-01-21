-- =============================================================================
-- FIX: user_brand_access RLS policy to include super_admin
-- =============================================================================
-- The current policy only checks is_admin() which doesn't include super_admin
-- This fixes it to allow both admin and super_admin to manage brand access
-- =============================================================================

-- Drop the existing admin policy
DROP POLICY IF EXISTS "user_brand_access_admin" ON public.user_brand_access;

-- Create new policy that includes super_admin
CREATE POLICY "user_brand_access_admin" ON public.user_brand_access
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_super_admin())
  WITH CHECK (public.is_admin() OR public.is_super_admin());

-- Also update is_admin() to include super_admin for consistency
-- This makes super_admin a superset of admin permissions everywhere
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Grant execute
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMENT ON FUNCTION public.is_admin() IS 'Returns true if user has admin or super_admin role';
