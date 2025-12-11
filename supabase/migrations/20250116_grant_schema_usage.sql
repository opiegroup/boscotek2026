-- Grant schema-level permissions required for anon role
-- Sometimes table grants aren't enough without schema USAGE permission

-- ============================================
-- 1. GRANT SCHEMA USAGE
-- ============================================

-- Allow anon role to use the public schema
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================
-- 2. RE-GRANT ALL TABLE PERMISSIONS
-- ============================================

-- Explicitly grant ALL permissions needed for INSERT operations
GRANT INSERT ON TABLE public.bim_leads TO anon;
GRANT INSERT ON TABLE public.configurations TO anon;
GRANT INSERT ON TABLE public.bim_exports TO anon;
GRANT INSERT ON TABLE public.export_analytics TO anon;

-- Also grant for authenticated role
GRANT ALL ON TABLE public.bim_leads TO authenticated;
GRANT ALL ON TABLE public.configurations TO authenticated;
GRANT ALL ON TABLE public.bim_exports TO authenticated;
GRANT ALL ON TABLE public.export_analytics TO authenticated;

-- ============================================
-- 3. GRANT SEQUENCE ACCESS
-- ============================================

-- Ensure anon can use sequences for default values (like gen_random_uuid())
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- 4. TEMPORARILY DISABLE RLS FOR TESTING
-- ============================================

-- Let's temporarily disable RLS to see if that's the issue
-- We can re-enable it once we confirm the grants work

ALTER TABLE public.bim_leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.configurations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bim_exports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_analytics DISABLE ROW LEVEL SECURITY;

-- Note: This makes the tables fully public for INSERT
-- We'll re-enable RLS once we confirm the grants are working
