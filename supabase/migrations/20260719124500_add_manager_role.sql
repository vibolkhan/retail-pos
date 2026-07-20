-- 'manager' has the same access as 'admin' throughout the app today; this
-- just permits the value so profiles.role can be set to it.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'manager', 'salesperson'));
