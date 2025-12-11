-- Fix RLS Policies with Correct Syntax
-- Remove role specifications which are causing issues in Supabase

-- ============================================
-- 1. DROP EXISTING POLICIES
-- ============================================

DROP POLICY IF EXISTS "anon_insert_bim_leads" ON bim_leads;
DROP POLICY IF EXISTS "anon_insert_configurations" ON configurations;
DROP POLICY IF EXISTS "anon_insert_bim_exports" ON bim_exports;
DROP POLICY IF EXISTS "anon_insert_export_analytics" ON export_analytics;
DROP POLICY IF EXISTS "authenticated_select_bim_leads" ON bim_leads;
DROP POLICY IF EXISTS "authenticated_select_configurations" ON configurations;
DROP POLICY IF EXISTS "authenticated_select_bim_exports" ON bim_exports;
DROP POLICY IF EXISTS "authenticated_select_export_analytics" ON export_analytics;

-- ============================================
-- 2. CREATE POLICIES WITHOUT ROLE SPECIFICATION
-- ============================================

-- BIM LEADS: Allow all inserts (anonymous and authenticated)
CREATE POLICY "public_insert_bim_leads" 
ON bim_leads 
FOR INSERT 
WITH CHECK (true);

-- BIM LEADS: Allow authenticated users to view all
CREATE POLICY "authenticated_select_bim_leads"
ON bim_leads
FOR SELECT
USING (auth.role() = 'authenticated');

-- CONFIGURATIONS: Allow all inserts
CREATE POLICY "public_insert_configurations"
ON configurations
FOR INSERT
WITH CHECK (true);

-- CONFIGURATIONS: Allow authenticated users to view all
CREATE POLICY "authenticated_select_configurations"
ON configurations
FOR SELECT
USING (auth.role() = 'authenticated');

-- BIM EXPORTS: Allow all inserts
CREATE POLICY "public_insert_bim_exports"
ON bim_exports
FOR INSERT
WITH CHECK (true);

-- BIM EXPORTS: Allow authenticated users to view all
CREATE POLICY "authenticated_select_bim_exports"
ON bim_exports
FOR SELECT
USING (auth.role() = 'authenticated');

-- EXPORT ANALYTICS: Allow all inserts
CREATE POLICY "public_insert_export_analytics"
ON export_analytics
FOR INSERT
WITH CHECK (true);

-- EXPORT ANALYTICS: Allow authenticated users to view all
CREATE POLICY "authenticated_select_export_analytics"
ON export_analytics
FOR SELECT
USING (auth.role() = 'authenticated');
