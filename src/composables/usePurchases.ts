import type { Purchase, PurchaseItem } from '@/types/pos'
import {
  addPurchase,
  receivePurchaseStock,
  updatePurchaseStatus,
  voidPurchaseStock,
} from '@/composables/useSupabase'
import { useAuthStore } from '@/stores/auth'

function roundMoney (value: number) {
  return Math.round(value * 100) / 100
}

export interface PurchaseLineInput {
  productId: number
  quantity: number
  unitCost: number
}

export function usePurchases () {
  const authStore = useAuthStore()

  async function createPurchase (
    branchId: number,
    supplierId: number | null,
    lines: PurchaseLineInput[],
  ): Promise<{ ok: true, purchase: Purchase } | { ok: false, message: string }> {
    const requested = lines.filter(line => line.quantity > 0)
    if (requested.length === 0) {
      return { ok: false, message: 'Add at least one line to this purchase.' }
    }
    for (const line of requested) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        return { ok: false, message: 'Quantity must be a positive whole number.' }
      }
      if (!Number.isFinite(line.unitCost) || line.unitCost < 0) {
        return { ok: false, message: 'Unit cost must be zero or higher.' }
      }
    }

    try {
      const received = await receivePurchaseStock(branchId, requested)
      const items: PurchaseItem[] = received.map(line => ({
        productId: line.productId,
        quantity: line.quantity,
        unitCost: line.unitCost,
        previousCost: line.previousCost,
        subtotal: roundMoney(line.unitCost * line.quantity),
      }))
      const subtotal = roundMoney(items.reduce((sum, item) => sum + item.subtotal, 0))

      const purchase: Purchase = {
        id: `PURCHASE-${Date.now()}`,
        date: new Date().toISOString(),
        branchId,
        supplierId,
        items,
        subtotal,
        status: 'completed',
        createdBy: authStore.profile?.id ?? null,
        createdAt: new Date().toISOString(),
      }
      await addPurchase(purchase)

      return { ok: true, purchase }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Unable to record this purchase.',
      }
    }
  }

  async function voidPurchase (
    purchase: Purchase,
    reason = 'Voided',
  ): Promise<{ ok: boolean, message: string }> {
    if (purchase.status !== 'completed') {
      return { ok: false, message: 'Only a completed purchase can be voided.' }
    }

    try {
      // Reverse stock/cost effects first — if the status flip below fails,
      // stock is already correctly reversed and the purchase is left
      // reading "completed" until retried, same accepted risk useRefunds.ts's
      // voidSale() carries for a stuck sale void today.
      await voidPurchaseStock(
        purchase.branchId,
        purchase.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          previousCost: item.previousCost,
        })),
      )
      await updatePurchaseStatus(purchase.id, 'voided', authStore.profile?.id)
      return { ok: true, message: `Purchase voided${reason ? `: ${reason}` : ''}.` }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Unable to void this purchase.',
      }
    }
  }

  return { createPurchase, voidPurchase }
}
