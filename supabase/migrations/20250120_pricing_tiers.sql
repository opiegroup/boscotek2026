-- Migration: Pricing Tiers for Distributors
-- Creates tiered pricing structure for distributor accounts

CREATE TABLE pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- e.g. 'Tier 1', 'Gold Partner', 'Platinum'
  code TEXT UNIQUE NOT NULL,             -- e.g. 'T1', 'GOLD', 'PLAT' for internal reference
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  min_order_value NUMERIC,               -- Optional minimum order value requirement
  description TEXT,
  sort_order INTEGER DEFAULT 0,          -- For UI ordering
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_pricing_tiers_code ON pricing_tiers(code);
CREATE INDEX idx_pricing_tiers_active ON pricing_tiers(is_active) WHERE is_active = true;

-- Updated_at trigger
CREATE TRIGGER update_pricing_tiers_updated_at
  BEFORE UPDATE ON pricing_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;

-- Only pricing managers and admins can view tiers (distributors never see tier details)
CREATE POLICY "pricing_tiers_staff_select" ON pricing_tiers
  FOR SELECT USING (can_manage_pricing());

-- Only pricing managers and admins can modify tiers
CREATE POLICY "pricing_tiers_staff_insert" ON pricing_tiers
  FOR INSERT WITH CHECK (can_manage_pricing());

CREATE POLICY "pricing_tiers_staff_update" ON pricing_tiers
  FOR UPDATE USING (can_manage_pricing());

CREATE POLICY "pricing_tiers_staff_delete" ON pricing_tiers
  FOR DELETE USING (can_manage_pricing());

-- Insert default pricing tiers
INSERT INTO pricing_tiers (name, code, discount_percentage, description, sort_order) VALUES
  ('Standard', 'STD', 0, 'Standard retail pricing', 0),
  ('Bronze Partner', 'BRONZE', 10, 'Entry-level distributor tier', 1),
  ('Silver Partner', 'SILVER', 15, 'Mid-level distributor tier', 2),
  ('Gold Partner', 'GOLD', 20, 'Premium distributor tier', 3),
  ('Platinum Partner', 'PLAT', 25, 'Top-tier strategic partner', 4);
