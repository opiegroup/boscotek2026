-- Fix the function to use explicit schema reference
CREATE OR REPLACE FUNCTION public.next_quote_reference()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  next_val bigint;
BEGIN
  next_val := nextval('public.quote_ref_seq');
  RETURN 'BQ-' || to_char(clock_timestamp(), 'YYYY') || '-' || lpad(next_val::text, 4, '0');
END;
$$;
