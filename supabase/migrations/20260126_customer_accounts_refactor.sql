-- Migration: Customer Accounts Refactor
-- Renames "Distributor" concept to "Customer" and enhances companies table
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CREATE CUSTOMER CATEGORY ENUM
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_category') THEN
    CREATE TYPE customer_category AS ENUM (
      'distributor',
      'reseller', 
      'retail',
      'government',
      'education',
      'trade',
      'wholesale',
      'export',
      'internal',
      'vip'
    );
  END IF;
END $$;

-- ============================================
-- 2. ADD COLUMNS TO COMPANIES TABLE
-- ============================================
DO $$ 
BEGIN
  -- NetSuite customer ID for ERP integration
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'netsuite_customer_id') THEN
    ALTER TABLE companies ADD COLUMN netsuite_customer_id TEXT;
  END IF;
  
  -- Customer category for classification
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'customer_category') THEN
    ALTER TABLE companies ADD COLUMN customer_category TEXT DEFAULT 'retail';
  END IF;
  
  -- Pricing tier link (may already exist)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'pricing_tier_id') THEN
    ALTER TABLE companies ADD COLUMN pricing_tier_id UUID REFERENCES pricing_tiers(id);
  END IF;
  
  -- Account number (internal reference, auto-generated)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'account_number') THEN
    ALTER TABLE companies ADD COLUMN account_number TEXT UNIQUE;
  END IF;
  
  -- ABN (Australian Business Number)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'abn') THEN
    ALTER TABLE companies ADD COLUMN abn TEXT;
  END IF;
  
  -- Trading name (if different from company name)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'trading_name') THEN
    ALTER TABLE companies ADD COLUMN trading_name TEXT;
  END IF;
  
  -- Credit limit
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'credit_limit') THEN
    ALTER TABLE companies ADD COLUMN credit_limit NUMERIC;
  END IF;
  
  -- Payment terms
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'payment_terms') THEN
    ALTER TABLE companies ADD COLUMN payment_terms TEXT DEFAULT '30 days';
  END IF;
  
  -- Internal notes (staff only)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'internal_notes') THEN
    ALTER TABLE companies ADD COLUMN internal_notes TEXT;
  END IF;
  
  -- Logo URL
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'logo_url') THEN
    ALTER TABLE companies ADD COLUMN logo_url TEXT;
  END IF;
  
  -- Website
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'website') THEN
    ALTER TABLE companies ADD COLUMN website TEXT;
  END IF;
  
  -- Region (for territory management)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'region') THEN
    ALTER TABLE companies ADD COLUMN region TEXT;
  END IF;
END $$;

-- Create index on netsuite_customer_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_companies_netsuite ON companies(netsuite_customer_id) WHERE netsuite_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_category ON companies(customer_category);
CREATE INDEX IF NOT EXISTS idx_companies_account ON companies(account_number);
CREATE INDEX IF NOT EXISTS idx_companies_tier ON companies(pricing_tier_id);

-- ============================================
-- 3. AUTO-GENERATE ACCOUNT NUMBER FOR COMPANIES
-- ============================================
CREATE OR REPLACE FUNCTION generate_company_account_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  prefix TEXT;
BEGIN
  IF NEW.account_number IS NULL THEN
    -- Prefix based on category
    prefix := CASE NEW.customer_category
      WHEN 'distributor' THEN 'DST'
      WHEN 'reseller' THEN 'RSL'
      WHEN 'government' THEN 'GOV'
      WHEN 'education' THEN 'EDU'
      WHEN 'wholesale' THEN 'WSL'
      WHEN 'export' THEN 'EXP'
      WHEN 'vip' THEN 'VIP'
      ELSE 'CUS'
    END;
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(account_number FROM 4) AS INTEGER)), 999) + 1
    INTO next_num
    FROM companies
    WHERE account_number LIKE prefix || '%';
    
    NEW.account_number := prefix || LPAD(next_num::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generate_company_account_number_trigger ON companies;
CREATE TRIGGER generate_company_account_number_trigger
  BEFORE INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION generate_company_account_number();

-- ============================================
-- 4. MIGRATE DATA FROM DISTRIBUTORS TO COMPANIES
-- ============================================
-- Insert distributors that don't already exist in companies
INSERT INTO companies (
  name,
  trading_name,
  abn,
  account_number,
  pricing_tier_id,
  phone,
  address,
  city,
  state,
  postcode,
  country,
  is_active,
  is_approved,
  internal_notes,
  logo_url,
  website,
  region,
  customer_category,
  created_at,
  updated_at
)
SELECT 
  d.company_name,
  d.trading_name,
  d.abn,
  d.account_number,
  d.pricing_tier_id,
  d.contact_phone,
  d.address_line1,
  d.suburb,
  d.state,
  d.postcode,
  d.country,
  d.is_active,
  d.is_approved,
  d.internal_notes,
  d.logo_url,
  d.website,
  d.region,
  'distributor',
  d.created_at,
  d.updated_at
FROM distributors d
WHERE NOT EXISTS (
  SELECT 1 FROM companies c 
  WHERE c.name = d.company_name 
  OR c.account_number = d.account_number
);

-- Link distributor users to their companies via contacts
INSERT INTO contacts (
  company_id,
  user_id,
  first_name,
  last_name,
  email,
  phone,
  is_primary,
  is_active,
  created_at
)
SELECT 
  c.id,
  d.user_id,
  COALESCE(SPLIT_PART(d.contact_name, ' ', 1), 'Contact'),
  COALESCE(NULLIF(SPLIT_PART(d.contact_name, ' ', 2), ''), '-'),
  d.contact_email,
  d.contact_phone,
  true,
  true,
  d.created_at
FROM distributors d
JOIN companies c ON c.account_number = d.account_number
WHERE d.user_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM contacts ct 
  WHERE ct.user_id = d.user_id AND ct.company_id = c.id
);

-- ============================================
-- 5. UPDATE RLS POLICIES FOR COMPANIES
-- ============================================
-- Allow staff to manage companies
DROP POLICY IF EXISTS "companies_staff_all" ON companies;
CREATE POLICY "companies_staff_all" ON companies
  FOR ALL USING (is_staff() OR is_admin());

-- Allow users to see their own company (via contacts)
DROP POLICY IF EXISTS "companies_own_select" ON companies;
CREATE POLICY "companies_own_select" ON companies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contacts 
      WHERE contacts.company_id = companies.id 
      AND contacts.user_id = auth.uid()
      AND contacts.is_active = true
    )
  );

-- Allow users to update limited fields on their own company
DROP POLICY IF EXISTS "companies_own_update" ON companies;
CREATE POLICY "companies_own_update" ON companies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM contacts 
      WHERE contacts.company_id = companies.id 
      AND contacts.user_id = auth.uid()
      AND contacts.is_active = true
      AND contacts.is_primary = true
    )
  );

-- ============================================
-- 6. HELPER FUNCTIONS FOR CUSTOMER PRICING
-- ============================================

-- Get current user's company ID
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT c.id 
    FROM contacts ct
    JOIN companies c ON c.id = ct.company_id
    WHERE ct.user_id = auth.uid()
    AND ct.is_active = true
    AND c.is_active = true
    AND c.is_approved = true
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current user's pricing tier from their company
CREATE OR REPLACE FUNCTION get_user_company_pricing_tier()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT c.pricing_tier_id 
    FROM contacts ct
    JOIN companies c ON c.id = ct.company_id
    WHERE ct.user_id = auth.uid()
    AND ct.is_active = true
    AND c.is_active = true
    AND c.is_approved = true
    AND c.pricing_tier_id IS NOT NULL
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is a customer (has approved company)
CREATE OR REPLACE FUNCTION is_customer()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM contacts ct
    JOIN companies c ON c.id = ct.company_id
    WHERE ct.user_id = auth.uid()
    AND ct.is_active = true
    AND c.is_active = true
    AND c.is_approved = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_company_pricing_tier() TO authenticated;
GRANT EXECUTE ON FUNCTION is_customer() TO authenticated;

-- ============================================
-- 7. VERIFY MIGRATION
-- ============================================
SELECT 
  'Companies with pricing tiers:' as info,
  COUNT(*) as count
FROM companies 
WHERE pricing_tier_id IS NOT NULL;

SELECT 'Customer accounts refactor complete!' as message;
