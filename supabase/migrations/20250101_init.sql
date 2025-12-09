create table if not exists public.products (
  id text primary key,
  name text not null,
  base_price numeric not null default 0,
  data jsonb not null,
  inserted_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.drawer_interiors (
  id text primary key,
  type text not null,
  price numeric not null default 0,
  data jsonb not null,
  inserted_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  status text not null default 'new',
  customer_data jsonb not null,
  items_data jsonb not null,
  totals jsonb not null,
  internal_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create sequence if not exists quote_ref_seq start 1000 increment 1;

create or replace function public.next_quote_reference()
returns text language plpgsql as $$
declare
  next_val bigint;
begin
  next_val := nextval('quote_ref_seq');
  return 'BQ-' || to_char(clock_timestamp(), 'YYYY') || '-' || lpad(next_val::text, 4, '0');
end;
$$;

