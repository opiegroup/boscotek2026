-- =============================================================================
-- Fix Supabase Linter Security Warnings
-- =============================================================================

-- =============================================================================
-- PART 1: Fix Function Search Path (21 functions)
-- Use ALTER FUNCTION to add SET search_path = '' without dropping
-- =============================================================================

-- Trigger functions (can't easily alter, recreate them)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the user creation if profile creation fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Use ALTER FUNCTION for existing functions to set search_path
-- This preserves dependencies and doesn't require DROP

DO $$
BEGIN
  -- Role check functions
  EXECUTE 'ALTER FUNCTION public.has_role(TEXT) SET search_path = ''''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.has_any_role(TEXT[]) SET search_path = ''''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.is_staff() SET search_path = ''''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.can_manage_pricing() SET search_path = ''''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.is_admin() SET search_path = ''''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.get_user_role() SET search_path = ''''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.is_distributor() SET search_path = ''''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.get_user_pricing_tier() SET search_path = ''''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.get_user_markup_percentage() SET search_path = ''''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.generate_distributor_account_number() SET search_path = ''''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.generate_account_number() SET search_path = ''''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.next_quote_reference() SET search_path = ''''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.convert_currency(NUMERIC, TEXT, TEXT) SET search_path = ''''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.get_user_company_pricing() SET search_path = ''''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- Functions with specific signatures - use DO blocks to handle if they don't exist
DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.create_audit_log(TEXT, TEXT, public.audit_action, TEXT, JSONB, JSONB, JSONB, INET, TEXT) SET search_path = ''''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.queue_notification(UUID, TEXT, TEXT, TEXT, JSONB) SET search_path = ''''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.queue_notification_for_roles(TEXT[], TEXT, TEXT, TEXT, JSONB) SET search_path = ''''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.update_user_profile(TEXT, TEXT, TEXT, TEXT) SET search_path = ''''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- =============================================================================
-- PART 2: Fix RLS Policies (restrict to staff for sensitive operations)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Products: Only staff can modify
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "allow_authenticated_insert_products" ON public.products;
DROP POLICY IF EXISTS "allow_authenticated_update_products" ON public.products;
DROP POLICY IF EXISTS "allow_authenticated_delete_products" ON public.products;

CREATE POLICY "staff_insert_products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "staff_update_products" ON public.products
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "staff_delete_products" ON public.products
  FOR DELETE TO authenticated
  USING (public.is_staff());

-- -----------------------------------------------------------------------------
-- Drawer Interiors: Only staff can modify
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "allow_authenticated_insert_drawer_interiors" ON public.drawer_interiors;
DROP POLICY IF EXISTS "allow_authenticated_update_drawer_interiors" ON public.drawer_interiors;
DROP POLICY IF EXISTS "allow_authenticated_delete_drawer_interiors" ON public.drawer_interiors;

CREATE POLICY "staff_insert_drawer_interiors" ON public.drawer_interiors
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "staff_update_drawer_interiors" ON public.drawer_interiors
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "staff_delete_drawer_interiors" ON public.drawer_interiors
  FOR DELETE TO authenticated
  USING (public.is_staff());

-- -----------------------------------------------------------------------------
-- Quotes: Staff can manage all
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "allow_authenticated_update_quotes" ON public.quotes;
DROP POLICY IF EXISTS "allow_authenticated_delete_quotes" ON public.quotes;

CREATE POLICY "staff_update_quotes" ON public.quotes
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "staff_delete_quotes" ON public.quotes
  FOR DELETE TO authenticated
  USING (public.is_staff());

-- -----------------------------------------------------------------------------
-- BIM Leads: Only staff can modify
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "allow_authenticated_update_bim_leads" ON public.bim_leads;
DROP POLICY IF EXISTS "allow_authenticated_delete_bim_leads" ON public.bim_leads;

CREATE POLICY "staff_update_bim_leads" ON public.bim_leads
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "staff_delete_bim_leads" ON public.bim_leads
  FOR DELETE TO authenticated
  USING (public.is_staff());

-- -----------------------------------------------------------------------------
-- BIM Exports: Only staff can modify
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "allow_authenticated_update_bim_exports" ON public.bim_exports;
DROP POLICY IF EXISTS "allow_authenticated_delete_bim_exports" ON public.bim_exports;

CREATE POLICY "staff_update_bim_exports" ON public.bim_exports
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "staff_delete_bim_exports" ON public.bim_exports
  FOR DELETE TO authenticated
  USING (public.is_staff());

-- -----------------------------------------------------------------------------
-- Configurations: Staff can manage, or user owns the config
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "allow_authenticated_update_configurations" ON public.configurations;
DROP POLICY IF EXISTS "allow_authenticated_delete_configurations" ON public.configurations;

-- Check if user_id column exists before creating policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'configurations' 
    AND column_name = 'user_id'
  ) THEN
    EXECUTE 'CREATE POLICY "staff_or_owner_update_configurations" ON public.configurations
      FOR UPDATE TO authenticated
      USING (public.is_staff() OR user_id = auth.uid())
      WITH CHECK (public.is_staff() OR user_id = auth.uid())';
    
    EXECUTE 'CREATE POLICY "staff_or_owner_delete_configurations" ON public.configurations
      FOR DELETE TO authenticated
      USING (public.is_staff() OR user_id = auth.uid())';
  ELSE
    -- No user_id column, just allow staff
    EXECUTE 'CREATE POLICY "staff_update_configurations" ON public.configurations
      FOR UPDATE TO authenticated
      USING (public.is_staff())
      WITH CHECK (public.is_staff())';
    
    EXECUTE 'CREATE POLICY "staff_delete_configurations" ON public.configurations
      FOR DELETE TO authenticated
      USING (public.is_staff())';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Export Analytics: Only staff can modify
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "allow_authenticated_update_export_analytics" ON public.export_analytics;
DROP POLICY IF EXISTS "allow_authenticated_delete_export_analytics" ON public.export_analytics;

CREATE POLICY "staff_update_export_analytics" ON public.export_analytics
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "staff_delete_export_analytics" ON public.export_analytics
  FOR DELETE TO authenticated
  USING (public.is_staff());

-- =============================================================================
-- PART 3: Notes on intentionally permissive policies (NOT changing these)
-- =============================================================================
-- The following INSERT policies are intentionally permissive for public access:
-- - allow_public_insert_bim_leads: Public users can submit BIM lead capture forms
-- - allow_public_insert_bim_exports: System creates export records for public users
-- - allow_public_insert_configurations: Public users can save configurations
-- - allow_public_insert_quotes: Public users can submit quote requests
-- - allow_public_insert_export_analytics: System logs export analytics
-- - audit_logs_service_insert: Service role inserts audit logs
-- - notifications_service_insert: Service role creates notifications
-- - pricing_logs_service_insert: Service role logs pricing requests
-- 
-- These are designed this way because:
-- 1. The configurator is public-facing
-- 2. Users don't need to be authenticated to request quotes
-- 3. Service role operations bypass RLS anyway
-- =============================================================================

COMMENT ON FUNCTION public.is_staff() IS 'Returns true if current user has admin, sales, or pricing_manager role';
