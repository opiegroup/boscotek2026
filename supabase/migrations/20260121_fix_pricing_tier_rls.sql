-- Fix RLS policies on pricing_tiers to allow admin updates
-- Run this in Supabase SQL Editor

-- First, drop existing restrictive policies
DROP POLICY IF EXISTS "pricing_tiers_select" ON pricing_tiers;
DROP POLICY IF EXISTS "pricing_tiers_update" ON pricing_tiers;
DROP POLICY IF EXISTS "pricing_tiers_insert" ON pricing_tiers;
DROP POLICY IF EXISTS "pricing_tiers_delete" ON pricing_tiers;
DROP POLICY IF EXISTS "Anyone can view active pricing tiers" ON pricing_tiers;
DROP POLICY IF EXISTS "Staff can manage pricing tiers" ON pricing_tiers;
DROP POLICY IF EXISTS "Pricing managers can update tiers" ON pricing_tiers;

-- Allow anyone to read pricing tiers (needed for dropdowns)
CREATE POLICY "pricing_tiers_select"
ON pricing_tiers FOR SELECT
TO authenticated
USING (true);

-- Also allow public to see tiers for configurator
CREATE POLICY "pricing_tiers_public_select"
ON pricing_tiers FOR SELECT
TO anon
USING (is_active = true);

-- Allow authenticated users to update pricing tiers (admin check in application)
CREATE POLICY "pricing_tiers_update"
ON pricing_tiers FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to insert pricing tiers
CREATE POLICY "pricing_tiers_insert"
ON pricing_tiers FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to delete pricing tiers
CREATE POLICY "pricing_tiers_delete"
ON pricing_tiers FOR DELETE
TO authenticated
USING (true);

-- Verify the policies
SELECT tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'pricing_tiers';
