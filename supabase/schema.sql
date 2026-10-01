-- Jill's Diner online pre-orders. Run once in the Supabase SQL editor.
-- Safe to re-run: every statement checks before it creates.
--
-- Who can do what:
--   * Customers never talk to the database. Orders arrive only through the
--     Netlify function, which uses the service key (that key bypasses row
--     level security and never leaves Netlify).
--   * Staff log in on the tablet. They can read orders and change an order's
--     status, nothing else. Being logged in is not enough: the account must
--     also be listed in public.staff.
--   * Anonymous visitors can't read or write anything.
--   * Cancelling goes through cancel_order(), which records who told the
--     customer and when. Staff can't cancel by changing the status directly.

create extension if not exists pgcrypto;

-- ---------- Tables ----------

create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      bigint generated always as identity,
  created_at        timestamptz not null default now(),
  customer_name     text not null check (char_length(customer_name) between 2 and 81),
  customer_phone    text not null check (customer_phone ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'),
  pickup_time       timestamptz not null,
  order_items       jsonb not null check (
                      jsonb_typeof(order_items) = 'array'
                      and jsonb_array_length(order_items) between 1 and 40
                    ),
  special_notes     text check (char_length(special_notes) <= 500),
  subtotal_cents    integer not null check (subtotal_cents >= 0),
  status            text not null default 'pending'
                      check (status in ('pending', 'accepted', 'cancelled', 'completed')),
  status_changed_at timestamptz
);

create index if not exists orders_status_pickup_idx on public.orders (status, pickup_time);
create index if not exists orders_created_idx on public.orders (created_at desc);

create table if not exists public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text,
  created_at timestamptz not null default now()
);

-- Stamp every status change.
create or replace function public.orders_touch_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists orders_touch_status on public.orders;
create trigger orders_touch_status
  before update on public.orders
  for each row execute function public.orders_touch_status();

-- ---------- Access ----------

-- True when the logged-in user is on the staff list. Security definer so it
-- can read public.staff, which nobody else can.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

alter table public.orders enable row level security;
alter table public.staff enable row level security;

-- Start from nothing, then grant exactly what staff need.
revoke all on public.orders from anon, authenticated;
revoke all on public.staff from anon, authenticated;
grant select on public.orders to authenticated;
grant update (status) on public.orders to authenticated;

drop policy if exists "staff read orders" on public.orders;
create policy "staff read orders" on public.orders
  for select to authenticated
  using (public.is_staff());

-- Staff can move an order along but not cancel it here: cancelling has to go
-- through cancel_order() below so the record is always written.
drop policy if exists "staff update order status" on public.orders;
create policy "staff update order status" on public.orders
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff() and status <> 'cancelled');

-- ---------- Cancelling ----------

-- Before an order is cancelled, staff call the customer (or tell them in
-- person) and type their own name on the tablet. cancel_order() is the only
-- way to cancel. It saves the tablet account, the person's name and the time.
alter table public.orders add column if not exists cancelled_by uuid references auth.users (id) on delete set null;
alter table public.orders add column if not exists cancel_confirmed_by text check (char_length(cancel_confirmed_by) between 2 and 60);
alter table public.orders add column if not exists cancel_confirmed_at timestamptz;

create or replace function public.cancel_order(p_order_id uuid, p_staff_name text)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.orders;
  n text := btrim(coalesce(p_staff_name, ''));
begin
  if not public.is_staff() then
    raise exception 'not on the staff list' using errcode = '42501';
  end if;
  if char_length(n) < 2 or char_length(n) > 60 then
    raise exception 'staff name is required' using errcode = '22023';
  end if;
  update public.orders
     set status = 'cancelled',
         cancelled_by = auth.uid(),
         cancel_confirmed_by = n,
         cancel_confirmed_at = now()
   where id = p_order_id and status in ('pending', 'accepted')
  returning * into r;
  if not found then
    raise exception 'order is not open' using errcode = 'P0002';
  end if;
  return r;
end;
$$;

revoke all on function public.cancel_order(uuid, text) from public, anon;
grant execute on function public.cancel_order(uuid, text) to authenticated;

-- ---------- Realtime ----------

-- The tablet subscribes to changes on orders. Realtime applies the same
-- row level security, so only staff receive them.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;

-- ---------- Housekeeping ----------

-- Customer phone numbers shouldn't sit around forever. This deletes orders
-- older than 30 days. Run it by hand, or schedule it daily with pg_cron:
--   select cron.schedule('purge-old-orders', '15 9 * * *', 'select public.purge_old_orders()');
create or replace function public.purge_old_orders()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.orders where created_at < now() - interval '30 days' returning 1
  )
  select count(*)::integer from gone;
$$;

revoke all on function public.purge_old_orders() from public, anon, authenticated;

-- ---------- Adding a staff login ----------
-- 1. Authentication > Users > Add user (email + password, auto-confirm).
-- 2. Then run, with that email:
--    insert into public.staff (user_id, name)
--    select id, 'Diner tablet' from auth.users where email = 'tablet@example.com'
--    on conflict do nothing;
