-- carts and cart_items are unused by the app (cart state lives in
-- localStorage via the Pinia store); both are empty.
drop table if exists public.cart_items;
drop table if exists public.carts;
