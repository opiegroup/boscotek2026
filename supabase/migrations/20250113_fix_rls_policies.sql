-- Fix RLS Policies for Anonymous Access
-- This migration fixes the 42501 error by ensuring proper policies for anonymous users

-- ============================================
-- 1. DROP EXISTING POLICIES
-- ============================================

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Anyone can create leads" ON bim_leads;
DROP POLICY IF EXISTS "Anyone can create configurations" ON configurations;
DROP POLICY IF EXISTS "Anyone can create exports" ON bim_exports;
DROP POLICY IF EXISTS "Anyone can create analytics" ON export_analytics;
DROP POLICY IF EXISTS "Admins can view all leads" ON bim_leads;
DROP POLICY IF EXISTS "Admins can view all configurations" ON configurations;
DROP POLICY IF EXISTS "Admins can view all exports" ON bim_exports;
DROP POLICY IF EXISTS "Admins can view all analytics" ON export_analytics;

-- ============================================
-- 2. CREATE NEW PERMISSIVE POLICIES
-- ============================================

-- BIM LEADS: Allow anonymous INSERT
CREATE POLICY "anon_insert_bim_leads" 
ON bim_leads 
FOR INSERT 
TO anon, public
WITH CHECK (true);

-- BIM LEADS: Allow authenticated users to view all
CREATE POLICY "authenticated_select_bim_leads"
ON bim_leads
FOR SELECT
TO authenticated
USING (true);

-- CONFIGURATIONS: Allow anonymous INSERT
CREATE POLICY "anon_insert_configurations"
ON configurations
FOR INSERT
TO anon, public
WITH CHECK (true);

-- CONFIGURATIONS: Allow authenticated users to view all
CREATE POLICY "authenticated_select_configurations"
ON configurations
FOR SELECT
TO authenticated
USING (true);

-- BIM EXPORTS: Allow anonymous INSERT
CREATE POLICY "anon_insert_bim_exports"
ON bim_exports
FOR INSERT
TO anon, public
WITH CHECK (true);

-- BIM EXPORTS: Allow authenticated users to view all
CREATE POLICY "authenticated_select_bim_exports"
ON bim_exports
FOR SELECT
TO authenticated
USING (true);

-- EXPORT ANALYTICS: Allow anonymous INSERT
CREATE POLICY "anon_insert_export_analytics"
ON export_analytics
FOR INSERT
TO anon, public
WITH CHECK (true);

-- EXPORT ANALYTICS: Allow authenticated users to view all
CREATE POLICY "authenticated_select_export_analytics"
ON export_analytics
FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- 3. VERIFY RLS IS ENABLED
-- ============================================

-- Ensure RLS is enabled on all tables
ALTER TABLE bim_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bim_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_analytics ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners (important!)
ALTER TABLE bim_leads FORCE ROW LEVEL SECURITY;
ALTER TABLE configurations FORCE ROW LEVEL SECURITY;
ALTER TABLE bim_exports FORCE ROW LEVEL SECURITY;
ALTER TABLE export_analytics FORCE ROW LEVEL SECURITY;
