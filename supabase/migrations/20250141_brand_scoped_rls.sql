-- =============================================================================
-- Brand-Scoped RLS Policies Migration
-- =============================================================================
-- This migration updates RLS policies on key tables to enforce brand_id filtering
-- at the database level, ensuring no cross-brand data leakage.
-- =============================================================================

-- =============================================================================
-- PART 1: ADD RLS FUNCTION FOR BRAND ACCESS CHECK
-- =============================================================================

-- Function to check if user can access a specific brand_id row
-- Returns TRUE if:
-- 1. User is a super admin (has 'admin' role in any brand)
-- 2. User has explicit access to the brand
-- 3. The row has no brand_id (legacy/null data)
CREATE OR REPLACE FUNCTION public.can_access_brand(p_brand_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Allow access to rows without brand_id (legacy data)
  IF p_brand_id IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    -- Anonymous users can only access public/active brands
    RETURN EXISTS (
      SELECT 1 FROM public.brands 
      WHERE id = p_brand_id AND status = 'active'
    );
  END IF;
  
  -- Check if user has brand access
  RETURN public.user_has_brand_access(p_brand_id, 'viewer');
END;
$$;

-- Function to check if user can write to a specific brand_id
CREATE OR REPLACE FUNCTION public.can_write_brand(p_brand_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Allow writes to rows without brand_id (legacy data) for staff only
  IF p_brand_id IS NULL THEN
    RETURN public.is_staff();
  END IF;
  
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user has sales level or higher access to the brand
  RETURN public.user_has_brand_access(p_brand_id, 'sales');
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.can_access_brand(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_brand(UUID) TO authenticated;

-- =============================================================================
-- PART 2: UPDATE PRODUCTS TABLE RLS
-- =============================================================================

-- Drop existing product policies
DROP POLICY IF EXISTS "products_brand_select" ON public.products;
DROP POLICY IF EXISTS "products_brand_insert" ON public.products;
DROP POLICY IF EXISTS "products_brand_update" ON public.products;
DROP POLICY IF EXISTS "products_brand_delete" ON public.products;

-- Create brand-scoped policies for products
CREATE POLICY "products_brand_select" ON public.products
  FOR SELECT
  USING (public.can_access_brand(brand_id));

CREATE POLICY "products_brand_insert" ON public.products
  FOR INSERT
  WITH CHECK (public.can_write_brand(brand_id) AND public.is_staff());

CREATE POLICY "products_brand_update" ON public.products
  FOR UPDATE
  USING (public.can_write_brand(brand_id) AND public.is_staff())
  WITH CHECK (public.can_write_brand(brand_id) AND public.is_staff());

CREATE POLICY "products_brand_delete" ON public.products
  FOR DELETE
  USING (public.can_write_brand(brand_id) AND public.is_admin());

-- =============================================================================
-- PART 3: UPDATE QUOTES TABLE RLS
-- =============================================================================

-- Drop existing quote policies if they conflict
DROP POLICY IF EXISTS "quotes_brand_select" ON public.quotes;
DROP POLICY IF EXISTS "quotes_brand_insert" ON public.quotes;
DROP POLICY IF EXISTS "quotes_brand_update" ON public.quotes;
DROP POLICY IF EXISTS "quotes_brand_delete" ON public.quotes;

-- Create brand-scoped policies for quotes
-- SELECT: Users can see quotes for brands they have access to
CREATE POLICY "quotes_brand_select" ON public.quotes
  FOR SELECT
  USING (public.can_access_brand(brand_id));

-- INSERT: Anyone can create quotes (public configurator), brand_id set by server
CREATE POLICY "quotes_brand_insert" ON public.quotes
  FOR INSERT
  WITH CHECK (TRUE);

-- UPDATE: Staff with brand access can update
CREATE POLICY "quotes_brand_update" ON public.quotes
  FOR UPDATE
  USING (public.can_write_brand(brand_id) AND public.is_staff())
  WITH CHECK (public.can_write_brand(brand_id) AND public.is_staff());

-- DELETE: Admin with brand access can delete
CREATE POLICY "quotes_brand_delete" ON public.quotes
  FOR DELETE
  USING (public.can_write_brand(brand_id) AND public.is_admin());

-- =============================================================================
-- PART 4: UPDATE CONFIGURATIONS TABLE RLS
-- =============================================================================

-- Drop existing configuration policies if they conflict
DROP POLICY IF EXISTS "configurations_brand_select" ON public.configurations;
DROP POLICY IF EXISTS "configurations_brand_insert" ON public.configurations;
DROP POLICY IF EXISTS "configurations_brand_update" ON public.configurations;
DROP POLICY IF EXISTS "configurations_brand_delete" ON public.configurations;

-- Create brand-scoped policies for configurations
CREATE POLICY "configurations_brand_select" ON public.configurations
  FOR SELECT
  USING (public.can_access_brand(brand_id));

CREATE POLICY "configurations_brand_insert" ON public.configurations
  FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "configurations_brand_update" ON public.configurations
  FOR UPDATE
  USING (public.can_write_brand(brand_id))
  WITH CHECK (public.can_write_brand(brand_id));

CREATE POLICY "configurations_brand_delete" ON public.configurations
  FOR DELETE
  USING (public.can_write_brand(brand_id) AND public.is_staff());

-- =============================================================================
-- PART 5: UPDATE BIM_LEADS TABLE RLS
-- =============================================================================

DROP POLICY IF EXISTS "bim_leads_brand_select" ON public.bim_leads;
DROP POLICY IF EXISTS "bim_leads_brand_insert" ON public.bim_leads;
DROP POLICY IF EXISTS "bim_leads_brand_update" ON public.bim_leads;
DROP POLICY IF EXISTS "bim_leads_brand_delete" ON public.bim_leads;

CREATE POLICY "bim_leads_brand_select" ON public.bim_leads
  FOR SELECT
  USING (public.can_access_brand(brand_id));

CREATE POLICY "bim_leads_brand_insert" ON public.bim_leads
  FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "bim_leads_brand_update" ON public.bim_leads
  FOR UPDATE
  USING (public.can_write_brand(brand_id) AND public.is_staff())
  WITH CHECK (public.can_write_brand(brand_id) AND public.is_staff());

CREATE POLICY "bim_leads_brand_delete" ON public.bim_leads
  FOR DELETE
  USING (public.can_write_brand(brand_id) AND public.is_admin());

-- =============================================================================
-- PART 6: UPDATE BIM_EXPORTS TABLE RLS
-- =============================================================================

DROP POLICY IF EXISTS "bim_exports_brand_select" ON public.bim_exports;
DROP POLICY IF EXISTS "bim_exports_brand_insert" ON public.bim_exports;
DROP POLICY IF EXISTS "bim_exports_brand_update" ON public.bim_exports;
DROP POLICY IF EXISTS "bim_exports_brand_delete" ON public.bim_exports;

CREATE POLICY "bim_exports_brand_select" ON public.bim_exports
  FOR SELECT
  USING (public.can_access_brand(brand_id));

CREATE POLICY "bim_exports_brand_insert" ON public.bim_exports
  FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "bim_exports_brand_update" ON public.bim_exports
  FOR UPDATE
  USING (public.can_write_brand(brand_id))
  WITH CHECK (public.can_write_brand(brand_id));

CREATE POLICY "bim_exports_brand_delete" ON public.bim_exports
  FOR DELETE
  USING (public.can_write_brand(brand_id) AND public.is_staff());

-- =============================================================================
-- PART 7: UPDATE DRAWER_INTERIORS TABLE RLS
-- =============================================================================

DROP POLICY IF EXISTS "drawer_interiors_brand_select" ON public.drawer_interiors;
DROP POLICY IF EXISTS "drawer_interiors_brand_insert" ON public.drawer_interiors;
DROP POLICY IF EXISTS "drawer_interiors_brand_update" ON public.drawer_interiors;
DROP POLICY IF EXISTS "drawer_interiors_brand_delete" ON public.drawer_interiors;

CREATE POLICY "drawer_interiors_brand_select" ON public.drawer_interiors
  FOR SELECT
  USING (public.can_access_brand(brand_id));

CREATE POLICY "drawer_interiors_brand_insert" ON public.drawer_interiors
  FOR INSERT
  WITH CHECK (public.can_write_brand(brand_id) AND public.is_staff());

CREATE POLICY "drawer_interiors_brand_update" ON public.drawer_interiors
  FOR UPDATE
  USING (public.can_write_brand(brand_id) AND public.is_staff())
  WITH CHECK (public.can_write_brand(brand_id) AND public.is_staff());

CREATE POLICY "drawer_interiors_brand_delete" ON public.drawer_interiors
  FOR DELETE
  USING (public.can_write_brand(brand_id) AND public.is_admin());

-- =============================================================================
-- PART 8: UPDATE PRICING_TIERS TABLE RLS
-- =============================================================================

DROP POLICY IF EXISTS "pricing_tiers_brand_select" ON public.pricing_tiers;
DROP POLICY IF EXISTS "pricing_tiers_brand_insert" ON public.pricing_tiers;
DROP POLICY IF EXISTS "pricing_tiers_brand_update" ON public.pricing_tiers;
DROP POLICY IF EXISTS "pricing_tiers_brand_delete" ON public.pricing_tiers;

CREATE POLICY "pricing_tiers_brand_select" ON public.pricing_tiers
  FOR SELECT
  USING (public.can_access_brand(brand_id));

CREATE POLICY "pricing_tiers_brand_insert" ON public.pricing_tiers
  FOR INSERT
  WITH CHECK (public.can_write_brand(brand_id) AND public.can_manage_pricing());

CREATE POLICY "pricing_tiers_brand_update" ON public.pricing_tiers
  FOR UPDATE
  USING (public.can_write_brand(brand_id) AND public.can_manage_pricing())
  WITH CHECK (public.can_write_brand(brand_id) AND public.can_manage_pricing());

CREATE POLICY "pricing_tiers_brand_delete" ON public.pricing_tiers
  FOR DELETE
  USING (public.can_write_brand(brand_id) AND public.is_admin());

-- =============================================================================
-- PART 9: UPDATE COMPANIES TABLE RLS
-- =============================================================================

DROP POLICY IF EXISTS "companies_brand_select" ON public.companies;
DROP POLICY IF EXISTS "companies_brand_insert" ON public.companies;
DROP POLICY IF EXISTS "companies_brand_update" ON public.companies;
DROP POLICY IF EXISTS "companies_brand_delete" ON public.companies;

CREATE POLICY "companies_brand_select" ON public.companies
  FOR SELECT
  USING (public.can_access_brand(brand_id));

CREATE POLICY "companies_brand_insert" ON public.companies
  FOR INSERT
  WITH CHECK (public.can_write_brand(brand_id) AND public.is_staff());

CREATE POLICY "companies_brand_update" ON public.companies
  FOR UPDATE
  USING (public.can_write_brand(brand_id) AND public.is_staff())
  WITH CHECK (public.can_write_brand(brand_id) AND public.is_staff());

CREATE POLICY "companies_brand_delete" ON public.companies
  FOR DELETE
  USING (public.can_write_brand(brand_id) AND public.is_admin());

-- =============================================================================
-- PART 10: UPDATE AUDIT_LOGS TABLE RLS
-- =============================================================================

DROP POLICY IF EXISTS "audit_logs_brand_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_brand_insert" ON public.audit_logs;

CREATE POLICY "audit_logs_brand_select" ON public.audit_logs
  FOR SELECT
  USING (public.can_access_brand(brand_id) AND public.is_staff());

CREATE POLICY "audit_logs_brand_insert" ON public.audit_logs
  FOR INSERT
  WITH CHECK (TRUE);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON FUNCTION public.can_access_brand IS 
'Returns TRUE if the current user can read data for the given brand_id.
Anonymous users can access active brands. Authenticated users need brand_access record.
NULL brand_id (legacy data) is accessible to all.';

COMMENT ON FUNCTION public.can_write_brand IS 
'Returns TRUE if the current user can write data for the given brand_id.
Requires authentication and at least sales-level brand access.
NULL brand_id (legacy data) requires staff role.';
