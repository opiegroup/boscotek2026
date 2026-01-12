-- =============================================================================
-- FIX: Update get_users_with_brand_access to properly fetch user details
-- =============================================================================

-- Drop and recreate the function with proper auth.users access
CREATE OR REPLACE FUNCTION public.get_users_with_brand_access(p_brand_id UUID DEFAULT NULL)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  global_role TEXT,
  brand_accesses JSONB
) AS $$
BEGIN
  -- Super admin can see all users
  IF NOT public.is_super_admin() AND NOT public.is_admin() THEN
    -- Brand admins can only see users in their brands
    IF p_brand_id IS NULL THEN
      RAISE EXCEPTION 'Brand ID required for non-super-admin';
    END IF;
    IF NOT public.user_has_brand_access(p_brand_id, 'admin') THEN
      RAISE EXCEPTION 'Permission denied';
    END IF;
  END IF;
  
  RETURN QUERY
  SELECT 
    u.id AS user_id,
    u.email::TEXT,
    COALESCE(
      u.raw_user_meta_data->>'full_name',
      up.full_name,
      split_part(u.email, '@', 1)
    ) AS full_name,
    (SELECT ur.role::TEXT FROM public.user_roles ur WHERE ur.user_id = u.id ORDER BY 
      CASE ur.role::TEXT WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 WHEN 'pricing_manager' THEN 2 WHEN 'sales' THEN 3 WHEN 'distributor' THEN 4 WHEN 'viewer' THEN 5 END 
      LIMIT 1
    ) AS global_role,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'brand_id', uba.brand_id,
        'brand_name', b.name,
        'brand_slug', b.slug,
        'access_level', uba.access_level::TEXT,
        'scopes', uba.scopes,
        'is_active', uba.is_active
      ))
      FROM public.user_brand_access uba
      JOIN public.brands b ON b.id = uba.brand_id
      WHERE uba.user_id = u.id
      AND (p_brand_id IS NULL OR uba.brand_id = p_brand_id)
      ), '[]'::JSONB
    ) AS brand_accesses
  FROM auth.users u
  LEFT JOIN public.user_profiles up ON up.id = u.id
  WHERE 
    -- If brand_id specified, only show users with access to that brand
    (p_brand_id IS NULL OR EXISTS (
      SELECT 1 FROM public.user_brand_access uba 
      WHERE uba.user_id = u.id AND uba.brand_id = p_brand_id
    ))
    -- Or show users with global roles
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
  ORDER BY u.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_users_with_brand_access(UUID) TO authenticated;

-- =============================================================================
-- Also update get_users_with_emails RPC for backward compatibility
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_users_with_emails()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  company TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in TIMESTAMPTZ,
  role TEXT
) AS $$
BEGIN
  -- Only admins can see all users
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin access required';
  END IF;
  
  RETURN QUERY
  SELECT 
    u.id,
    u.email::TEXT,
    COALESCE(u.raw_user_meta_data->>'full_name', up.full_name, split_part(u.email, '@', 1)) AS full_name,
    COALESCE(u.raw_user_meta_data->>'phone', up.phone) AS phone,
    COALESCE(u.raw_user_meta_data->>'company', up.company) AS company,
    u.created_at,
    u.last_sign_in_at AS last_sign_in,
    (SELECT ur.role::TEXT FROM public.user_roles ur WHERE ur.user_id = u.id ORDER BY 
      CASE ur.role::TEXT WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 WHEN 'pricing_manager' THEN 2 WHEN 'sales' THEN 3 WHEN 'distributor' THEN 4 WHEN 'viewer' THEN 5 END 
      LIMIT 1
    ) AS role
  FROM auth.users u
  LEFT JOIN public.user_profiles up ON up.id = u.id
  WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
  ORDER BY u.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_users_with_emails() TO authenticated;

-- =============================================================================
-- Update your user profile with correct details
-- =============================================================================

-- Create or update your user profile
INSERT INTO public.user_profiles (id, full_name, company)
VALUES (
  '47b5f0a3-fb5b-4399-b3c5-08fc8762a039',
  'Timm McVaigh',
  'Opie Manufacturing Group'
)
ON CONFLICT (id) DO UPDATE SET
  full_name = 'Timm McVaigh',
  company = 'Opie Manufacturing Group',
  updated_at = NOW();
