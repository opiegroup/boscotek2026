-- Migration: BIM Export System
-- Creates tables for lead capture, BIM exports, and configuration persistence

-- ============================================
-- 1. BIM LEADS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS bim_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  role TEXT CHECK (role IN ('Architect', 'Builder', 'Designer', 'Engineer', 'Buyer', 'Other')),
  project_name TEXT,
  project_location TEXT,
  config_id UUID,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  consent BOOLEAN DEFAULT FALSE,
  session_id TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_bim_leads_email ON bim_leads(email);
CREATE INDEX IF NOT EXISTS idx_bim_leads_company ON bim_leads(company);
CREATE INDEX IF NOT EXISTS idx_bim_leads_timestamp ON bim_leads(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bim_leads_config_id ON bim_leads(config_id);

-- ============================================
-- 2. CONFIGURATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_type TEXT NOT NULL,
  dimensions_json JSONB NOT NULL,
  drawer_stack_json JSONB,
  partition_data_json JSONB,
  accessories_json JSONB,
  colour_options_json JSONB,
  price_json JSONB,
  full_config_json JSONB NOT NULL,
  reference_code TEXT,
  geometry_hash TEXT,
  lead_id UUID REFERENCES bim_leads(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_configurations_product_type ON configurations(product_type);
CREATE INDEX IF NOT EXISTS idx_configurations_lead_id ON configurations(lead_id);
CREATE INDEX IF NOT EXISTS idx_configurations_reference_code ON configurations(reference_code);
CREATE INDEX IF NOT EXISTS idx_configurations_timestamp ON configurations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_configurations_geometry_hash ON configurations(geometry_hash);

-- ============================================
-- 3. BIM EXPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS bim_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES bim_leads(id) ON DELETE CASCADE,
  config_id UUID REFERENCES configurations(id) ON DELETE CASCADE,
  ifc_url TEXT,
  data_export_url TEXT,
  csv_export_url TEXT,
  xlsx_export_url TEXT,
  json_export_url TEXT,
  spec_pack_url TEXT,
  geometry_hash TEXT,
  export_type TEXT CHECK (export_type IN ('IFC', 'DATA', 'SPEC_PACK', 'ALL')),
  file_size_bytes BIGINT,
  generation_time_ms INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_bim_exports_lead_id ON bim_exports(lead_id);
CREATE INDEX IF NOT EXISTS idx_bim_exports_config_id ON bim_exports(config_id);
CREATE INDEX IF NOT EXISTS idx_bim_exports_timestamp ON bim_exports(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bim_exports_status ON bim_exports(status);
CREATE INDEX IF NOT EXISTS idx_bim_exports_export_type ON bim_exports(export_type);

-- ============================================
-- 4. EXPORT ANALYTICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS export_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  lead_id UUID REFERENCES bim_leads(id),
  config_id UUID REFERENCES configurations(id),
  product_type TEXT,
  export_format TEXT,
  user_agent TEXT,
  ip_address INET,
  session_id TEXT,
  metadata JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_export_analytics_event_type ON export_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_export_analytics_timestamp ON export_analytics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_export_analytics_product_type ON export_analytics(product_type);

-- ============================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE bim_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bim_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_analytics ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (admins)
CREATE POLICY "Admins can view all leads" ON bim_leads
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can view all configurations" ON configurations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can view all exports" ON bim_exports
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can view all analytics" ON export_analytics
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policies for anonymous users (public configurator)
CREATE POLICY "Anyone can create leads" ON bim_leads
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can create configurations" ON configurations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can create exports" ON bim_exports
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can create analytics" ON export_analytics
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 6. TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bim_leads_updated_at BEFORE UPDATE ON bim_leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_configurations_updated_at BEFORE UPDATE ON configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bim_exports_updated_at BEFORE UPDATE ON bim_exports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. STORAGE BUCKET FOR BIM FILES
-- ============================================

-- Create storage bucket for BIM exports (run this via Supabase dashboard or with proper permissions)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('bim-exports', 'bim-exports', false);

-- Storage policies
-- CREATE POLICY "Authenticated users can upload BIM files"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'bim-exports' AND auth.role() = 'authenticated');

-- CREATE POLICY "Anyone can download BIM files with signed URL"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'bim-exports');
