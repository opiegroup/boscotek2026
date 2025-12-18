-- Migration: Update Pricing Tiers to Match Business Structure + Add Currency Support

-- First, clear existing tiers and replace with actual business tiers
DELETE FROM pricing_tiers;

-- Insert actual Boscotek/Opie pricing tiers
INSERT INTO pricing_tiers (name, code, discount_percentage, description, sort_order, is_active) VALUES
  ('Wholesale', 'WHOLESALE', 0, 'Base wholesale pricing - no discount', 1, true),
  ('Distributor', 'DISTRIBUTOR', 8.0, 'Standard distributor pricing', 2, true),
  ('Export', 'EXPORT', 10.0, 'Export/international customers', 3, true),
  ('Retail', 'RETAIL', 15.0, 'Retail customer pricing', 4, true),
  ('Govt/Tertiary', 'GOVT', 20.0, 'Government and educational institutions', 5, true),
  ('Cash Sale', 'CASH', 25.0, 'Cash sale / walk-in pricing', 6, true);

-- Create currency table for exchange rates
CREATE TABLE IF NOT EXISTS currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,           -- ISO 4217 code: AUD, USD, EUR, etc.
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,                -- $, €, ¥, etc.
  exchange_rate NUMERIC(10,6) NOT NULL DEFAULT 1.0,  -- Rate relative to AUD (base)
  is_base BOOLEAN DEFAULT false,       -- AUD is base currency
  is_active BOOLEAN DEFAULT true,
  decimal_places INTEGER DEFAULT 2,
  sort_order INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_currencies_code ON currencies(code);
CREATE INDEX IF NOT EXISTS idx_currencies_active ON currencies(is_active) WHERE is_active = true;

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_currencies_updated_at ON currencies;
CREATE TRIGGER update_currencies_updated_at
  BEFORE UPDATE ON currencies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS - currencies readable by all, writable by pricing managers
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "currencies_public_read" ON currencies;
CREATE POLICY "currencies_public_read" ON currencies
  FOR SELECT USING (true);  -- Everyone can read currencies

DROP POLICY IF EXISTS "currencies_staff_write" ON currencies;
CREATE POLICY "currencies_staff_write" ON currencies
  FOR ALL USING (can_manage_pricing());

-- Insert supported currencies with approximate exchange rates
-- Note: These should be updated regularly via API or admin
INSERT INTO currencies (code, name, symbol, exchange_rate, is_base, sort_order) VALUES
  ('AUD', 'Australian Dollar', '$', 1.000000, true, 1),
  ('USD', 'US Dollar', 'US$', 0.650000, false, 2),
  ('EUR', 'Euro', '€', 0.600000, false, 3),
  ('GBP', 'British Pound', '£', 0.520000, false, 4),
  ('NZD', 'New Zealand Dollar', 'NZ$', 1.100000, false, 5),
  ('CAD', 'Canadian Dollar', 'CA$', 0.880000, false, 6),
  ('CNY', 'Chinese Yuan', '¥', 4.700000, false, 7),
  ('JPY', 'Japanese Yen', '¥', 97.000000, false, 8),
  ('SGD', 'Singapore Dollar', 'S$', 0.870000, false, 9);

-- Add currency preference to distributors
ALTER TABLE distributors 
ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'AUD' REFERENCES currencies(code);

-- Helper function to convert price from AUD to another currency
CREATE OR REPLACE FUNCTION convert_currency(
  p_amount NUMERIC,
  p_from_currency TEXT DEFAULT 'AUD',
  p_to_currency TEXT DEFAULT 'AUD'
)
RETURNS NUMERIC AS $$
DECLARE
  v_from_rate NUMERIC;
  v_to_rate NUMERIC;
  v_result NUMERIC;
BEGIN
  IF p_from_currency = p_to_currency THEN
    RETURN p_amount;
  END IF;
  
  -- Get exchange rates
  SELECT exchange_rate INTO v_from_rate
  FROM currencies WHERE code = p_from_currency AND is_active = true;
  
  SELECT exchange_rate INTO v_to_rate
  FROM currencies WHERE code = p_to_currency AND is_active = true;
  
  IF v_from_rate IS NULL OR v_to_rate IS NULL THEN
    RETURN p_amount; -- Return original if currency not found
  END IF;
  
  -- Convert: amount / from_rate * to_rate
  -- Since rates are relative to AUD:
  -- To convert AUD to USD: amount * USD_rate
  -- To convert USD to AUD: amount / USD_rate
  IF p_from_currency = 'AUD' THEN
    v_result := p_amount * v_to_rate;
  ELSIF p_to_currency = 'AUD' THEN
    v_result := p_amount / v_from_rate;
  ELSE
    -- Convert via AUD as intermediary
    v_result := (p_amount / v_from_rate) * v_to_rate;
  END IF;
  
  RETURN ROUND(v_result, 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute
GRANT EXECUTE ON FUNCTION convert_currency(NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION convert_currency(NUMERIC, TEXT, TEXT) TO anon;

-- View for pricing summary with currency options
CREATE OR REPLACE VIEW pricing_tier_summary AS
SELECT 
  pt.id,
  pt.name,
  pt.code,
  pt.discount_percentage,
  pt.description,
  pt.is_active,
  COUNT(d.id) as distributor_count
FROM pricing_tiers pt
LEFT JOIN distributors d ON d.pricing_tier_id = pt.id AND d.is_active = true
GROUP BY pt.id, pt.name, pt.code, pt.discount_percentage, pt.description, pt.is_active
ORDER BY pt.sort_order;

GRANT SELECT ON pricing_tier_summary TO authenticated;
