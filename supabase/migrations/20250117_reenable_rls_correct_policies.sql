-- Re-enable RLS with Correct Policies
-- Now that we know the grants work, let's add proper RLS policies

-- ============================================
-- 1. DROP ALL EXISTING POLICIES
-- ============================================

-- Clean slate - drop everything
DROP POLICY IF EXISTS "public_insert_bim_leads" ON public.bim_leads;
DROP POLICY IF EXISTS "public_insert_configurations" ON public.configurations;
DROP POLICY IF EXISTS "public_insert_bim_exports" ON public.bim_exports;
DROP POLICY IF EXISTS "public_insert_export_analytics" ON public.export_analytics;
DROP POLICY IF EXISTS "authenticated_select_bim_leads" ON public.bim_leads;
DROP POLICY IF EXISTS "authenticated_select_configurations" ON public.configurations;
DROP POLICY IF EXISTS "authenticated_select_bim_exports" ON public.bim_exports;
DROP POLICY IF EXISTS "authenticated_select_export_analytics" ON public.export_analytics;

-- ============================================
-- 2. RE-ENABLE RLS
-- ============================================

ALTER TABLE public.bim_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bim_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_analytics ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. CREATE PERMISSIVE POLICIES
-- ============================================

-- BIM LEADS: Allow all users to insert
CREATE POLICY "allow_insert_bim_leads"
ON public.bim_leads
AS PERMISSIVE
FOR INSERT
TO PUBLIC
WITH CHECK (true);

-- BIM LEADS: Allow authenticated users to select
CREATE POLICY "allow_select_bim_leads"
ON public.bim_leads
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (true);

-- CONFIGURATIONS: Allow all users to insert
CREATE POLICY "allow_insert_configurations"
ON public.configurations
AS PERMISSIVE
FOR INSERT
TO PUBLIC
WITH CHECK (true);

-- CONFIGURATIONS: Allow authenticated users to select
CREATE POLICY "allow_select_configurations"
ON public.configurations
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (true);

-- BIM EXPORTS: Allow all users to insert
CREATE POLICY "allow_insert_bim_exports"
ON public.bim_exports
AS PERMISSIVE
FOR INSERT
TO PUBLIC
WITH CHECK (true);

-- BIM EXPORTS: Allow authenticated users to select
CREATE POLICY "allow_select_bim_exports"
ON public.bim_exports
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (true);

-- EXPORT ANALYTICS: Allow all users to insert
CREATE POLICY "allow_insert_export_analytics"
ON public.export_analytics
AS PERMISSIVE
FOR INSERT
TO PUBLIC
WITH CHECK (true);

-- EXPORT ANALYTICS: Allow authenticated users to select
CREATE POLICY "allow_select_export_analytics"
ON public.export_analytics
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (true);
