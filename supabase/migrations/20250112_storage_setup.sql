-- Migration: Setup Storage Bucket for BIM Exports
-- Creates the storage bucket and policies for file uploads/downloads

-- ============================================
-- 1. CREATE STORAGE BUCKET
-- ============================================

-- Create the bim-exports bucket (private by default)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bim-exports',
  'bim-exports',
  false, -- Private bucket, requires signed URLs
  52428800, -- 50MB limit
  ARRAY['application/x-step', 'text/csv', 'application/json', 'text/plain', 'application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. STORAGE POLICIES
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Service role can upload BIM files" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update BIM files" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete BIM files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can download with signed URL" ON storage.objects;

-- Allow service role (Edge Functions) to upload files
CREATE POLICY "Service role can upload BIM files"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'bim-exports');

-- Allow service role to update files
CREATE POLICY "Service role can update BIM files"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'bim-exports');

-- Allow service role to delete files
CREATE POLICY "Service role can delete BIM files"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'bim-exports');

-- Allow anyone to download files (signed URLs will control access)
CREATE POLICY "Anyone can download with signed URL"
  ON storage.objects FOR SELECT
  TO public, anon, authenticated
  USING (bucket_id = 'bim-exports');
