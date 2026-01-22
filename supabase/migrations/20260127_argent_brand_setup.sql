-- =============================================================================
-- ARGENT BRAND SETUP
-- =============================================================================
-- Adds Argent-specific tables for series management, dimension matrices,
-- and commercial rules (quote vs buy-online logic).
--
-- Brand: Argent
-- Brand Slug: argent
-- Brand Code: AR
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Insert/Update Argent brand if not exists
-- -----------------------------------------------------------------------------
INSERT INTO public.brands (
  id,
  name,
  slug,
  code,
  primary_domain,
  allowed_domains,
  status,
  theme_json,
  features_json,
  logo_url,
  contact_email,
  sales_email,
  support_email,
  phone,
  meta_title,
  meta_description
) VALUES (
  gen_random_uuid(),
  'Argent',
  'argent',
  'AR',
  'configurator.argent.com.au',
  ARRAY[]::text[],
  'active',
  jsonb_build_object(
    'primaryColor', '#3b82f6',
    'accentColor', '#0f172a',
    'fontFamily', 'Inter'
  ),
  jsonb_build_object(
    'enableBimExport', true,
    'enableQuoteCart', true,
    'enableDistributorPricing', true,
    'enableSecurityClassification', true,
    'enableQuoteOnlyMode', true
  ),
  '/argent-logo.png',
  'sales@argent.com.au',
  'sales@argent.com.au',
  'support@argent.com.au',
  '(02) 9914 0900',
  'Argent Server Racks & Data Infrastructure',
  'Australian-designed secure server racks, data infrastructure enclosures, and SCEC-approved security systems for government, defence, and enterprise data centres.'
)
ON CONFLICT (slug) DO UPDATE SET
  status = 'active',
  theme_json = EXCLUDED.theme_json,
  features_json = EXCLUDED.features_json,
  meta_title = EXCLUDED.meta_title,
  meta_description = EXCLUDED.meta_description,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- 2. Argent Series Table
-- -----------------------------------------------------------------------------
-- Defines each major product family within Argent
CREATE TABLE IF NOT EXISTS public.argent_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  key text NOT NULL,  -- '10', '25', '40', '50', 'v50'
  name text NOT NULL,
  short_name text NOT NULL,
  type text NOT NULL CHECK (type IN ('enclosure', 'open_frame', 'security_enclosure', 'in_rack_security')),
  description text,
  security_grade text CHECK (security_grade IN ('commercial', 'class_b', 'class_c')),
  requires_consult_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  features jsonb DEFAULT '[]'::jsonb,
  use_case text,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE (brand_id, key)
);

-- Create index for brand lookups
CREATE INDEX IF NOT EXISTS idx_argent_series_brand ON public.argent_series(brand_id);

-- -----------------------------------------------------------------------------
-- 3. Argent Dimension Matrix Table
-- -----------------------------------------------------------------------------
-- Defines valid physical configurations for each series
CREATE TABLE IF NOT EXISTS public.argent_dimension_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.argent_series(id) ON DELETE CASCADE,
  ru_height int NOT NULL,
  width_mm int NOT NULL,
  depth_mm int NOT NULL,
  is_standard boolean DEFAULT true,
  is_custom_allowed boolean DEFAULT false,
  part_code text NOT NULL,
  base_price numeric(10,2) NOT NULL,
  security_class text CHECK (security_class IN ('class_b', 'class_c')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE (series_id, ru_height, width_mm, depth_mm, security_class)
);

-- Create indexes for dimension lookups
CREATE INDEX IF NOT EXISTS idx_argent_dimensions_series ON public.argent_dimension_matrix(series_id);
CREATE INDEX IF NOT EXISTS idx_argent_dimensions_lookup ON public.argent_dimension_matrix(series_id, ru_height, width_mm, depth_mm);

-- -----------------------------------------------------------------------------
-- 4. Argent Commercial Rules Table
-- -----------------------------------------------------------------------------
-- Stores rules that determine buy-online vs quote-required vs consult-required
CREATE TABLE IF NOT EXISTS public.argent_commercial_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  rule_id text NOT NULL,  -- Matches the rule IDs in code
  description text,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  action text NOT NULL CHECK (action IN ('buy_online', 'quote_required', 'consult_required')),
  message text,
  priority int DEFAULT 0,  -- Higher priority rules evaluated first
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE (brand_id, rule_id)
);

CREATE INDEX IF NOT EXISTS idx_argent_rules_brand ON public.argent_commercial_rules(brand_id);

-- -----------------------------------------------------------------------------
-- 5. Argent Configuration Logs Table
-- -----------------------------------------------------------------------------
-- Tracks configurations, especially security-rated ones for compliance
CREATE TABLE IF NOT EXISTS public.argent_configuration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  series_key text NOT NULL,
  configuration_json jsonb NOT NULL,
  reference_code text,
  security_class text,
  commercial_action text,
  lead_id uuid REFERENCES public.bim_leads(id),
  quote_id uuid REFERENCES public.quotes(id),
  ip_address text,
  user_agent text,
  session_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_argent_config_logs_brand ON public.argent_configuration_logs(brand_id);
CREATE INDEX IF NOT EXISTS idx_argent_config_logs_series ON public.argent_configuration_logs(series_key);
CREATE INDEX IF NOT EXISTS idx_argent_config_logs_security ON public.argent_configuration_logs(security_class) WHERE security_class IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 6. Enable RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.argent_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.argent_dimension_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.argent_commercial_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.argent_configuration_logs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 7. RLS Policies
-- -----------------------------------------------------------------------------

-- argent_series: Public read, admin write
CREATE POLICY "argent_series_public_read" ON public.argent_series
  FOR SELECT USING (is_active = true);

CREATE POLICY "argent_series_admin_all" ON public.argent_series
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_brand_access uba
      WHERE uba.user_id = auth.uid()
        AND uba.brand_id = argent_series.brand_id
        AND uba.access_level = 'admin'
        AND uba.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_super_admin = true
    )
  );

-- argent_dimension_matrix: Public read, admin write
CREATE POLICY "argent_dimensions_public_read" ON public.argent_dimension_matrix
  FOR SELECT USING (is_active = true);

CREATE POLICY "argent_dimensions_admin_all" ON public.argent_dimension_matrix
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.argent_series s
      JOIN public.user_brand_access uba ON uba.brand_id = s.brand_id
      WHERE s.id = argent_dimension_matrix.series_id
        AND uba.user_id = auth.uid()
        AND uba.access_level = 'admin'
        AND uba.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_super_admin = true
    )
  );

-- argent_commercial_rules: Public read, admin write
CREATE POLICY "argent_rules_public_read" ON public.argent_commercial_rules
  FOR SELECT USING (is_active = true);

CREATE POLICY "argent_rules_admin_all" ON public.argent_commercial_rules
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_brand_access uba
      WHERE uba.user_id = auth.uid()
        AND uba.brand_id = argent_commercial_rules.brand_id
        AND uba.access_level = 'admin'
        AND uba.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_super_admin = true
    )
  );

-- argent_configuration_logs: Insert for anyone, read for staff
CREATE POLICY "argent_logs_public_insert" ON public.argent_configuration_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "argent_logs_staff_read" ON public.argent_configuration_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_brand_access uba
      WHERE uba.user_id = auth.uid()
        AND uba.brand_id = argent_configuration_logs.brand_id
        AND uba.access_level IN ('sales', 'pricing', 'admin')
        AND uba.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_super_admin = true
    )
  );

-- -----------------------------------------------------------------------------
-- 8. Seed Initial Series Data
-- -----------------------------------------------------------------------------
-- Insert the 5 Argent series with the correct brand_id
DO $$
DECLARE
  v_brand_id uuid;
BEGIN
  -- Get the Argent brand ID
  SELECT id INTO v_brand_id FROM public.brands WHERE slug = 'argent' LIMIT 1;
  
  IF v_brand_id IS NOT NULL THEN
    -- 10 Series - Lite Server Cabinets
    INSERT INTO public.argent_series (brand_id, key, name, short_name, type, description, security_grade, requires_consult_default, features, use_case, display_order)
    VALUES (
      v_brand_id,
      '10',
      'Argent 10 Series',
      '10 Series',
      'enclosure',
      'Lite server cabinets for commercial and light infrastructure use. Entry-level rack enclosures with essential features.',
      'commercial',
      false,
      '["19-inch mounting width", "Labelled RU front rails", "Removable lockable doors", "Removable lockable side panels", "800kg static load capacity", "Levelling feet included", "Zinc seal steel construction", "Mannex black powder-coat finish"]'::jsonb,
      'Commercial networking, small data rooms, office IT infrastructure',
      1
    )
    ON CONFLICT (brand_id, key) DO UPDATE SET
      description = EXCLUDED.description,
      features = EXCLUDED.features,
      updated_at = now();
    
    -- 25 Series - Network/Server Racks
    INSERT INTO public.argent_series (brand_id, key, name, short_name, type, description, security_grade, requires_consult_default, features, use_case, display_order)
    VALUES (
      v_brand_id,
      '25',
      'Argent 25 Series',
      '25 Series',
      'enclosure',
      'Core commercial network and server racks. Highly configurable with multiple size, door, and cable management options.',
      'commercial',
      false,
      '["19-inch EIA-310 compliant", "Multiple RU height options", "Variable width and depth", "Front and rear door options", "Comprehensive cable management", "Heavy-duty construction", "Tool-less rail adjustment", "Baying capability"]'::jsonb,
      'Enterprise data centres, network operations centres, server rooms',
      2
    )
    ON CONFLICT (brand_id, key) DO UPDATE SET
      description = EXCLUDED.description,
      features = EXCLUDED.features,
      updated_at = now();
    
    -- 40 Series - Open Frame
    INSERT INTO public.argent_series (brand_id, key, name, short_name, type, description, security_grade, requires_consult_default, features, use_case, display_order)
    VALUES (
      v_brand_id,
      '40',
      'Argent 40 Series',
      '40 Series',
      'open_frame',
      'Open frame data racks and lab racks. Two-post and four-post configurations with extensive cable management options.',
      null,
      false,
      '["2-post and 4-post options", "Open frame design", "Maximum airflow", "Easy equipment access", "Vertical cable managers", "Chimneys and slack spools", "Tool-less mounting options", "Modular expansion"]'::jsonb,
      'Data centre hot/cold aisle, lab environments, network distribution',
      3
    )
    ON CONFLICT (brand_id, key) DO UPDATE SET
      description = EXCLUDED.description,
      features = EXCLUDED.features,
      updated_at = now();
    
    -- 50 Series - Security
    INSERT INTO public.argent_series (brand_id, key, name, short_name, type, description, security_grade, requires_consult_default, features, use_case, display_order)
    VALUES (
      v_brand_id,
      '50',
      'Argent 50 Series',
      '50 Series',
      'security_enclosure',
      'SCEC-approved Security Class B and Class C server racks for defence and government applications.',
      'class_b',
      true,
      '["SCEC Class B or Class C compliant", "High-security locking systems", "Reinforced construction", "Tamper-evident seals", "Restricted key systems", "Government-approved design", "Audit trail capability", "Secure cable entry"]'::jsonb,
      'Defence, government agencies, classified data storage',
      4
    )
    ON CONFLICT (brand_id, key) DO UPDATE SET
      description = EXCLUDED.description,
      features = EXCLUDED.features,
      updated_at = now();
    
    -- V50 Data Vault - In-Rack Security
    INSERT INTO public.argent_series (brand_id, key, name, short_name, type, description, security_grade, requires_consult_default, features, use_case, display_order)
    VALUES (
      v_brand_id,
      'v50',
      'V50 Data Vault',
      'Data Vault',
      'in_rack_security',
      'Patented in-rack security enclosure. Adds secure compartments within standard 19-inch racks.',
      'commercial',
      false,
      '["Fits inside 19-inch racks", "Available in 2RU, 4RU, 6RU", "Lockable steel construction", "Quick-release mounting", "Ventilated design", "Key or combination lock options", "Standalone or add-on use", "Patent-protected design"]'::jsonb,
      'In-rack security, co-location protection, sensitive equipment isolation',
      5
    )
    ON CONFLICT (brand_id, key) DO UPDATE SET
      description = EXCLUDED.description,
      features = EXCLUDED.features,
      updated_at = now();
    
    RAISE NOTICE 'Argent series seeded successfully for brand_id: %', v_brand_id;
  ELSE
    RAISE NOTICE 'Argent brand not found, skipping series seed';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 9. Seed Commercial Rules
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_brand_id uuid;
BEGIN
  SELECT id INTO v_brand_id FROM public.brands WHERE slug = 'argent' LIMIT 1;
  
  IF v_brand_id IS NOT NULL THEN
    -- Class C always requires consultation
    INSERT INTO public.argent_commercial_rules (brand_id, rule_id, description, conditions, action, message, priority)
    VALUES (
      v_brand_id,
      'rule-security-class-c',
      'Class C security configurations always require consultation',
      '{"securityClass": ["class_c"]}'::jsonb,
      'consult_required',
      'SCEC Class C configurations require confirmation. Our team will contact you to verify requirements.',
      100
    )
    ON CONFLICT (brand_id, rule_id) DO NOTHING;
    
    -- Class B requires quote
    INSERT INTO public.argent_commercial_rules (brand_id, rule_id, description, conditions, action, message, priority)
    VALUES (
      v_brand_id,
      'rule-security-class-b',
      'Class B security configurations require a quote',
      '{"securityClass": ["class_b"]}'::jsonb,
      'quote_required',
      'Security-rated configurations are quote-only. Pricing shown is indicative.',
      90
    )
    ON CONFLICT (brand_id, rule_id) DO NOTHING;
    
    -- 50 Series default quote
    INSERT INTO public.argent_commercial_rules (brand_id, rule_id, description, conditions, action, message, priority)
    VALUES (
      v_brand_id,
      'rule-50-series',
      'All 50 Series configurations require consultation by default',
      '{"series": ["50"]}'::jsonb,
      'quote_required',
      'This configuration may require confirmation for compliance verification.',
      80
    )
    ON CONFLICT (brand_id, rule_id) DO NOTHING;
    
    -- Custom size consultation
    INSERT INTO public.argent_commercial_rules (brand_id, rule_id, description, conditions, action, message, priority)
    VALUES (
      v_brand_id,
      'rule-custom-size',
      'Custom sizes require consultation',
      '{"isCustomSize": true}'::jsonb,
      'consult_required',
      'Custom dimensions require consultation. Please submit an enquiry.',
      70
    )
    ON CONFLICT (brand_id, rule_id) DO NOTHING;
    
    -- Heavy accessories
    INSERT INTO public.argent_commercial_rules (brand_id, rule_id, description, conditions, action, message, priority)
    VALUES (
      v_brand_id,
      'rule-heavy-accessories',
      'Configurations with many accessories should be quoted',
      '{"accessoryThreshold": 10}'::jsonb,
      'quote_required',
      'Complex configurations with multiple accessories are best handled via quote.',
      50
    )
    ON CONFLICT (brand_id, rule_id) DO NOTHING;
    
    -- Standard commercial (lowest priority - buy online)
    INSERT INTO public.argent_commercial_rules (brand_id, rule_id, description, conditions, action, message, priority)
    VALUES (
      v_brand_id,
      'rule-standard-commercial',
      'Standard commercial configurations can be purchased online',
      '{"series": ["10", "25", "40", "v50"], "securityClass": ["commercial", null]}'::jsonb,
      'buy_online',
      null,
      10
    )
    ON CONFLICT (brand_id, rule_id) DO NOTHING;
    
    RAISE NOTICE 'Argent commercial rules seeded successfully';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 10. Grant Permissions
-- -----------------------------------------------------------------------------
GRANT SELECT ON public.argent_series TO anon, authenticated;
GRANT SELECT ON public.argent_dimension_matrix TO anon, authenticated;
GRANT SELECT ON public.argent_commercial_rules TO anon, authenticated;
GRANT INSERT ON public.argent_configuration_logs TO anon, authenticated;
GRANT SELECT ON public.argent_configuration_logs TO authenticated;

GRANT ALL ON public.argent_series TO service_role;
GRANT ALL ON public.argent_dimension_matrix TO service_role;
GRANT ALL ON public.argent_commercial_rules TO service_role;
GRANT ALL ON public.argent_configuration_logs TO service_role;

-- -----------------------------------------------------------------------------
-- Done
-- -----------------------------------------------------------------------------
COMMENT ON TABLE public.argent_series IS 'Argent product series definitions (10, 25, 40, 50, V50)';
COMMENT ON TABLE public.argent_dimension_matrix IS 'Valid dimension combinations for Argent series';
COMMENT ON TABLE public.argent_commercial_rules IS 'Rules determining buy-online vs quote-required for Argent';
COMMENT ON TABLE public.argent_configuration_logs IS 'Audit log of Argent configurations (especially security-rated)';
