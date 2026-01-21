-- Fix distributor-logos storage bucket
-- Run this in Supabase SQL Editor

-- Ensure bucket exists with correct settings
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'distributor-logos',
  'distributor-logos',
  true,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
  2097152  -- 2MB
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
  file_size_limit = 2097152;

-- Drop existing policies
DROP POLICY IF EXISTS "distributor_logos_select" ON storage.objects;
DROP POLICY IF EXISTS "distributor_logos_insert" ON storage.objects;
DROP POLICY IF EXISTS "distributor_logos_update" ON storage.objects;
DROP POLICY IF EXISTS "distributor_logos_delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their logos" ON storage.objects;

-- Public can view logos (bucket is public)
CREATE POLICY "Public can view distributor logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'distributor-logos');

-- Authenticated users can upload logos
CREATE POLICY "Authenticated users can upload distributor logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'distributor-logos');

-- Authenticated users can update logos
CREATE POLICY "Authenticated users can update distributor logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'distributor-logos');

-- Authenticated users can delete logos
CREATE POLICY "Authenticated users can delete distributor logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'distributor-logos');

-- Verify
SELECT 'Storage bucket and policies configured!' as message;
