-- =============================================================================
-- Restore any RLS policies that may have been dropped by CASCADE
-- These policies use the has_role / has_any_role functions
-- =============================================================================

-- Recreate staff-only policies for products (if dropped)
DROP POLICY IF EXISTS "staff_insert_products" ON public.products;
DROP POLICY IF EXISTS "staff_update_products" ON public.products;
DROP POLICY IF EXISTS "staff_delete_products" ON public.products;

CREATE POLICY "staff_insert_products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(ARRAY['admin', 'pricing_manager', 'sales']));

CREATE POLICY "staff_update_products" ON public.products
  FOR UPDATE TO authenticated
  USING (public.has_any_role(ARRAY['admin', 'pricing_manager', 'sales']))
  WITH CHECK (public.has_any_role(ARRAY['admin', 'pricing_manager', 'sales']));

CREATE POLICY "staff_delete_products" ON public.products
  FOR DELETE TO authenticated
  USING (public.has_any_role(ARRAY['admin', 'pricing_manager', 'sales']));

-- Recreate staff-only policies for drawer_interiors (if dropped)
DROP POLICY IF EXISTS "staff_insert_drawer_interiors" ON public.drawer_interiors;
DROP POLICY IF EXISTS "staff_update_drawer_interiors" ON public.drawer_interiors;
DROP POLICY IF EXISTS "staff_delete_drawer_interiors" ON public.drawer_interiors;

CREATE POLICY "staff_insert_drawer_interiors" ON public.drawer_interiors
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(ARRAY['admin', 'pricing_manager', 'sales']));

CREATE POLICY "staff_update_drawer_interiors" ON public.drawer_interiors
  FOR UPDATE TO authenticated
  USING (public.has_any_role(ARRAY['admin', 'pricing_manager', 'sales']))
  WITH CHECK (public.has_any_role(ARRAY['admin', 'pricing_manager', 'sales']));

CREATE POLICY "staff_delete_drawer_interiors" ON public.drawer_interiors
  FOR DELETE TO authenticated
  USING (public.has_any_role(ARRAY['admin', 'pricing_manager', 'sales']));

-- Recreate staff-only policies for quotes (if dropped)
DROP POLICY IF EXISTS "staff_update_quotes" ON public.quotes;
DROP POLICY IF EXISTS "staff_delete_quotes" ON public.quotes;

CREATE POLICY "staff_update_quotes" ON public.quotes
  FOR UPDATE TO authenticated
  USING (public.has_any_role(ARRAY['admin', 'pricing_manager', 'sales']))
  WITH CHECK (public.has_any_role(ARRAY['admin', 'pricing_manager', 'sales']));

CREATE POLICY "staff_delete_quotes" ON public.quotes
  FOR DELETE TO authenticated
  USING (public.has_any_role(ARRAY['admin', 'pricing_manager', 'sales']));

-- Recreate staff-only policies for bim_leads (if dropped)
DROP POLICY IF EXISTS "staff_update_bim_leads" ON public.bim_leads;
DROP POLICY IF EXISTS "staff_delete_bim_leads" ON public.bim_leads;

CREATE POLICY "staff_update_bim_leads" ON public.bim_leads
  FOR UPDATE TO authenticated
  USING (public.has_any_role(ARRAY['admin', 'pricing_manager', 'sales']))
  WITH CHECK (public.has_any_role(ARRAY['admin', 'pricing_manager', 'sales']));

CREATE POLICY "staff_delete_bim_leads" ON public.bim_leads
  FOR DELETE TO authenticated
  USING (public.has_any_role(ARRAY['admin', 'pricing_manager', 'sales']));

-- Recreate staff-only policies for bim_exports (if dropped)
DROP POLICY IF EXISTS "staff_update_bim_exports" ON public.bim_exports;
DROP POLICY IF EXISTS "staff_delete_bim_exports" ON public.bim_exports;

CREATE POLICY "staff_update_bim_exports" ON public.bim_exports
  FOR UPDATE TO authenticated
  USING (public.has_any_role(ARRAY['admin', 'pricing_manager', 'sales']))
  WITH CHECK (public.has_any_role(ARRAY['admin', 'pricing_manager', 'sales']));

CREATE POLICY "staff_delete_bim_exports" ON public.bim_exports
  FOR DELETE TO authenticated
  USING (public.has_any_role(ARRAY['admin', 'pricing_manager', 'sales']));

-- Recreate staff-only policies for configurations (if dropped)
DROP POLICY IF EXISTS "staff_or_owner_update_configurations" ON public.configurations;
DROP POLICY IF EXISTS "staff_or_owner_delete_configurations" ON public.configurations;
DROP POLICY IF EXISTS "staff_update_configurations" ON public.configurations;
DROP POLICY IF EXISTS "staff_delete_configurations" ON public.configurations;

-- Check if user_id column exists
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
      USING (public.has_any_role(ARRAY[''admin'', ''pricing_manager'', ''sales'']) OR user_id = auth.uid())
      WITH CHECK (public.has_any_role(ARRAY[''admin'', ''pricing_manager'', ''sales'']) OR user_id = auth.uid())';
    
    EXECUTE 'CREATE POLICY "staff_or_owner_delete_configurations" ON public.configurations
      FOR DELETE TO authenticated
      USING (public.has_any_role(ARRAY[''admin'', ''pricing_manager'', ''sales'']) OR user_id = auth.uid())';
  ELSE
    EXECUTE 'CREATE POLICY "staff_update_configurations" ON public.configurations
      FOR UPDATE TO authenticated
      USING (public.has_any_role(ARRAY[''admin'', ''pricing_manager'', ''sales'']))
      WITH CHECK (public.has_any_role(ARRAY[''admin'', ''pricing_manager'', ''sales'']))';
    
    EXECUTE 'CREATE POLICY "staff_delete_configurations" ON public.configurations
      FOR DELETE TO authenticated
      USING (public.has_any_role(ARRAY[''admin'', ''pricing_manager'', ''sales'']))';
  END IF;
END $$;

-- Recreate staff-only policies for export_analytics (if dropped)
DROP POLICY IF EXISTS "staff_update_export_analytics" ON public.export_analytics;
DROP POLICY IF EXISTS "staff_delete_export_analytics" ON public.export_analytics;

CREATE POLICY "staff_update_export_analytics" ON public.export_analytics
  FOR UPDATE TO authenticated
  USING (public.has_any_role(ARRAY['admin', 'pricing_manager', 'sales']))
  WITH CHECK (public.has_any_role(ARRAY['admin', 'pricing_manager', 'sales']));

CREATE POLICY "staff_delete_export_analytics" ON public.export_analytics
  FOR DELETE TO authenticated
  USING (public.has_any_role(ARRAY['admin', 'pricing_manager', 'sales']));
