-- Fix infinite recursion in contacts RLS and add OMG company type

-- Drop the problematic policies that cause recursion
DROP POLICY IF EXISTS "Users can view own company contacts" ON contacts;
DROP POLICY IF EXISTS "Staff can view all contacts" ON contacts;
DROP POLICY IF EXISTS "Staff can manage contacts" ON contacts;

-- Recreate policies without recursion

-- Staff can do everything with contacts
CREATE POLICY "Staff full access to contacts"
  ON contacts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('admin', 'sales', 'pricing_manager')
    )
  );

-- Users can view their own contact record only (no recursion)
CREATE POLICY "Users can view own contact"
  ON contacts FOR SELECT
  USING (user_id = auth.uid());

-- Users can view contacts at companies they belong to
-- Using a subquery to avoid recursion
CREATE POLICY "Users can view company contacts"
  ON contacts FOR SELECT
  USING (
    company_id IN (
      SELECT c.company_id 
      FROM contacts c 
      WHERE c.user_id = auth.uid() 
      AND c.is_active = true
    )
  );

-- Also fix companies policy if needed
DROP POLICY IF EXISTS "Users can view own company" ON companies;

CREATE POLICY "Users can view own company"
  ON companies FOR SELECT
  USING (
    id IN (
      SELECT company_id 
      FROM contacts 
      WHERE user_id = auth.uid() 
      AND is_active = true
    )
  );

-- Add OMG (internal) company type to the options
-- Update the generate_account_number function to handle OMG type
CREATE OR REPLACE FUNCTION generate_account_number()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  next_num INT;
BEGIN
  -- Prefix based on company type
  prefix := CASE NEW.company_type
    WHEN 'omg' THEN 'OMG'
    WHEN 'distributor' THEN 'DIST'
    WHEN 'retail' THEN 'RET'
    WHEN 'government' THEN 'GOV'
    WHEN 'export' THEN 'EXP'
    ELSE 'CUST'
  END;
  
  -- Get next number
  SELECT COALESCE(MAX(CAST(SUBSTRING(account_number FROM LENGTH(prefix) + 2) AS INT)), 0) + 1
  INTO next_num
  FROM companies
  WHERE account_number LIKE prefix || '-%';
  
  NEW.account_number := prefix || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining company types
COMMENT ON COLUMN companies.company_type IS 'Company type: omg (internal staff), distributor, retail, government, export';
