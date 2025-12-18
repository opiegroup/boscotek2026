-- Migration: Distributor Accounts
-- Links users to distributor profiles with pricing tiers

CREATE TABLE distributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  trading_name TEXT,                     -- If different from company name
  abn TEXT,                              -- Australian Business Number
  account_number TEXT UNIQUE,            -- Internal account number (auto-generated)
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
  is_approved BOOLEAN DEFAULT false,     -- Requires admin approval
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  
  -- Notes
  internal_notes TEXT,                   -- Staff-only notes
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX idx_distributors_user ON distributors(user_id);
CREATE INDEX idx_distributors_tier ON distributors(pricing_tier_id);
CREATE INDEX idx_distributors_active ON distributors(is_active, is_approved) WHERE is_active = true AND is_approved = true;
CREATE INDEX idx_distributors_company ON distributors(company_name);

-- Updated_at trigger
CREATE TRIGGER update_distributors_updated_at
  BEFORE UPDATE ON distributors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate account number
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

CREATE TRIGGER generate_distributor_account_number_trigger
  BEFORE INSERT ON distributors
  FOR EACH ROW
  EXECUTE FUNCTION generate_distributor_account_number();

-- RLS
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;

-- Distributors can view their own record
CREATE POLICY "distributors_own_select" ON distributors
  FOR SELECT USING (user_id = auth.uid());

-- Distributors can update limited fields on their own record
CREATE POLICY "distributors_own_update" ON distributors
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid() AND
    -- Cannot change these fields
    pricing_tier_id = (SELECT pricing_tier_id FROM distributors WHERE id = distributors.id) AND
    is_approved = (SELECT is_approved FROM distributors WHERE id = distributors.id) AND
    account_number = (SELECT account_number FROM distributors WHERE id = distributors.id)
  );

-- Staff can view all distributors
CREATE POLICY "distributors_staff_select" ON distributors
  FOR SELECT USING (is_staff());

-- Admin/Pricing Manager can modify distributors
CREATE POLICY "distributors_staff_insert" ON distributors
  FOR INSERT WITH CHECK (can_manage_pricing());

CREATE POLICY "distributors_staff_update" ON distributors
  FOR UPDATE USING (can_manage_pricing());

CREATE POLICY "distributors_staff_delete" ON distributors
  FOR DELETE USING (is_admin());

-- Helper function: Get distributor pricing tier for current user
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

-- Helper function: Get discount percentage for current user (0 for retail/staff)
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

-- Helper function: Check if current user is an approved distributor
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_pricing_tier() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_discount_percentage() TO authenticated;
GRANT EXECUTE ON FUNCTION is_distributor() TO authenticated;
