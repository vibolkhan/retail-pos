// src/composables/useSupabase.ts
import { supabase } from "@/utils/supabase";

import type {
  CartItem,
  Category,
  Product,
  Sale,
} from "@/types/pos";

// Export payload type for product inventory (matches mock API)
export type ProductInventoryPayload = Omit<Product, "id" | "categoryName">;

// Helper to handle Supabase errors
function handleError(error: any) {
  if (error) {
    throw new Error(error.message ?? "Supabase request failed");
  }
}
// Helper to ensure data is not null/undefined
function ensureData<T>(data: T | null | undefined): T {
  if (data == null) {
    throw new Error('Supabase query returned null where data was expected');
  }
  return data;
}
// Categories
export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select();
  handleError(error);
  return (data ?? []) as Category[];
}

// Products (active and inactive)
export async function getProducts(): Promise<Product[]> {
  const [
    { data: products, error: prodError },
    { data: categories, error: catError },
  ] = await Promise.all([
    supabase.from("products").select(),
    supabase.from("categories").select(),
  ]);
  handleError(prodError);
  handleError(catError);
  const categoryMap = new Map<number, string>();
  categories?.forEach((cat) => categoryMap.set(cat.id, cat.name));
  return (products as Product[]).map((p) => ({
    ...p,
    categoryName: categoryMap.get(p.categoryId) ?? "",
  }));
}

// Inventory – returns all products with their category name
export async function getInventoryProducts(): Promise<Product[]> {
  const [
    { data: products, error: prodError },
    { data: categories, error: catError },
  ] = await Promise.all([
    supabase.from("products").select(),
    supabase.from("categories").select(),
  ]);
  handleError(prodError);
  handleError(catError);
  const categoryMap = new Map<number, string>();
  categories?.forEach((cat) => categoryMap.set(cat.id, cat.name));
  return (products as Product[]).map((p) => ({
    ...p,
    categoryName: categoryMap.get(p.categoryId) ?? "",
  }));
}

// Create/Update product inventory payload (excluding id and categoryName)
export async function createProductInventory(
  payload: ProductInventoryPayload,
): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .insert([payload])
    .single();
  handleError(error);
  return ensureData(data) as Product;
}

export async function updateProductInventory(
  payload: ProductInventoryPayload & { id: number },
): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .update(payload)
    .eq("id", payload.id)
    .single();
  handleError(error);
  return ensureData(data) as Product;
}

// Cart
export async function getCart(): Promise<CartItem[]> {
  const { data, error } = await supabase.from("cart_items").select();
  handleError(error);
  return (data ?? []) as CartItem[];
}

export async function saveCart(items: CartItem[]): Promise<void> {
  // Upsert each cart item; Supabase will insert if not exists, update otherwise
  const { error } = await supabase.from("cart_items").upsert(items);
  handleError(error);
}

// Sales
export async function getSales(): Promise<Sale[]> {
  const { data, error } = await supabase.from("sales").select();
  handleError(error);
  return (data ?? []) as Sale[];
}

export async function addSale(sale: Sale): Promise<void> {
  const { error } = await supabase.from("sales").insert([sale]);
  handleError(error);
}
