-- =============================================================================
-- BRAND SETTINGS AND SUPER ADMIN MIGRATION
-- Adds brand settings fields and super_admin (God Mode) role
-- =============================================================================

-- =============================================================================
-- PART 1: ADD MISSING COLUMNS TO BRANDS TABLE
-- =============================================================================

-- Add logo_url column (separate from theme_json for easier updates)
ALTER TABLE public.brands 
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add sales_email column (separate from support_email)
ALTER TABLE public.brands 
  ADD COLUMN IF NOT EXISTS sales_email TEXT;

-- Add primary_email column (alias for contact_email, for clarity)
-- Note: contact_email already exists, we'll use that as primary_email

-- =============================================================================
-- PART 2: ADD SUPER_ADMIN ROLE
-- =============================================================================

-- Add super_admin to the user_role enum
DO $$
BEGIN
  -- Check if super_admin already exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'super_admin' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'super_admin' BEFORE 'admin';
  END IF;
END $$;

-- =============================================================================
-- PART 3: UPDATE HELPER FUNCTIONS FOR SUPER_ADMIN (GOD MODE)
-- =============================================================================

-- Function to check if user is super admin (God Mode)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Update is_admin to also return true for super_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Update is_staff to include super_admin
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'admin', 'sales', 'pricing_manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Update get_user_role to prioritise super_admin
-- Drop existing function first to allow return type change
DROP FUNCTION IF EXISTS public.get_user_role();

-- Recreate with TEXT return type for compatibility across schemas
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role::TEXT INTO v_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY 
    CASE role::TEXT
      WHEN 'super_admin' THEN 0
      WHEN 'admin' THEN 1
      WHEN 'pricing_manager' THEN 2
      WHEN 'sales' THEN 3
      WHEN 'distributor' THEN 4
      WHEN 'viewer' THEN 5
    END
  LIMIT 1;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =============================================================================
-- PART 4: UPDATE BRAND ACCESS FUNCTIONS FOR SUPER_ADMIN
-- =============================================================================

-- Super admins have full access to all brands
CREATE OR REPLACE FUNCTION public.user_has_brand_access(p_brand_id UUID, p_min_level TEXT DEFAULT 'viewer')
RETURNS BOOLEAN AS $$
DECLARE
  v_access_level TEXT;
  v_level_order INT;
  v_min_order INT;
BEGIN
  -- Super admins have access to everything
  IF public.is_super_admin() THEN
    RETURN true;
  END IF;
  
  -- Regular admins also have full access (for backward compatibility)
  IF public.is_admin() THEN
    RETURN true;
  END IF;
  
  -- Check user_brand_access table
  SELECT access_level::TEXT INTO v_access_level
  FROM public.user_brand_access
  WHERE user_id = auth.uid()
  AND brand_id = p_brand_id
  AND is_active = true;
  
  IF v_access_level IS NULL THEN
    RETURN false;
  END IF;
  
  -- Compare access levels (viewer < sales < pricing < admin)
  v_level_order := CASE v_access_level 
    WHEN 'viewer' THEN 1 
    WHEN 'sales' THEN 2 
    WHEN 'pricing' THEN 3 
    WHEN 'admin' THEN 4 
  END;
  
  v_min_order := CASE p_min_level 
    WHEN 'viewer' THEN 1 
    WHEN 'sales' THEN 2 
    WHEN 'pricing' THEN 3 
    WHEN 'admin' THEN 4 
  END;
  
  RETURN v_level_order >= v_min_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Get all brands for super_admin, or assigned brands for others
CREATE OR REPLACE FUNCTION public.get_user_brands()
RETURNS SETOF public.brands AS $$
BEGIN
  -- Super admins see ALL brands (including draft)
  IF public.is_super_admin() THEN
    RETURN QUERY SELECT * FROM public.brands ORDER BY name;
  END IF;
  
  -- Regular admins see all active brands
  IF public.is_admin() THEN
    RETURN QUERY SELECT * FROM public.brands WHERE status = 'active' ORDER BY name;
  END IF;
  
  -- Others see only brands they have access to
  RETURN QUERY
  SELECT b.* FROM public.brands b
  JOIN public.user_brand_access uba ON uba.brand_id = b.id
  WHERE uba.user_id = auth.uid()
  AND uba.is_active = true
  AND b.status = 'active'
  ORDER BY b.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =============================================================================
-- PART 5: RPC FUNCTIONS FOR BRAND SETTINGS MANAGEMENT
-- =============================================================================

-- Update brand settings (admin only)
CREATE OR REPLACE FUNCTION public.update_brand_settings(
  p_brand_id UUID,
  p_name TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL,
  p_sales_email TEXT DEFAULT NULL,
  p_support_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_address_json JSONB DEFAULT NULL,
  p_theme_json JSONB DEFAULT NULL
)
RETURNS public.brands AS $$
DECLARE
  v_brand public.brands;
  v_old_data JSONB;
  v_new_data JSONB;
BEGIN
  -- Check permissions: super_admin can update any brand, brand admin can update their brand
  IF NOT public.is_super_admin() THEN
    IF NOT public.user_has_brand_access(p_brand_id, 'admin') THEN
      RAISE EXCEPTION 'Permission denied: requires admin access to this brand';
    END IF;
  END IF;
  
  -- Get current data for audit
  SELECT row_to_json(brands.*) INTO v_old_data FROM public.brands WHERE id = p_brand_id;
  
  -- Update the brand
  UPDATE public.brands SET
    name = COALESCE(p_name, name),
    logo_url = COALESCE(p_logo_url, logo_url),
    contact_email = COALESCE(p_contact_email, contact_email),
    sales_email = COALESCE(p_sales_email, sales_email),
    support_email = COALESCE(p_support_email, support_email),
    phone = COALESCE(p_phone, phone),
    address_json = COALESCE(p_address_json, address_json),
    theme_json = COALESCE(p_theme_json, theme_json),
    updated_at = NOW()
  WHERE id = p_brand_id
  RETURNING * INTO v_brand;
  
  -- Get new data for audit
  SELECT row_to_json(brands.*) INTO v_new_data FROM public.brands WHERE id = p_brand_id;
  
  -- Log the change
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    brand_id
  ) VALUES (
    auth.uid(),
    'update_brand_settings',
    'brand',
    p_brand_id,
    v_old_data,
    v_new_data,
    p_brand_id
  );
  
  RETURN v_brand;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =============================================================================
-- PART 6: RPC FUNCTIONS FOR USER BRAND ACCESS MANAGEMENT
-- =============================================================================

-- Get all users with their brand access (for admin UI)
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
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email) AS full_name,
    (SELECT ur.role::TEXT FROM public.user_roles ur WHERE ur.user_id = u.id ORDER BY 
      CASE ur.role::TEXT WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 WHEN 'pricing_manager' THEN 2 WHEN 'sales' THEN 3 WHEN 'distributor' THEN 4 WHEN 'viewer' THEN 5 END 
      LIMIT 1
    ) AS global_role,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'brand_id', uba.brand_id,
        'brand_name', b.name,
        'brand_slug', b.slug,
        'access_level', uba.access_level,
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

-- Assign user to brand with role
CREATE OR REPLACE FUNCTION public.assign_user_to_brand(
  p_user_id UUID,
  p_brand_id UUID,
  p_access_level TEXT,
  p_scopes JSONB DEFAULT '[]'::JSONB
)
RETURNS public.user_brand_access AS $$
DECLARE
  v_result public.user_brand_access;
BEGIN
  -- Check permissions
  IF NOT public.is_super_admin() THEN
    IF NOT public.user_has_brand_access(p_brand_id, 'admin') THEN
      RAISE EXCEPTION 'Permission denied: requires admin access to this brand';
    END IF;
  END IF;
  
  -- Upsert the assignment
  INSERT INTO public.user_brand_access (user_id, brand_id, access_level, scopes, granted_by)
  VALUES (p_user_id, p_brand_id, p_access_level::brand_access_level, p_scopes, auth.uid())
  ON CONFLICT (user_id, brand_id) DO UPDATE SET
    access_level = p_access_level::brand_access_level,
    scopes = p_scopes,
    is_active = true,
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  -- Log the change
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_data, brand_id)
  VALUES (
    auth.uid(),
    'assign_user_to_brand',
    'user_brand_access',
    v_result.id,
    jsonb_build_object('target_user', p_user_id, 'brand_id', p_brand_id, 'access_level', p_access_level),
    p_brand_id
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Remove user from brand
CREATE OR REPLACE FUNCTION public.remove_user_from_brand(
  p_user_id UUID,
  p_brand_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check permissions
  IF NOT public.is_super_admin() THEN
    IF NOT public.user_has_brand_access(p_brand_id, 'admin') THEN
      RAISE EXCEPTION 'Permission denied: requires admin access to this brand';
    END IF;
  END IF;
  
  -- Soft delete by setting is_active to false
  UPDATE public.user_brand_access 
  SET is_active = false, updated_at = NOW()
  WHERE user_id = p_user_id AND brand_id = p_brand_id;
  
  -- Log the change
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_data, brand_id)
  VALUES (
    auth.uid(),
    'remove_user_from_brand',
    'user_brand_access',
    NULL,
    jsonb_build_object('target_user', p_user_id, 'brand_id', p_brand_id),
    p_brand_id
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =============================================================================
-- PART 7: GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_brand_settings(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_with_brand_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_user_to_brand(UUID, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_user_from_brand(UUID, UUID) TO authenticated;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON FUNCTION public.is_super_admin() IS 'Returns true if user has super_admin (God Mode) role';
COMMENT ON FUNCTION public.update_brand_settings IS 'Update brand settings with audit logging';
COMMENT ON FUNCTION public.get_users_with_brand_access IS 'Get users with their brand access for admin UI';
COMMENT ON FUNCTION public.assign_user_to_brand IS 'Assign a user to a brand with a specific access level';
COMMENT ON FUNCTION public.remove_user_from_brand IS 'Remove user access from a brand (soft delete)';
COMMENT ON COLUMN public.brands.logo_url IS 'URL to brand logo image';
COMMENT ON COLUMN public.brands.sales_email IS 'Sales enquiry email address';
