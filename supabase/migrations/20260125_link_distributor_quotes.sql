-- Migration: Add distributor_id to quotes and link existing quotes
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. ADD DISTRIBUTOR_ID COLUMN TO QUOTES
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotes' AND column_name = 'distributor_id'
  ) THEN
    ALTER TABLE quotes ADD COLUMN distributor_id UUID REFERENCES distributors(id);
    CREATE INDEX idx_quotes_distributor ON quotes(distributor_id);
  END IF;
END $$;

-- ============================================
-- 2. LINK MARKETING USER'S QUOTES TO THEIR DISTRIBUTOR
-- ============================================
UPDATE quotes 
SET distributor_id = (
  SELECT d.id FROM distributors d 
  JOIN auth.users u ON d.user_id = u.id 
  WHERE u.email = 'opiegroupmarketing@gmail.com'
  LIMIT 1
)
WHERE customer_email = 'opiegroupmarketing@gmail.com'
AND distributor_id IS NULL;

-- ============================================
-- 3. VERIFY
-- ============================================
SELECT reference, customer_name, customer_email, distributor_id 
FROM quotes 
WHERE customer_email = 'opiegroupmarketing@gmail.com';

SELECT 'Quote linking complete!' as message;
