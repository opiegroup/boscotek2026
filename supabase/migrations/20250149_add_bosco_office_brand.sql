-- =============================================================================
-- ADD: Bosco Office & Storage brand
-- =============================================================================

INSERT INTO public.brands (
  name,
  slug,
  code,
  status,
  theme_json,
  features_json,
  meta_title,
  meta_description
) VALUES (
  'Bosco Office & Storage',
  'bosco-office',
  'BO',
  'active',
  '{"primaryColor": "#f59e0b", "accentColor": "#292926"}',
  '{"enableBimExport": true, "enableQuoteCart": true}',
  'Bosco Office Configurator',
  'Configure Bosco Office & Storage products'
)
ON CONFLICT (slug) DO NOTHING;
