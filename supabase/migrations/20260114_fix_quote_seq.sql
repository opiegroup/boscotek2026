-- Fix missing quote_ref_seq sequence
CREATE SEQUENCE IF NOT EXISTS public.quote_ref_seq START 1000 INCREMENT 1;

-- Recreate the function to ensure it exists
CREATE OR REPLACE FUNCTION public.next_quote_reference()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  next_val bigint;
BEGIN
  next_val := nextval('public.quote_ref_seq');
  RETURN 'BQ-' || to_char(clock_timestamp(), 'YYYY') || '-' || lpad(next_val::text, 4, '0');
END;
$$;
