-- Migration: User Profiles
-- Store additional user details like name, phone, etc.

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  company TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'sales', 'pricing_manager')
    )
  );

-- Admins can update any profile
CREATE POLICY "Admins can update all profiles"
  ON user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Create function to get users with emails (admin only)
-- This uses SECURITY DEFINER to access auth.users
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
  -- Only allow admins, sales, and pricing managers to call this
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'sales', 'pricing_manager')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    au.id,
    au.email::TEXT,
    COALESCE(up.full_name, au.raw_user_meta_data->>'full_name')::TEXT as full_name,
    up.phone,
    up.company,
    au.created_at,
    au.last_sign_in_at as last_sign_in,
    ur.role::TEXT
  FROM auth.users au
  LEFT JOIN user_profiles up ON up.id = au.id
  LEFT JOIN user_roles ur ON ur.user_id = au.id
  ORDER BY au.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute to authenticated users (function checks permissions internally)
GRANT EXECUTE ON FUNCTION get_users_with_emails() TO authenticated;

-- Function to update user profile (for self-service)
CREATE OR REPLACE FUNCTION update_user_profile(
  p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name, phone, company)
  VALUES (auth.uid(), p_full_name, p_phone, p_company)
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(p_full_name, user_profiles.full_name),
    phone = COALESCE(p_phone, user_profiles.phone),
    company = COALESCE(p_company, user_profiles.company),
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_user_profile(TEXT, TEXT, TEXT) TO authenticated;

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (only if not exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
