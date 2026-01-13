-- Run this in Supabase SQL Editor to fix brand-assets bucket
-- Go to: Supabase Dashboard > SQL Editor > New Query > Paste this > Run

-- 1. Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  true,
  5242880,
  ARRAY['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop all existing policies for brand-assets to start fresh
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname LIKE '%brand%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- 3. Create simple permissive policies
CREATE POLICY "brand_assets_select" ON storage.objects 
FOR SELECT USING (bucket_id = 'brand-assets');

CREATE POLICY "brand_assets_insert" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'brand-assets');

CREATE POLICY "brand_assets_update" ON storage.objects 
FOR UPDATE USING (bucket_id = 'brand-assets');

CREATE POLICY "brand_assets_delete" ON storage.objects 
FOR DELETE USING (bucket_id = 'brand-assets');

-- 4. Verify bucket exists
SELECT id, name, public FROM storage.buckets WHERE id = 'brand-assets';
