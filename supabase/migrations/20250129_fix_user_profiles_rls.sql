-- Fix user_profiles RLS to allow admin insert/update

-- Allow admins to insert profiles (for setting up user names)
CREATE POLICY "Admins can insert profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Make sure the admin view policy uses FOR ALL to cover update as well
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;

-- Combined admin policy for all operations
CREATE POLICY "Admins full access to profiles"
  ON user_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Staff can view all profiles
CREATE POLICY "Staff can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('sales', 'pricing_manager')
    )
  );
