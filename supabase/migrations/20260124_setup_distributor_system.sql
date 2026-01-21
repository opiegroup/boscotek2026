-- Migration: Setup Complete Distributor System
-- Run this in Supabase SQL Editor to enable the distributor portal

-- ============================================
-- 1. PRICING TIERS TABLE (already exists, just ensure columns)
-- ============================================

-- Add missing columns if they don't exist
DO $$ 
BEGIN
  -- Add discount_percentage if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pricing_tiers' AND column_name = 'discount_percentage') THEN
    ALTER TABLE pricing_tiers ADD COLUMN discount_percentage NUMERIC(5,2) DEFAULT 0;
  END IF;
  
  -- Add sort_order if missing  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pricing_tiers' AND column_name = 'sort_order') THEN
    ALTER TABLE pricing_tiers ADD COLUMN sort_order INTEGER DEFAULT 0;
  END IF;
  
  -- Add min_order_value if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pricing_tiers' AND column_name = 'min_order_value') THEN
    ALTER TABLE pricing_tiers ADD COLUMN min_order_value NUMERIC;
  END IF;
END $$;

-- RLS
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;

-- Update existing tiers with discount percentages
UPDATE pricing_tiers SET discount_percentage = 0, sort_order = 0 WHERE code = 'STD' OR code = 'CASH';
UPDATE pricing_tiers SET discount_percentage = 10, sort_order = 1 WHERE code = 'BRONZE';
UPDATE pricing_tiers SET discount_percentage = 15, sort_order = 2 WHERE code = 'SILVER';
UPDATE pricing_tiers SET discount_percentage = 20, sort_order = 3 WHERE code = 'GOLD';
UPDATE pricing_tiers SET discount_percentage = 25, sort_order = 4 WHERE code = 'PLAT';

-- Insert default tiers if none exist (using only columns that exist)
INSERT INTO pricing_tiers (name, code, description) 
SELECT 'Standard', 'STD', 'Standard retail pricing'
WHERE NOT EXISTS (SELECT 1 FROM pricing_tiers WHERE code = 'STD' OR code = 'CASH');

INSERT INTO pricing_tiers (name, code, description) 
SELECT 'Bronze Partner', 'BRONZE', 'Entry-level distributor tier'
WHERE NOT EXISTS (SELECT 1 FROM pricing_tiers WHERE code = 'BRONZE');

INSERT INTO pricing_tiers (name, code, description) 
SELECT 'Silver Partner', 'SILVER', 'Mid-level distributor tier'
WHERE NOT EXISTS (SELECT 1 FROM pricing_tiers WHERE code = 'SILVER');

INSERT INTO pricing_tiers (name, code, description) 
SELECT 'Gold Partner', 'GOLD', 'Premium distributor tier'
WHERE NOT EXISTS (SELECT 1 FROM pricing_tiers WHERE code = 'GOLD');

INSERT INTO pricing_tiers (name, code, description) 
SELECT 'Platinum Partner', 'PLAT', 'Top-tier strategic partner'
WHERE NOT EXISTS (SELECT 1 FROM pricing_tiers WHERE code = 'PLAT');

-- ============================================
-- 2. DISTRIBUTORS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS distributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  trading_name TEXT,
  abn TEXT,
  account_number TEXT UNIQUE,
  pricing_tier_id UUID REFERENCES pricing_tiers(id),
  
  -- Contact details
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  
  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  suburb TEXT,
  state TEXT,
  postcode TEXT,
  country TEXT DEFAULT 'Australia',
  
  -- Account status
  is_active BOOLEAN DEFAULT true,
  is_approved BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  
  -- Additional fields from enhancements
  logo_url TEXT,
  description TEXT,
  website TEXT,
  business_hours TEXT,
  contact_mobile TEXT,
  region TEXT,
  category TEXT,
  credit_limit NUMERIC,
  payment_terms TEXT,
  
  internal_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_distributors_user ON distributors(user_id);
CREATE INDEX IF NOT EXISTS idx_distributors_tier ON distributors(pricing_tier_id);
CREATE INDEX IF NOT EXISTS idx_distributors_active ON distributors(is_active, is_approved) WHERE is_active = true AND is_approved = true;
CREATE INDEX IF NOT EXISTS idx_distributors_company ON distributors(company_name);

-- RLS
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "distributors_own_select" ON distributors;
DROP POLICY IF EXISTS "distributors_own_update" ON distributors;
DROP POLICY IF EXISTS "distributors_staff_select" ON distributors;
DROP POLICY IF EXISTS "distributors_staff_insert" ON distributors;
DROP POLICY IF EXISTS "distributors_staff_update" ON distributors;
DROP POLICY IF EXISTS "distributors_staff_delete" ON distributors;

-- Create RLS policies
CREATE POLICY "distributors_own_select" ON distributors
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "distributors_own_update" ON distributors
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "distributors_staff_select" ON distributors
  FOR SELECT USING (is_staff());

CREATE POLICY "distributors_staff_insert" ON distributors
  FOR INSERT WITH CHECK (is_staff() OR is_admin());

CREATE POLICY "distributors_staff_update" ON distributors
  FOR UPDATE USING (is_staff() OR is_admin());

CREATE POLICY "distributors_staff_delete" ON distributors
  FOR DELETE USING (is_admin());

-- ============================================
-- 3. AUTO-GENERATE ACCOUNT NUMBER
-- ============================================
CREATE OR REPLACE FUNCTION generate_distributor_account_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.account_number IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(account_number FROM 4) AS INTEGER)), 999) + 1
    INTO next_num
    FROM distributors
    WHERE account_number LIKE 'DST%';
    
    NEW.account_number := 'DST' || LPAD(next_num::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generate_distributor_account_number_trigger ON distributors;
CREATE TRIGGER generate_distributor_account_number_trigger
  BEFORE INSERT ON distributors
  FOR EACH ROW
  EXECUTE FUNCTION generate_distributor_account_number();

-- ============================================
-- 4. HELPER FUNCTIONS
-- ============================================

-- Check if current user is an approved distributor
CREATE OR REPLACE FUNCTION is_distributor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM distributors
    WHERE user_id = auth.uid()
    AND is_active = true
    AND is_approved = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get distributor pricing tier for current user
CREATE OR REPLACE FUNCTION get_user_pricing_tier()
RETURNS UUID AS $$
DECLARE
  v_tier_id UUID;
BEGIN
  SELECT d.pricing_tier_id INTO v_tier_id
  FROM distributors d
  WHERE d.user_id = auth.uid()
  AND d.is_active = true
  AND d.is_approved = true;
  
  RETURN v_tier_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get discount percentage for current user
CREATE OR REPLACE FUNCTION get_user_discount_percentage()
RETURNS NUMERIC AS $$
DECLARE
  v_discount NUMERIC;
BEGIN
  SELECT pt.discount_percentage INTO v_discount
  FROM distributors d
  JOIN pricing_tiers pt ON pt.id = d.pricing_tier_id
  WHERE d.user_id = auth.uid()
  AND d.is_active = true
  AND d.is_approved = true
  AND pt.is_active = true;
  
  RETURN COALESCE(v_discount, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current distributor ID
CREATE OR REPLACE FUNCTION get_current_distributor_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id FROM distributors
    WHERE user_id = auth.uid()
    AND is_active = true
    AND is_approved = true
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_distributor() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_pricing_tier() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_discount_percentage() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_distributor_id() TO authenticated;

-- ============================================
-- 5. CREATE MARKETING USER AS DISTRIBUTOR
-- ============================================
INSERT INTO distributors (
  user_id,
  company_name,
  contact_name,
  contact_email,
  is_active,
  is_approved,
  approved_at,
  pricing_tier_id
)
SELECT 
  u.id,
  'Timmpro',
  'Marketing',
  'opiegroupmarketing@gmail.com',
  true,
  true,
  now(),
  (SELECT id FROM pricing_tiers WHERE code = 'BRONZE' LIMIT 1)
FROM auth.users u
WHERE u.email = 'opiegroupmarketing@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM distributors d WHERE d.user_id = u.id
);

-- ============================================
-- 6. STORAGE BUCKET FOR LOGOS
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('distributor-logos', 'distributor-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Done!
SELECT 'Distributor system setup complete!' as message;
