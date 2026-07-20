-- General-purpose key/value settings table (currency today, room for more
-- app-wide config later without another one-off table per setting).
create table public.settings (
  key text primary key,
  value jsonb not null
);

insert into public.settings (key, value) values
  ('currency', jsonb_build_object('base', 'USD', 'secondary', 'KHR', 'exchangeRate', 4100));

alter table public.settings enable row level security;

create policy "Authenticated users can read settings" on public.settings
  for select to authenticated
  using (true);

create policy "Admins can insert settings" on public.settings
  for insert to authenticated
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

create policy "Admins can update settings" on public.settings
  for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

-- Exchange rate at the moment of sale, so historical reports don't shift
-- when an admin later changes the rate in Settings.
alter table public.sales add column "exchangeRate" numeric;
