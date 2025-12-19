-- Migration: Companies and Contacts System
-- Restructure distributors into a proper CRM-style companies/contacts model
-- Ready for NetSuite integration

-- Create companies table (replaces distributors for company info)
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Company identification
  company_name TEXT NOT NULL,
  trading_name TEXT,
  abn TEXT,
  acn TEXT,
  account_number TEXT UNIQUE, -- Auto-generated or from NetSuite
  
  -- NetSuite integration
  netsuite_id TEXT UNIQUE,
  netsuite_sync_at TIMESTAMPTZ,
  
  -- Pricing
  pricing_tier_id UUID REFERENCES pricing_tiers(id),
  preferred_currency TEXT DEFAULT 'AUD',
  credit_limit NUMERIC(12,2),
  payment_terms TEXT, -- e.g., 'Net 30', 'COD'
  
  -- Address (primary/billing)
  address_line1 TEXT,
  address_line2 TEXT,
  suburb TEXT,
  state TEXT,
  postcode TEXT,
  country TEXT DEFAULT 'Australia',
  
  -- Shipping address (if different)
  shipping_address_line1 TEXT,
  shipping_address_line2 TEXT,
  shipping_suburb TEXT,
  shipping_state TEXT,
  shipping_postcode TEXT,
  shipping_country TEXT DEFAULT 'Australia',
  
  -- Status
  company_type TEXT DEFAULT 'distributor', -- distributor, retail, government, export
  is_active BOOLEAN DEFAULT true,
  is_approved BOOLEAN DEFAULT false,
  
  -- Internal
  internal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create contacts table (multiple contacts per company)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id), -- Link to auth user if they have login
  
  -- Contact details
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  job_title TEXT,
  
  -- Role/permissions within company
  is_primary BOOLEAN DEFAULT false, -- Primary contact for company
  is_billing BOOLEAN DEFAULT false, -- Receives invoices
  is_shipping BOOLEAN DEFAULT false, -- Receives shipping notifications
  can_order BOOLEAN DEFAULT true, -- Can place orders
  can_view_pricing BOOLEAN DEFAULT true, -- Can see company pricing
  
  -- NetSuite integration  
  netsuite_id TEXT UNIQUE,
  netsuite_sync_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_companies_netsuite ON companies(netsuite_id);
CREATE INDEX IF NOT EXISTS idx_companies_account ON companies(account_number);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Companies RLS policies
CREATE POLICY "Staff can view all companies"
  ON companies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'sales', 'pricing_manager')
    )
  );

CREATE POLICY "Staff can manage companies"
  ON companies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'sales')
    )
  );

-- Users can view their own company
CREATE POLICY "Users can view own company"
  ON companies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contacts 
      WHERE contacts.company_id = companies.id 
      AND contacts.user_id = auth.uid()
    )
  );

-- Contacts RLS policies
CREATE POLICY "Staff can view all contacts"
  ON contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'sales', 'pricing_manager')
    )
  );

CREATE POLICY "Staff can manage contacts"
  ON contacts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'sales')
    )
  );

-- Users can view contacts at their company
CREATE POLICY "Users can view own company contacts"
  ON contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contacts c2 
      WHERE c2.company_id = contacts.company_id 
      AND c2.user_id = auth.uid()
    )
  );

-- Auto-generate account number
CREATE OR REPLACE FUNCTION generate_account_number()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  next_num INT;
BEGIN
  -- Prefix based on company type
  prefix := CASE NEW.company_type
    WHEN 'distributor' THEN 'DIST'
    WHEN 'retail' THEN 'RET'
    WHEN 'government' THEN 'GOV'
    WHEN 'export' THEN 'EXP'
    ELSE 'CUST'
  END;
  
  -- Get next number
  SELECT COALESCE(MAX(CAST(SUBSTRING(account_number FROM 5) AS INT)), 0) + 1
  INTO next_num
  FROM companies
  WHERE account_number LIKE prefix || '%';
  
  NEW.account_number := prefix || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_account_number
  BEFORE INSERT ON companies
  FOR EACH ROW
  WHEN (NEW.account_number IS NULL)
  EXECUTE FUNCTION generate_account_number();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Helper function to get user's company and pricing tier
CREATE OR REPLACE FUNCTION get_user_company_pricing()
RETURNS TABLE (
  company_id UUID,
  company_name TEXT,
  pricing_tier_id UUID,
  tier_name TEXT,
  markup_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as company_id,
    c.company_name,
    c.pricing_tier_id,
    pt.name as tier_name,
    pt.markup_percentage
  FROM contacts ct
  JOIN companies c ON c.id = ct.company_id
  LEFT JOIN pricing_tiers pt ON pt.id = c.pricing_tier_id
  WHERE ct.user_id = auth.uid()
  AND ct.is_active = true
  AND c.is_active = true
  AND c.is_approved = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_company_pricing() TO authenticated;

-- Migrate existing distributors to new schema (if any exist)
INSERT INTO companies (
  company_name,
  trading_name,
  abn,
  account_number,
  pricing_tier_id,
  address_line1,
  suburb,
  state,
  postcode,
  company_type,
  is_active,
  is_approved,
  internal_notes,
  created_at
)
SELECT 
  company_name,
  trading_name,
  abn,
  account_number,
  pricing_tier_id,
  address_line1,
  suburb,
  state,
  postcode,
  'distributor',
  is_active,
  is_approved,
  internal_notes,
  created_at
FROM distributors
ON CONFLICT (account_number) DO NOTHING;

-- Migrate distributor contacts
INSERT INTO contacts (
  company_id,
  user_id,
  first_name,
  last_name,
  email,
  phone,
  is_primary,
  can_order,
  can_view_pricing
)
SELECT 
  c.id,
  d.user_id,
  COALESCE(SPLIT_PART(d.contact_name, ' ', 1), 'Primary'),
  COALESCE(NULLIF(SPLIT_PART(d.contact_name, ' ', 2), ''), 'Contact'),
  d.contact_email,
  d.contact_phone,
  true,
  true,
  true
FROM distributors d
JOIN companies c ON c.account_number = d.account_number
WHERE d.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Add comment
COMMENT ON TABLE companies IS 'Customer/distributor companies - syncs with NetSuite';
COMMENT ON TABLE contacts IS 'Contacts at each company - multiple per company, can link to auth users';
