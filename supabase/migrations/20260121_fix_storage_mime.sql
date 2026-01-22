-- Fix storage bucket MIME type issue
-- Run this in Supabase SQL Editor

-- Remove MIME type restrictions (allow any image)
UPDATE storage.buckets 
SET allowed_mime_types = NULL
WHERE id = 'distributor-logos';

-- Or if you want to keep restrictions, use this format:
-- UPDATE storage.buckets 
-- SET allowed_mime_types = '{"image/png","image/jpeg","image/jpg","image/webp"}'::text[]
-- WHERE id = 'distributor-logos';

SELECT id, name, public, allowed_mime_types, file_size_limit 
FROM storage.buckets 
WHERE id = 'distributor-logos';
