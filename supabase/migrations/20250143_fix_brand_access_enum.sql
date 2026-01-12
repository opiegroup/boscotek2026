-- =============================================================================
-- FIX: Create brand_access_level enum if it doesn't exist
-- =============================================================================

-- Create the enum type if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'brand_access_level') THEN
    CREATE TYPE brand_access_level AS ENUM ('viewer', 'sales', 'pricing', 'admin');
  END IF;
END $$;

-- =============================================================================
-- FIX: Update assign_user_to_brand to use TEXT casting
-- =============================================================================

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
  
  -- Upsert the assignment (cast text to enum)
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

-- =============================================================================
-- Grant your user super_admin role
-- =============================================================================

-- First, remove any existing admin role for this user
DELETE FROM public.user_roles 
WHERE user_id = '47b5f0a3-fb5b-4399-b3c5-08fc8762a039' 
AND role != 'super_admin';

-- Ensure super_admin role exists
INSERT INTO public.user_roles (user_id, role)
VALUES ('47b5f0a3-fb5b-4399-b3c5-08fc8762a039', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Grant this user access to ALL brands as admin
INSERT INTO public.user_brand_access (user_id, brand_id, access_level, granted_by)
SELECT 
  '47b5f0a3-fb5b-4399-b3c5-08fc8762a039',
  id,
  'admin'::brand_access_level,
  '47b5f0a3-fb5b-4399-b3c5-08fc8762a039'
FROM public.brands
ON CONFLICT (user_id, brand_id) DO UPDATE SET
  access_level = 'admin'::brand_access_level,
  is_active = true;
