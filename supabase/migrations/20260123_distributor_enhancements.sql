-- Migration: Enhanced Distributor Features
-- Adds logo, blurb, brand access, and quote scoping for distributors

-- =====================================================
-- 1. Add new columns to distributors table
-- =====================================================

-- Profile fields
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS description TEXT; -- Company blurb
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS business_hours TEXT;

-- Contact enhancements
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS contact_mobile TEXT;

-- Categorization
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS region TEXT; -- 'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT', 'NZ'
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS category TEXT; -- 'Education', 'Audio Visual', 'Furniture', etc.

-- Financial
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(12,2);
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT 'Net 30';

-- =====================================================
-- 2. Create distributor brand access table
-- =====================================================

CREATE TABLE IF NOT EXISTS distributor_brand_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id UUID NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(distributor_id, brand_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_distributor_brand_access_distributor ON distributor_brand_access(distributor_id);
CREATE INDEX IF NOT EXISTS idx_distributor_brand_access_brand ON distributor_brand_access(brand_id);

-- RLS
ALTER TABLE distributor_brand_access ENABLE ROW LEVEL SECURITY;

-- Distributors can see their own brand access
CREATE POLICY "distributor_brand_access_own_select" ON distributor_brand_access
  FOR SELECT USING (
    distributor_id = (SELECT id FROM distributors WHERE user_id = auth.uid())
  );

-- Staff can see all
CREATE POLICY "distributor_brand_access_staff_select" ON distributor_brand_access
  FOR SELECT USING (public.is_staff());

-- Admin can manage
CREATE POLICY "distributor_brand_access_admin_insert" ON distributor_brand_access
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "distributor_brand_access_admin_update" ON distributor_brand_access
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "distributor_brand_access_admin_delete" ON distributor_brand_access
  FOR DELETE USING (public.is_admin());

-- =====================================================
-- 3. Create pricing tier product overrides table
-- =====================================================

CREATE TABLE IF NOT EXISTS pricing_tier_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_tier_id UUID NOT NULL REFERENCES pricing_tiers(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  product_id TEXT, -- Product code or family (NULL = all products)
  
  -- Override values (one of these should be set)
  discount_override DECIMAL(5,2), -- Override discount percentage
  markup_override DECIMAL(5,2), -- Or markup percentage
  fixed_price DECIMAL(12,2), -- Or fixed price
  
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(pricing_tier_id, brand_id, product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pricing_tier_overrides_tier ON pricing_tier_overrides(pricing_tier_id);
CREATE INDEX IF NOT EXISTS idx_pricing_tier_overrides_brand ON pricing_tier_overrides(brand_id);

-- RLS
ALTER TABLE pricing_tier_overrides ENABLE ROW LEVEL SECURITY;

-- Only pricing managers can view/manage
CREATE POLICY "pricing_tier_overrides_staff_select" ON pricing_tier_overrides
  FOR SELECT USING (public.can_manage_pricing());

CREATE POLICY "pricing_tier_overrides_staff_insert" ON pricing_tier_overrides
  FOR INSERT WITH CHECK (public.can_manage_pricing());

CREATE POLICY "pricing_tier_overrides_staff_update" ON pricing_tier_overrides
  FOR UPDATE USING (public.can_manage_pricing());

CREATE POLICY "pricing_tier_overrides_staff_delete" ON pricing_tier_overrides
  FOR DELETE USING (public.can_manage_pricing());

-- =====================================================
-- 4. Add distributor_id to quotes table
-- =====================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS distributor_id UUID REFERENCES distributors(id);

-- Index for filtering quotes by distributor
CREATE INDEX IF NOT EXISTS idx_quotes_distributor ON quotes(distributor_id);

-- =====================================================
-- 5. Add markup column to pricing_tiers if not exists
-- =====================================================

ALTER TABLE pricing_tiers ADD COLUMN IF NOT EXISTS markup_percentage DECIMAL(5,2) DEFAULT 8.00;
COMMENT ON COLUMN pricing_tiers.markup_percentage IS 'Markup percentage for distributor pricing (e.g., 8% = sell at cost/(1-0.08))';

-- =====================================================
-- 6. Helper functions for distributor access
-- =====================================================

-- Get distributor's brand IDs
CREATE OR REPLACE FUNCTION get_distributor_brand_ids(p_distributor_id UUID DEFAULT NULL)
RETURNS UUID[] AS $$
DECLARE
  v_distributor_id UUID;
  v_brand_ids UUID[];
BEGIN
  -- Use provided ID or get current user's distributor ID
  IF p_distributor_id IS NOT NULL THEN
    v_distributor_id := p_distributor_id;
  ELSE
    SELECT id INTO v_distributor_id
    FROM distributors
    WHERE user_id = auth.uid()
    AND is_active = true
    AND is_approved = true;
  END IF;
  
  IF v_distributor_id IS NULL THEN
    RETURN ARRAY[]::UUID[];
  END IF;
  
  SELECT ARRAY_AGG(brand_id) INTO v_brand_ids
  FROM distributor_brand_access
  WHERE distributor_id = v_distributor_id
  AND is_active = true;
  
  RETURN COALESCE(v_brand_ids, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current user's distributor ID
CREATE OR REPLACE FUNCTION get_current_distributor_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id FROM distributors
    WHERE user_id = auth.uid()
    AND is_active = true
    AND is_approved = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get distributor pricing for a product
CREATE OR REPLACE FUNCTION get_distributor_price(
  p_base_price DECIMAL,
  p_distributor_id UUID DEFAULT NULL,
  p_brand_id UUID DEFAULT NULL,
  p_product_id TEXT DEFAULT NULL
)
RETURNS DECIMAL AS $$
DECLARE
  v_distributor_id UUID;
  v_tier_id UUID;
  v_discount DECIMAL;
  v_markup DECIMAL;
  v_override_discount DECIMAL;
  v_override_markup DECIMAL;
  v_fixed_price DECIMAL;
BEGIN
  -- Get distributor ID
  IF p_distributor_id IS NOT NULL THEN
    v_distributor_id := p_distributor_id;
  ELSE
    v_distributor_id := get_current_distributor_id();
  END IF;
  
  -- Not a distributor? Return base price
  IF v_distributor_id IS NULL THEN
    RETURN p_base_price;
  END IF;
  
  -- Get distributor's pricing tier
  SELECT pricing_tier_id INTO v_tier_id
  FROM distributors
  WHERE id = v_distributor_id;
  
  IF v_tier_id IS NULL THEN
    RETURN p_base_price;
  END IF;
  
  -- Get tier's default discount/markup
  SELECT discount_percentage, markup_percentage
  INTO v_discount, v_markup
  FROM pricing_tiers
  WHERE id = v_tier_id AND is_active = true;
  
  -- Check for product/brand specific override
  SELECT discount_override, markup_override, fixed_price
  INTO v_override_discount, v_override_markup, v_fixed_price
  FROM pricing_tier_overrides
  WHERE pricing_tier_id = v_tier_id
  AND is_active = true
  AND (brand_id IS NULL OR brand_id = p_brand_id)
  AND (product_id IS NULL OR product_id = p_product_id)
  ORDER BY 
    CASE WHEN product_id IS NOT NULL AND brand_id IS NOT NULL THEN 1
         WHEN product_id IS NOT NULL THEN 2
         WHEN brand_id IS NOT NULL THEN 3
         ELSE 4 END
  LIMIT 1;
  
  -- Fixed price takes precedence
  IF v_fixed_price IS NOT NULL THEN
    RETURN v_fixed_price;
  END IF;
  
  -- Use override values if available
  IF v_override_discount IS NOT NULL THEN
    v_discount := v_override_discount;
  END IF;
  
  IF v_override_markup IS NOT NULL THEN
    v_markup := v_override_markup;
  END IF;
  
  -- Apply markup (sell price = cost / (1 - markup%))
  IF v_markup IS NOT NULL AND v_markup > 0 THEN
    RETURN ROUND(p_base_price / (1 - (v_markup / 100)), 2);
  END IF;
  
  -- Apply discount (sell price = base * (1 - discount%))
  IF v_discount IS NOT NULL AND v_discount > 0 THEN
    RETURN ROUND(p_base_price * (1 - (v_discount / 100)), 2);
  END IF;
  
  RETURN p_base_price;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_distributor_brand_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_distributor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_distributor_price(DECIMAL, UUID, UUID, TEXT) TO authenticated;

-- =====================================================
-- 7. Update quotes RLS to scope by distributor
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "quotes_distributor_select" ON quotes;
DROP POLICY IF EXISTS "quotes_distributor_insert" ON quotes;
DROP POLICY IF EXISTS "quotes_distributor_update" ON quotes;

-- Distributors can only see their own quotes
CREATE POLICY "quotes_distributor_select" ON quotes
  FOR SELECT USING (
    -- Staff can see all
    public.is_staff()
    OR
    -- Distributor can see their own
    (
      distributor_id IS NOT NULL 
      AND distributor_id = get_current_distributor_id()
    )
    OR
    -- Non-distributor quotes visible to all authenticated (legacy behavior)
    (
      distributor_id IS NULL
    )
  );

-- Distributors can insert quotes for themselves
CREATE POLICY "quotes_distributor_insert" ON quotes
  FOR INSERT WITH CHECK (
    public.is_staff()
    OR
    (
      get_current_distributor_id() IS NOT NULL
    )
  );

-- Distributors can update their own draft quotes
CREATE POLICY "quotes_distributor_update" ON quotes
  FOR UPDATE USING (
    public.is_staff()
    OR
    (
      distributor_id = get_current_distributor_id()
      AND status = 'draft'
    )
  );

-- =====================================================
-- 8. Storage bucket for distributor logos
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'distributor-logos',
  'distributor-logos',
  true,
  2097152, -- 2MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];

-- Storage policies for distributor logos
DROP POLICY IF EXISTS "distributor_logos_select" ON storage.objects;
DROP POLICY IF EXISTS "distributor_logos_insert" ON storage.objects;
DROP POLICY IF EXISTS "distributor_logos_update" ON storage.objects;
DROP POLICY IF EXISTS "distributor_logos_delete" ON storage.objects;

-- Anyone can view logos (public bucket)
CREATE POLICY "distributor_logos_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'distributor-logos');

-- Distributors can upload their own logo, admins can upload any
CREATE POLICY "distributor_logos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'distributor-logos'
    AND (
      public.is_admin()
      OR
      -- Distributor can upload to their own folder
      (storage.foldername(name))[1] = get_current_distributor_id()::text
    )
  );

-- Distributors can update their own logo
CREATE POLICY "distributor_logos_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'distributor-logos'
    AND (
      public.is_admin()
      OR
      (storage.foldername(name))[1] = get_current_distributor_id()::text
    )
  );

-- Distributors can delete their own logo
CREATE POLICY "distributor_logos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'distributor-logos'
    AND (
      public.is_admin()
      OR
      (storage.foldername(name))[1] = get_current_distributor_id()::text
    )
  );
