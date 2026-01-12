-- =============================================================================
-- MULTI-BRAND ARCHITECTURE
-- Foundation migration for brand isolation across the platform
-- =============================================================================

-- =============================================================================
-- PART 0: CREATE ENUM TYPE FIRST
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'brand_access_level') THEN
    CREATE TYPE brand_access_level AS ENUM ('viewer', 'sales', 'pricing', 'admin');
  END IF;
END $$;

-- =============================================================================
-- PART 1: BRANDS TABLE
-- Core entity for brand scoping - all major entities will reference this
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  name TEXT NOT NULL,                    -- "Boscotek"
  slug TEXT NOT NULL UNIQUE,             -- "boscotek" (used in URLs)
  code TEXT UNIQUE,                      -- "BT" (short code for references)
  
  -- Domain configuration
  primary_domain TEXT,                   -- "configurator.boscotek.com.au"
  allowed_domains TEXT[] DEFAULT '{}',   -- Additional domains that resolve to this brand
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'disabled')),
  
  -- Branding/Theme
  theme_json JSONB DEFAULT '{}'::JSONB,  -- logo, colors, typography tokens
  -- Example: {"logo": "/brands/boscotek/logo.svg", "primaryColor": "#f59e0b", "accentColor": "#292926"}
  
  -- Feature flags (brand-specific capabilities)
  features_json JSONB DEFAULT '{}'::JSONB,
  -- Example: {"enableBimExport": true, "enableQuoteCart": true, "enableDistributorPricing": true}
  
  -- Contact/Business info
  contact_email TEXT,
  support_email TEXT,
  phone TEXT,
  address_json JSONB,                    -- {street, city, state, postcode, country}
  
  -- SEO/Meta
  meta_title TEXT,
  meta_description TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for brand lookup
CREATE INDEX IF NOT EXISTS idx_brands_slug ON public.brands(slug);
CREATE INDEX IF NOT EXISTS idx_brands_status ON public.brands(status);
CREATE INDEX IF NOT EXISTS idx_brands_primary_domain ON public.brands(primary_domain);

-- Trigger to update updated_at
CREATE TRIGGER brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- PART 2: USER BRAND ACCESS
-- Controls which users can access which brands and at what level
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_brand_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  
  -- Access level
  access_level brand_access_level NOT NULL DEFAULT 'viewer',
  
  -- Optional granular scopes (JSON array of permission strings)
  scopes JSONB DEFAULT '[]'::JSONB,
  -- Example: ["catalogue_edit", "pricing_edit", "ruleset_publish", "user_management"]
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique user-brand combination
  UNIQUE(user_id, brand_id)
);

-- Indexes for permission lookups
CREATE INDEX IF NOT EXISTS idx_user_brand_access_user ON public.user_brand_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_brand_access_brand ON public.user_brand_access(brand_id);
CREATE INDEX IF NOT EXISTS idx_user_brand_access_active ON public.user_brand_access(user_id, is_active) WHERE is_active = true;

-- =============================================================================
-- PART 3: SEED OPIE GROUP BRANDS
-- =============================================================================

INSERT INTO public.brands (name, slug, code, status, theme_json, features_json) VALUES
  (
    'Boscotek',
    'boscotek',
    'BT',
    'active',
    '{"logo": "/brands/boscotek/logo.svg", "primaryColor": "#f59e0b", "accentColor": "#292926", "fontFamily": "Inter"}'::JSONB,
    '{"enableBimExport": true, "enableQuoteCart": true, "enableDistributorPricing": true, "enableDrawerConfigurator": true}'::JSONB
  ),
  (
    'Bosco Office & Storage',
    'bosco-office',
    'BO',
    'draft',
    '{"logo": "/brands/bosco-office/logo.svg", "primaryColor": "#3b82f6", "accentColor": "#1e3a5f"}'::JSONB,
    '{"enableBimExport": false, "enableQuoteCart": true, "enableDistributorPricing": true}'::JSONB
  ),
  (
    'Lectrum',
    'lectrum',
    'LT',
    'draft',
    '{"logo": "/brands/lectrum/logo.svg", "primaryColor": "#10b981", "accentColor": "#064e3b"}'::JSONB,
    '{"enableBimExport": true, "enableQuoteCart": true}'::JSONB
  ),
  (
    'Gilkon',
    'gilkon',
    'GK',
    'draft',
    '{"logo": "/brands/gilkon/logo.svg", "primaryColor": "#ef4444", "accentColor": "#7f1d1d"}'::JSONB,
    '{"enableBimExport": false, "enableQuoteCart": true}'::JSONB
  ),
  (
    'Argent',
    'argent',
    'AG',
    'draft',
    '{"logo": "/brands/argent/logo.svg", "primaryColor": "#6366f1", "accentColor": "#3730a3"}'::JSONB,
    '{"enableBimExport": false, "enableQuoteCart": true}'::JSONB
  ),
  (
    'SMC Stainless',
    'smc-stainless',
    'SMC',
    'draft',
    '{"logo": "/brands/smc/logo.svg", "primaryColor": "#71717a", "accentColor": "#27272a"}'::JSONB,
    '{"enableBimExport": false, "enableQuoteCart": true}'::JSONB
  ),
  (
    'Bonwick & Co',
    'bonwick',
    'BW',
    'draft',
    '{"logo": "/brands/bonwick/logo.svg", "primaryColor": "#854d0e", "accentColor": "#422006"}'::JSONB,
    '{"enableBimExport": false, "enableQuoteCart": true}'::JSONB
  ),
  (
    'Opie Infrastructure',
    'opie-infrastructure',
    'OI',
    'draft',
    '{"logo": "/brands/opie/logo.svg", "primaryColor": "#0891b2", "accentColor": "#164e63"}'::JSONB,
    '{"enableBimExport": false, "enableQuoteCart": true}'::JSONB
  )
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- PART 4: ADD brand_id TO CORE TABLES
-- =============================================================================

-- Add brand_id to products (nullable initially for migration)
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id);

-- Add brand_id to quotes
ALTER TABLE public.quotes 
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id);

-- Add brand_id to configurations
ALTER TABLE public.configurations 
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id);

-- Add brand_id to bim_leads
ALTER TABLE public.bim_leads 
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id);

-- Add brand_id to bim_exports
ALTER TABLE public.bim_exports 
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id);

-- Add brand_id to drawer_interiors
ALTER TABLE public.drawer_interiors 
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id);

-- Add brand_id to pricing_tiers
ALTER TABLE public.pricing_tiers 
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id);

-- Add brand_id to distributors
ALTER TABLE public.distributors 
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id);

-- Add brand_id to companies
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id);

-- Add brand_id to audit_logs
ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id);

-- Add brand_id to pricing_logs
ALTER TABLE public.pricing_logs 
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id);

-- Add brand_id to notifications
ALTER TABLE public.notifications 
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id);

-- Add brand_id to export_analytics
ALTER TABLE public.export_analytics 
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id);

-- =============================================================================
-- PART 5: SET DEFAULT BRAND FOR EXISTING DATA
-- Assign all existing data to Boscotek brand
-- =============================================================================

DO $$
DECLARE
  boscotek_id UUID;
BEGIN
  SELECT id INTO boscotek_id FROM public.brands WHERE slug = 'boscotek';
  
  IF boscotek_id IS NOT NULL THEN
    -- Update existing records to belong to Boscotek
    UPDATE public.products SET brand_id = boscotek_id WHERE brand_id IS NULL;
    UPDATE public.quotes SET brand_id = boscotek_id WHERE brand_id IS NULL;
    UPDATE public.configurations SET brand_id = boscotek_id WHERE brand_id IS NULL;
    UPDATE public.bim_leads SET brand_id = boscotek_id WHERE brand_id IS NULL;
    UPDATE public.bim_exports SET brand_id = boscotek_id WHERE brand_id IS NULL;
    UPDATE public.drawer_interiors SET brand_id = boscotek_id WHERE brand_id IS NULL;
    UPDATE public.pricing_tiers SET brand_id = boscotek_id WHERE brand_id IS NULL;
    UPDATE public.distributors SET brand_id = boscotek_id WHERE brand_id IS NULL;
    UPDATE public.companies SET brand_id = boscotek_id WHERE brand_id IS NULL;
    UPDATE public.audit_logs SET brand_id = boscotek_id WHERE brand_id IS NULL;
    UPDATE public.pricing_logs SET brand_id = boscotek_id WHERE brand_id IS NULL;
    UPDATE public.notifications SET brand_id = boscotek_id WHERE brand_id IS NULL;
    UPDATE public.export_analytics SET brand_id = boscotek_id WHERE brand_id IS NULL;
  END IF;
END $$;

-- =============================================================================
-- PART 6: CREATE INDEXES FOR brand_id COLUMNS
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand_id);
CREATE INDEX IF NOT EXISTS idx_quotes_brand ON public.quotes(brand_id);
CREATE INDEX IF NOT EXISTS idx_configurations_brand ON public.configurations(brand_id);
CREATE INDEX IF NOT EXISTS idx_bim_leads_brand ON public.bim_leads(brand_id);
CREATE INDEX IF NOT EXISTS idx_bim_exports_brand ON public.bim_exports(brand_id);
CREATE INDEX IF NOT EXISTS idx_drawer_interiors_brand ON public.drawer_interiors(brand_id);
CREATE INDEX IF NOT EXISTS idx_pricing_tiers_brand ON public.pricing_tiers(brand_id);
CREATE INDEX IF NOT EXISTS idx_distributors_brand ON public.distributors(brand_id);
CREATE INDEX IF NOT EXISTS idx_companies_brand ON public.companies(brand_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_brand ON public.audit_logs(brand_id);
CREATE INDEX IF NOT EXISTS idx_pricing_logs_brand ON public.pricing_logs(brand_id);
CREATE INDEX IF NOT EXISTS idx_notifications_brand ON public.notifications(brand_id);
CREATE INDEX IF NOT EXISTS idx_export_analytics_brand ON public.export_analytics(brand_id);

-- =============================================================================
-- PART 7: RLS POLICIES FOR BRANDS
-- =============================================================================

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_brand_access ENABLE ROW LEVEL SECURITY;

-- Brands: Public can read active brands
CREATE POLICY "brands_public_read" ON public.brands
  FOR SELECT USING (status = 'active');

-- Brands: Staff can read all brands
CREATE POLICY "brands_staff_read_all" ON public.brands
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- Brands: Only admins can modify brands
CREATE POLICY "brands_admin_all" ON public.brands
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- User Brand Access: Users can see their own access
CREATE POLICY "user_brand_access_own" ON public.user_brand_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- User Brand Access: Admins can manage all
CREATE POLICY "user_brand_access_admin" ON public.user_brand_access
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================================================
-- PART 8: HELPER FUNCTIONS FOR BRAND CONTEXT
-- =============================================================================

-- Get brand by slug
CREATE OR REPLACE FUNCTION public.get_brand_by_slug(p_slug TEXT)
RETURNS public.brands AS $$
  SELECT * FROM public.brands WHERE slug = p_slug AND status = 'active' LIMIT 1;
$$ LANGUAGE SQL STABLE SET search_path = '';

-- Get brand by domain
CREATE OR REPLACE FUNCTION public.get_brand_by_domain(p_domain TEXT)
RETURNS public.brands AS $$
  SELECT * FROM public.brands 
  WHERE (primary_domain = p_domain OR p_domain = ANY(allowed_domains))
  AND status = 'active'
  LIMIT 1;
$$ LANGUAGE SQL STABLE SET search_path = '';

-- Check if user has access to brand
CREATE OR REPLACE FUNCTION public.user_has_brand_access(p_brand_id UUID, p_min_level TEXT DEFAULT 'viewer')
RETURNS BOOLEAN AS $$
DECLARE
  v_access_level TEXT;
  v_level_order INT;
  v_min_order INT;
BEGIN
  -- Super admins have access to all brands
  IF public.is_admin() THEN
    RETURN true;
  END IF;
  
  -- Check user_brand_access table
  SELECT access_level::TEXT INTO v_access_level
  FROM public.user_brand_access
  WHERE user_id = auth.uid()
  AND brand_id = p_brand_id
  AND is_active = true;
  
  IF v_access_level IS NULL THEN
    RETURN false;
  END IF;
  
  -- Compare access levels (viewer < sales < pricing < admin)
  v_level_order := CASE v_access_level 
    WHEN 'viewer' THEN 1 
    WHEN 'sales' THEN 2 
    WHEN 'pricing' THEN 3 
    WHEN 'admin' THEN 4 
  END;
  
  v_min_order := CASE p_min_level 
    WHEN 'viewer' THEN 1 
    WHEN 'sales' THEN 2 
    WHEN 'pricing' THEN 3 
    WHEN 'admin' THEN 4 
  END;
  
  RETURN v_level_order >= v_min_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Get user's accessible brands
CREATE OR REPLACE FUNCTION public.get_user_brands()
RETURNS SETOF public.brands AS $$
BEGIN
  -- Super admins see all active brands
  IF public.is_admin() THEN
    RETURN QUERY SELECT * FROM public.brands WHERE status = 'active' ORDER BY name;
  END IF;
  
  -- Others see only brands they have access to
  RETURN QUERY
  SELECT b.* FROM public.brands b
  JOIN public.user_brand_access uba ON uba.brand_id = b.id
  WHERE uba.user_id = auth.uid()
  AND uba.is_active = true
  AND b.status = 'active'
  ORDER BY b.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Get user's brand access level
CREATE OR REPLACE FUNCTION public.get_user_brand_access_level(p_brand_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_level TEXT;
BEGIN
  -- Super admins have admin access to all
  IF public.is_admin() THEN
    RETURN 'admin';
  END IF;
  
  SELECT access_level::TEXT INTO v_level
  FROM public.user_brand_access
  WHERE user_id = auth.uid()
  AND brand_id = p_brand_id
  AND is_active = true;
  
  RETURN COALESCE(v_level, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =============================================================================
-- PART 9: GRANT PERMISSIONS
-- =============================================================================

GRANT SELECT ON public.brands TO anon;
GRANT SELECT ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;

GRANT SELECT ON public.user_brand_access TO authenticated;
GRANT ALL ON public.user_brand_access TO service_role;

GRANT EXECUTE ON FUNCTION public.get_brand_by_slug(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_brand_by_slug(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_brand_by_domain(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_brand_by_domain(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_brand_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_brands() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_brand_access_level(UUID) TO authenticated;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE public.brands IS 'Brand entities for multi-brand platform. Every major entity is scoped to a brand.';
COMMENT ON TABLE public.user_brand_access IS 'Controls which users can access which brands and at what permission level.';
COMMENT ON COLUMN public.brands.slug IS 'URL-safe identifier used in routes and hostnames';
COMMENT ON COLUMN public.brands.theme_json IS 'Brand-specific theming: logo, colors, typography';
COMMENT ON COLUMN public.brands.features_json IS 'Feature flags specific to this brand';
COMMENT ON COLUMN public.user_brand_access.scopes IS 'Optional granular permissions within the access level';
