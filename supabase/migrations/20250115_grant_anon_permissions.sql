-- Grant INSERT permissions to anon and authenticated roles
-- RLS policies only work AFTER permissions are granted

-- ============================================
-- 1. GRANT TABLE PERMISSIONS
-- ============================================

-- Grant INSERT permission to anon role for all export tables
GRANT INSERT ON TABLE bim_leads TO anon;
GRANT INSERT ON TABLE configurations TO anon;
GRANT INSERT ON TABLE bim_exports TO anon;
GRANT INSERT ON TABLE export_analytics TO anon;

-- Grant INSERT permission to authenticated role as well
GRANT INSERT ON TABLE bim_leads TO authenticated;
GRANT INSERT ON TABLE configurations TO authenticated;
GRANT INSERT ON TABLE bim_exports TO authenticated;
GRANT INSERT ON TABLE export_analytics TO authenticated;

-- Grant SELECT permission to authenticated role for admin dashboard
GRANT SELECT ON TABLE bim_leads TO authenticated;
GRANT SELECT ON TABLE configurations TO authenticated;
GRANT SELECT ON TABLE bim_exports TO authenticated;
GRANT SELECT ON TABLE export_analytics TO authenticated;

-- ============================================
-- 2. GRANT SEQUENCE PERMISSIONS (for UUID generation)
-- ============================================

-- Allow anon role to use sequences if needed
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- 3. VERIFY RLS POLICIES ARE STILL IN PLACE
-- ============================================

-- Just to be safe, recreate the INSERT policies
DROP POLICY IF EXISTS "public_insert_bim_leads" ON bim_leads;
DROP POLICY IF EXISTS "public_insert_configurations" ON configurations;
DROP POLICY IF EXISTS "public_insert_bim_exports" ON bim_exports;
DROP POLICY IF EXISTS "public_insert_export_analytics" ON export_analytics;

CREATE POLICY "public_insert_bim_leads" 
ON bim_leads 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "public_insert_configurations"
ON configurations
FOR INSERT
WITH CHECK (true);

CREATE POLICY "public_insert_bim_exports"
ON bim_exports
FOR INSERT
WITH CHECK (true);

CREATE POLICY "public_insert_export_analytics"
ON export_analytics
FOR INSERT
WITH CHECK (true);
