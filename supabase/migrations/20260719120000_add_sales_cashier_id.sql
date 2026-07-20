-- Cashier attribution: record which authenticated user rang up each sale.
-- Column name follows the existing camelCase-quoted convention used
-- throughout this schema ("branchId", "categoryId", etc.), since the
-- frontend reads rows straight into typed objects with no name mapping.
alter table public.sales add column "cashierId" uuid references public.profiles(id);

-- Admins need to read every profile to show cashier names in reports
-- (Order History / P&L); previously a user could only read their own row.
create policy "Admins can read all profiles" on public.profiles
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));
