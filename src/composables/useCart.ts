import type { CartItem, PaymentMethod, Product, Sale } from '@/types/pos';
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';

export function useCart() {
  const store = useAppStore();

  const cartItems = computed(() => store.cart);

  const itemCount = computed(() =>
    store.cart.reduce((total, item) => total + item.quantity, 0)
  );

  const subtotal = computed(() =>
    roundMoney(
      store.cart.reduce(
        (total, item) => total + item.unitPrice * item.quantity,
        0
      )
    )
  );

  function roundMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  function addToCart(product: Product) {
    if (product.stock <= 0) {
      return { ok: false, message: `${product.name} is out of stock.` };
    }

    const existingItem = store.cart.find(item => item.productId === product.id);

    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        return {
          ok: false,
          message: `Only ${product.stock} ${product.name} available in stock.`,
        };
      }
      existingItem.quantity += 1;
      existingItem.stock = product.stock;
      store.setCart([...store.cart]);
      return { ok: true, message: `${product.name} quantity updated.` };
    }

    store.addToCart({
      productId: product.id,
      name: product.name,
      code: product.code,
      barcode: product.barcode,
      categoryName: product.categoryName ?? 'Uncategorized',
      image: product.image,
      quantity: 1,
      unitPrice: product.price,
      stock: product.stock,
    });

    return { ok: true, message: `${product.name} added to cart.` };
  }

  function increaseQuantity(productId: number) {
    const item = store.cart.find(i => i.productId === productId);
    if (!item) return { ok: false, message: 'Item not found in cart.' };
    if (item.quantity >= item.stock) {
      return {
        ok: false,
        message: `Only ${item.stock} ${item.name} available in stock.`,
      };
    }
    item.quantity += 1;
    store.setCart([...store.cart]);
    return { ok: true, message: `${item.name} quantity updated.` };
  }

  function decreaseQuantity(productId: number) {
    const item = store.cart.find(i => i.productId === productId);
    if (!item) return;
    if (item.quantity <= 1) {
      removeItem(productId);
      return;
    }
    item.quantity -= 1;
    store.setCart([...store.cart]);
  }

  function removeItem(productId: number) {
    store.setCart(store.cart.filter(i => i.productId !== productId));
  }

  function clearCart() {
    store.setCart([]);
  }

  async function checkout(
    discount: number,
    tax: number,
    paymentMethod: PaymentMethod
  ) {
    if (store.cart.length === 0) {
      return { ok: false, message: 'Cart is empty. Add items before checkout.' };
    }

    const safeDiscount = Math.max(0, discount || 0);
    const safeTax = Math.max(0, tax || 0);
    const saleSubtotal = subtotal.value;
    const sale: Sale = {
      id: `SALE-${Date.now()}`,
      date: new Date().toISOString(),
      items: store.cart.map(item => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      subtotal: saleSubtotal,
      discount: roundMoney(safeDiscount),
      tax: roundMoney(safeTax),
      grandTotal: roundMoney(Math.max(0, saleSubtotal - safeDiscount + safeTax)),
      paymentMethod,
    };

    const { addSale } = await import('@/composables/useSupabase');
    try {
      await addSale(sale);
      clearCart();
      return { ok: true, message: 'Payment completed successfully.', sale };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Payment failed. Please try again.',
      };
    }
  }

  return {
    cartItems,
    itemCount,
    subtotal,
    addToCart,
    increaseQuantity,
    decreaseQuantity,
    removeItem,
    clearCart,
    checkout,
  };
}
