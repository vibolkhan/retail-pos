import type { RefundItem, Sale, SaleStatus } from '@/types/pos'
import {
  addRefund,
  getRefundsForSale,
  incrementBranchStock,
  updateSaleStatus,
} from '@/composables/useSupabase'
import { useAuthStore } from '@/stores/auth'

function roundMoney (value: number) {
  return Math.round(value * 100) / 100
}

export function useRefunds () {
  const authStore = useAuthStore()

  // Quantity still refundable per product on this sale, after subtracting
  // everything already refunded/voided against it.
  async function remainingQuantities (sale: Sale): Promise<Map<number, number>> {
    const refunds = await getRefundsForSale(sale.id)
    const refunded = new Map<number, number>()
    for (const refund of refunds) {
      for (const item of refund.items) {
        refunded.set(item.productId, (refunded.get(item.productId) ?? 0) + item.quantity)
      }
    }
    return new Map(
      sale.items.map(item => [item.productId, item.quantity - (refunded.get(item.productId) ?? 0)]),
    )
  }

  // Reverses the loyalty points this sale earned/redeemed, prorated to how
  // much of the sale is being refunded (amount / sale.grandTotal) — a full
  // void refunds 100% of both; a partial refund only claws back/restores
  // its share. Best-effort: the refund itself has already succeeded, so a
  // failure here only degrades the customer's balance, not the refund.
  async function reverseLoyaltyPoints (sale: Sale, refundAmount: number) {
    if (!sale.customerId || (!sale.pointsEarned && !sale.pointsRedeemed)) {
      return
    }

    const fraction = sale.grandTotal > 0 ? Math.min(1, refundAmount / sale.grandTotal) : 1
    const earnedBack = Math.round((sale.pointsEarned ?? 0) * fraction)
    const redeemedBack = Math.round((sale.pointsRedeemed ?? 0) * fraction)
    const netDelta = redeemedBack - earnedBack
    if (netDelta === 0) {
      return
    }

    try {
      const { addLoyaltyTransaction, adjustLoyaltyPoints } = await import('@/composables/useSupabase')
      const balanceAfter = await adjustLoyaltyPoints(sale.customerId, netDelta)
      await addLoyaltyTransaction({
        id: `LOYALTY-${Date.now()}-adjust`,
        customerId: sale.customerId,
        saleId: sale.id,
        type: 'adjust',
        points: netDelta,
        balanceAfter,
        note: 'Refund/void adjustment',
        createdBy: authStore.profile?.id ?? null,
        createdAt: new Date().toISOString(),
      })
    } catch {
      // Best-effort — the refund/void itself already succeeded.
    }
  }

  async function recordRefund (sale: Sale, items: RefundItem[], amount: number, reason: string) {
    await incrementBranchStock(sale.branchId, items)
    await addRefund({
      id: `REFUND-${Date.now()}`,
      saleId: sale.id,
      items,
      amount: roundMoney(amount),
      reason,
      refundedBy: authStore.profile?.id ?? null,
      createdAt: new Date().toISOString(),
    })
    await reverseLoyaltyPoints(sale, amount)
  }

  async function voidSale (sale: Sale, reason = 'Voided') {
    if (sale.status && sale.status !== 'completed') {
      return { ok: false, message: 'Only a completed sale can be voided.' }
    }

    try {
      const items = sale.items.map(item => ({ productId: item.productId, quantity: item.quantity }))
      await recordRefund(sale, items, sale.grandTotal, reason)
      await updateSaleStatus(sale.id, 'voided')
      return { ok: true, message: 'Sale voided and stock restored.' }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Unable to void this sale.',
      }
    }
  }

  async function refundSaleItems (sale: Sale, lines: RefundItem[], reason: string) {
    const requested = lines.filter(line => line.quantity > 0)
    if (requested.length === 0) {
      return { ok: false, message: 'Select at least one item to refund.' }
    }
    if (sale.status === 'voided' || sale.status === 'refunded') {
      return { ok: false, message: 'This sale has already been voided or fully refunded.' }
    }

    try {
      const remaining = await remainingQuantities(sale)
      let amount = 0
      for (const line of requested) {
        const saleItem = sale.items.find(item => item.productId === line.productId)
        if (!saleItem) {
          return { ok: false, message: 'That item is not part of this sale.' }
        }
        const left = remaining.get(line.productId) ?? 0
        if (line.quantity > left) {
          return {
            ok: false,
            message: `Cannot refund more than ${left} remaining ${saleItem.name}.`,
          }
        }
        amount += saleItem.unitPrice * line.quantity
      }

      await recordRefund(sale, requested, amount, reason)

      for (const line of requested) {
        remaining.set(line.productId, (remaining.get(line.productId) ?? 0) - line.quantity)
      }
      const fullyRefunded = [...remaining.values()].every(qty => qty <= 0)
      const status: SaleStatus = fullyRefunded ? 'refunded' : 'partially_refunded'
      await updateSaleStatus(sale.id, status)

      return {
        ok: true,
        message: fullyRefunded ? 'Sale fully refunded.' : 'Selected items refunded.',
        status,
      }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Unable to refund these items.',
      }
    }
  }

  return { remainingQuantities, voidSale, refundSaleItems }
}
