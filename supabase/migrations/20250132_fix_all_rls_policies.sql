-- Complete RLS policy fix - remove ALL recursion

-- ============================================
-- CONTACTS TABLE - Drop ALL existing policies
-- ============================================
DROP POLICY IF EXISTS "Staff full access to contacts" ON contacts;
DROP POLICY IF EXISTS "Users can view own contact" ON contacts;
DROP POLICY IF EXISTS "Users can view company contacts" ON contacts;
DROP POLICY IF EXISTS "Staff can view all contacts" ON contacts;
DROP POLICY IF EXISTS "Staff can manage contacts" ON contacts;
DROP POLICY IF EXISTS "Users can view own company contacts" ON contacts;

-- Simple policies without recursion
-- Admin/Sales/Pricing Manager can do everything
CREATE POLICY "contacts_staff_all"
  ON contacts FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'sales', 'pricing_manager')
  );

-- Users can view their own contact record (by user_id match - no recursion)
CREATE POLICY "contacts_own_select"
  ON contacts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- COMPANIES TABLE - Drop ALL existing policies  
-- ============================================
DROP POLICY IF EXISTS "Staff can view all companies" ON companies;
DROP POLICY IF EXISTS "Staff can manage companies" ON companies;
DROP POLICY IF EXISTS "Users can view own company" ON companies;

-- Admin/Sales/Pricing Manager can do everything
CREATE POLICY "companies_staff_all"
  ON companies FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'sales', 'pricing_manager')
  );

-- Users can view companies where they are a contact (use EXISTS with explicit table reference)
CREATE POLICY "companies_own_select"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts c 
      WHERE c.company_id = companies.id 
      AND c.user_id = auth.uid()
    )
  );

-- ============================================
-- USER_PROFILES TABLE - Ensure admins can manage
-- ============================================
DROP POLICY IF EXISTS "Admins full access to profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Staff can view all profiles" ON user_profiles;

-- Admin full access
CREATE POLICY "profiles_admin_all"
  ON user_profiles FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1) = 'admin'
  );

-- Staff can view
CREATE POLICY "profiles_staff_select"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'sales', 'pricing_manager')
  );

-- Users can manage their own profile
CREATE POLICY "profiles_own_all"
  ON user_profiles FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
