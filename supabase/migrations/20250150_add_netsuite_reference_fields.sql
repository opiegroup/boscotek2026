-- =============================================================================
-- ADD: NetSuite integration fields
-- - sales_order_number: Per quote (SO number from NetSuite)
-- - og_number: Per quote item (stored in items_data JSONB)
-- =============================================================================

-- Add sales_order_number column to quotes table
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS sales_order_number TEXT;

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_quotes_sales_order_number 
ON public.quotes(sales_order_number) 
WHERE sales_order_number IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.quotes.sales_order_number IS 'NetSuite Sales Order number for production tracking';
