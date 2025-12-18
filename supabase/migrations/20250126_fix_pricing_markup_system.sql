-- Migration: Fix Pricing System - Markups not Discounts
-- Wholesale is base, percentages are markups applied on top

-- Rename column for clarity (discount -> markup)
ALTER TABLE pricing_tiers 
RENAME COLUMN discount_percentage TO markup_percentage;

-- Add a flag to identify the public-facing tier
ALTER TABLE pricing_tiers 
ADD COLUMN IF NOT EXISTS is_public_default BOOLEAN DEFAULT false;

-- Update tiers with correct understanding
UPDATE pricing_tiers SET 
  description = 'Base wholesale pricing (internal cost)',
  is_public_default = false
WHERE code = 'WHOLESALE';

UPDATE pricing_tiers SET 
  description = 'Standard distributor markup',
  is_public_default = false
WHERE code = 'DISTRIBUTOR';

UPDATE pricing_tiers SET 
  description = 'Export/international customer markup',
  is_public_default = false
WHERE code = 'EXPORT';

UPDATE pricing_tiers SET 
  description = 'Retail customer markup',
  is_public_default = false
WHERE code = 'RETAIL';

UPDATE pricing_tiers SET 
  description = 'Government and educational institutions markup',
  is_public_default = false
WHERE code = 'GOVT';

UPDATE pricing_tiers SET 
  description = 'Public-facing price (walk-in/cash sale)',
  is_public_default = true  -- This is what public users see
WHERE code = 'CASH';

-- Update helper functions to work with markups

-- Get markup percentage for current user (returns Cash Sale markup for public)
CREATE OR REPLACE FUNCTION get_user_markup_percentage()
RETURNS NUMERIC AS $$
DECLARE
  v_markup NUMERIC;
BEGIN
  -- First check if user has a specific tier assigned via distributor account
  SELECT pt.markup_percentage INTO v_markup
  FROM distributors d
  JOIN pricing_tiers pt ON pt.id = d.pricing_tier_id
  WHERE d.user_id = auth.uid()
  AND d.is_active = true
  AND d.is_approved = true
  AND pt.is_active = true;
  
  -- If found, return that markup
  IF v_markup IS NOT NULL THEN
    RETURN v_markup;
  END IF;
  
  -- Otherwise return the public default (Cash Sale = 25%)
  SELECT markup_percentage INTO v_markup
  FROM pricing_tiers
  WHERE is_public_default = true
  AND is_active = true
  LIMIT 1;
  
  -- Fallback to 25% if no default set
  RETURN COALESCE(v_markup, 25);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute
GRANT EXECUTE ON FUNCTION get_user_markup_percentage() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_markup_percentage() TO anon;

-- Drop the old discount function
DROP FUNCTION IF EXISTS get_user_discount_percentage();

-- Update the view
DROP VIEW IF EXISTS pricing_tier_summary;
CREATE VIEW pricing_tier_summary AS
SELECT 
  pt.id,
  pt.name,
  pt.code,
  pt.markup_percentage,
  pt.description,
  pt.is_active,
  pt.is_public_default,
  COUNT(d.id) as distributor_count
FROM pricing_tiers pt
LEFT JOIN distributors d ON d.pricing_tier_id = pt.id AND d.is_active = true
GROUP BY pt.id, pt.name, pt.code, pt.markup_percentage, pt.description, pt.is_active, pt.is_public_default
ORDER BY pt.sort_order;

GRANT SELECT ON pricing_tier_summary TO authenticated;

-- Add comment explaining the system
COMMENT ON TABLE pricing_tiers IS 'Pricing tiers with markup percentages. Wholesale (0%) is base cost. Cash Sale (25%) is public price. Other tiers are for specific customer types.';
COMMENT ON COLUMN pricing_tiers.markup_percentage IS 'Percentage markup on wholesale price. 0 = wholesale, 25 = public cash sale price';
COMMENT ON COLUMN pricing_tiers.is_public_default IS 'If true, this tier is used for public (non-logged-in) users';
