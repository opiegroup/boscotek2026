-- Migration: Add brand-assets storage bucket and bim_leads status column
-- Fixes missing infrastructure for brand logo uploads and lead status tracking

-- ============================================
-- 1. ADD STATUS COLUMN TO BIM_LEADS
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bim_leads' AND column_name = 'status'
  ) THEN
    ALTER TABLE bim_leads ADD COLUMN status TEXT DEFAULT 'new' 
      CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'archived'));
    CREATE INDEX IF NOT EXISTS idx_bim_leads_status ON bim_leads(status);
  END IF;
END $$;

-- ============================================
-- 2. CREATE BRAND-ASSETS STORAGE BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  true, -- Public bucket for logos and brand assets
  5242880, -- 5MB limit
  ARRAY['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. STORAGE POLICIES FOR BRAND-ASSETS
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can view brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete brand assets" ON storage.objects;

-- Allow anyone to view brand assets (logos are public)
CREATE POLICY "Anyone can view brand assets"
  ON storage.objects FOR SELECT
  TO public, anon, authenticated
  USING (bucket_id = 'brand-assets');

-- Allow authenticated users to upload brand assets
CREATE POLICY "Authenticated users can upload brand assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'brand-assets');

-- Allow authenticated users to update brand assets
CREATE POLICY "Authenticated users can update brand assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'brand-assets');

-- Allow authenticated users to delete brand assets
CREATE POLICY "Authenticated users can delete brand assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'brand-assets');

-- ============================================
-- 4. GRANT PERMISSIONS
-- ============================================
GRANT ALL ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon;
