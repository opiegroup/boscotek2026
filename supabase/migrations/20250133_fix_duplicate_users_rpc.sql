-- Fix get_users_with_emails to return only one row per user
-- Shows the highest priority role if user has multiple roles

DROP FUNCTION IF EXISTS get_users_with_emails();

CREATE OR REPLACE FUNCTION get_users_with_emails()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  company TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in TIMESTAMPTZ,
  role TEXT
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check caller has appropriate role
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'sales', 'pricing_manager', 'distributor', 'viewer')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (au.id)
    au.id,
    au.email::TEXT,
    COALESCE(up.full_name, (au.raw_user_meta_data->>'full_name'))::TEXT as full_name,
    up.phone::TEXT,
    up.company::TEXT,
    au.created_at,
    au.last_sign_in_at as last_sign_in,
    ur.role::TEXT
  FROM auth.users au
  LEFT JOIN user_profiles up ON up.id = au.id
  LEFT JOIN user_roles ur ON ur.user_id = au.id
  ORDER BY 
    au.id,
    -- Priority order: admin > pricing_manager > sales > distributor > viewer
    CASE ur.role
      WHEN 'admin' THEN 1
      WHEN 'pricing_manager' THEN 2
      WHEN 'sales' THEN 3
      WHEN 'distributor' THEN 4
      WHEN 'viewer' THEN 5
      ELSE 6
    END;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_users_with_emails() TO authenticated;

-- Also, let's remove the duplicate distributor role for the admin user
-- (Admin already has access to everything, doesn't need distributor role too)
-- This is optional - run manually if you want to clean up:
-- DELETE FROM user_roles WHERE user_id = 'your-user-id' AND role = 'distributor';
