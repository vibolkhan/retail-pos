-- BUGFIX: "Admins can read all profiles" (added in add_sales_cashier_id)
-- queries public.profiles from within a policy defined ON public.profiles,
-- which Postgres flags as self-referential and rejects at runtime with
-- "infinite recursion detected in policy for relation \"profiles\"" — this
-- broke every login (the app's own profile lookup hits this same table).
--
-- Fix: move the admin/manager check into a SECURITY DEFINER function. Such
-- a function runs as its owner (which isn't subject to RLS on profiles, since
-- FORCE ROW LEVEL SECURITY was never set), so its internal query doesn't
-- re-trigger policy evaluation on profiles the way an inline subquery does.
create or replace function public.is_admin_or_manager()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'manager')
  );
$$;

revoke execute on function public.is_admin_or_manager() from public, anon;
grant execute on function public.is_admin_or_manager() to authenticated;

alter policy "Admins can read all profiles" on public.profiles
  using (public.is_admin_or_manager());
