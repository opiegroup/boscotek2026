-- Repair Migration: Ensure pricing_tiers and user_roles exist
-- This fixes cases where previous migrations were marked as applied but failed

-- First, ensure the update_updated_at_column function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create user_role enum if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM (
      'admin',
      'pricing_manager',
      'sales',
      'distributor',
      'viewer'
    );
  END IF;
END $$;

-- Create user_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- Create helper functions (using CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION has_role(required_role user_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = required_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_any_role(required_roles user_role[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = ANY(required_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'sales', 'pricing_manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_manage_pricing()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'pricing_manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
DECLARE
  v_role user_role;
BEGIN
  SELECT role INTO v_role
  FROM user_roles
  WHERE user_id = auth.uid()
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'pricing_manager' THEN 2
      WHEN 'sales' THEN 3
      WHEN 'distributor' THEN 4
      WHEN 'viewer' THEN 5
    END
  LIMIT 1;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts, then recreate
DROP POLICY IF EXISTS "user_roles_self_select" ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin_insert" ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin_update" ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin_delete" ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin_select" ON user_roles;

CREATE POLICY "user_roles_self_select" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_roles_admin_insert" ON user_roles
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "user_roles_admin_update" ON user_roles
  FOR UPDATE USING (is_admin());

CREATE POLICY "user_roles_admin_delete" ON user_roles
  FOR DELETE USING (is_admin());

CREATE POLICY "user_roles_admin_select" ON user_roles
  FOR SELECT USING (is_admin());

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION has_role(user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION has_any_role(user_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION can_manage_pricing() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;

-- Now create pricing_tiers table
CREATE TABLE IF NOT EXISTS pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  min_order_value NUMERIC,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pricing_tiers_code ON pricing_tiers(code);
CREATE INDEX IF NOT EXISTS idx_pricing_tiers_active ON pricing_tiers(is_active) WHERE is_active = true;

-- Trigger (drop and recreate to avoid conflicts)
DROP TRIGGER IF EXISTS update_pricing_tiers_updated_at ON pricing_tiers;
CREATE TRIGGER update_pricing_tiers_updated_at
  BEFORE UPDATE ON pricing_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies
DROP POLICY IF EXISTS "pricing_tiers_staff_select" ON pricing_tiers;
DROP POLICY IF EXISTS "pricing_tiers_staff_insert" ON pricing_tiers;
DROP POLICY IF EXISTS "pricing_tiers_staff_update" ON pricing_tiers;
DROP POLICY IF EXISTS "pricing_tiers_staff_delete" ON pricing_tiers;

CREATE POLICY "pricing_tiers_staff_select" ON pricing_tiers
  FOR SELECT USING (can_manage_pricing());

CREATE POLICY "pricing_tiers_staff_insert" ON pricing_tiers
  FOR INSERT WITH CHECK (can_manage_pricing());

CREATE POLICY "pricing_tiers_staff_update" ON pricing_tiers
  FOR UPDATE USING (can_manage_pricing());

CREATE POLICY "pricing_tiers_staff_delete" ON pricing_tiers
  FOR DELETE USING (can_manage_pricing());

-- Insert default pricing tiers (only if table is empty)
INSERT INTO pricing_tiers (name, code, discount_percentage, description, sort_order)
SELECT * FROM (VALUES
  ('Standard', 'STD', 0::NUMERIC, 'Standard retail pricing', 0),
  ('Bronze Partner', 'BRONZE', 10::NUMERIC, 'Entry-level distributor tier', 1),
  ('Silver Partner', 'SILVER', 15::NUMERIC, 'Mid-level distributor tier', 2),
  ('Gold Partner', 'GOLD', 20::NUMERIC, 'Premium distributor tier', 3),
  ('Platinum Partner', 'PLAT', 25::NUMERIC, 'Top-tier strategic partner', 4)
) AS v(name, code, discount_percentage, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM pricing_tiers LIMIT 1);
