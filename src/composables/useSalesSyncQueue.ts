// src/composables/useSalesSyncQueue.ts
//
// Offline checkout queue. useCart.ts's checkout() never talks to Supabase
// directly — it enqueues a fully-built Sale here and calls processQueueEntry()
// immediately; if that doesn't finish (offline, or a network error mid-way),
// the entry stays in the queue and flush() (triggered on reconnect, on a
// timer, and opportunistically on page mount — see App.vue/PosPage.vue/
// CartPage.vue) resumes it later with the exact same function. There is
// only one implementation of "how a sale gets applied," used both live and
// on replay, so it can't double-apply a step or drift between the two paths.
import type { Sale } from '@/types/pos'
import { computed, reactive } from 'vue'
import { isNetworkError } from '@/composables/useOfflineCache'
import { useOnline } from '@/composables/useOnline'

type StepStatus = 'pending' | 'done' | 'skipped'

export interface QueuedSaleSteps {
  saleInserted: StepStatus
  stockDecremented: StepStatus
  redeemApplied: StepStatus
  redeemLedgerWritten: StepStatus
  earnApplied: StepStatus
  earnLedgerWritten: StepStatus
}

export interface QueuedSaleLoyalty {
  customerId: number
  redeemPoints: number
  earnPoints: number
}

export interface QueuedSale {
  sale: Sale
  loyalty: QueuedSaleLoyalty | null
  steps: QueuedSaleSteps
  redeemBalanceAfter: number | null
  earnBalanceAfter: number | null
  // 'failed' means "stop retrying automatically, a human should look at
  // this" — either the sale itself never landed for a real (non-network)
  // reason, or a later step kept hitting a real error past the retry cap.
  status: 'queued' | 'failed'
  attempts: number
  lastError: string | null
  queuedAt: string
}

const QUEUE_STORAGE_KEY = 'posQueue:v1:sales'
const MAX_ATTEMPTS = 5

function readQueue (): QueuedSale[] {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as QueuedSale[]) : []
  } catch {
    return []
  }
}

function writeQueue (queue: QueuedSale[]) {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // Best-effort — a full localStorage must never lose an already-recorded
    // sale from memory, it just won't survive a tab close until freed up.
  }
}

// Module-level singleton (same pattern as useToast.ts): one persisted queue
// shared by every component in this tab.
const state = reactive({
  queue: readQueue() as QueuedSale[],
})

function persist () {
  writeQueue(state.queue)
}

function initialSteps (loyalty: QueuedSaleLoyalty | null): QueuedSaleSteps {
  return {
    saleInserted: 'pending',
    stockDecremented: 'pending',
    redeemApplied: loyalty && loyalty.redeemPoints > 0 ? 'pending' : 'skipped',
    redeemLedgerWritten: loyalty && loyalty.redeemPoints > 0 ? 'pending' : 'skipped',
    earnApplied: loyalty && loyalty.earnPoints > 0 ? 'pending' : 'skipped',
    earnLedgerWritten: loyalty && loyalty.earnPoints > 0 ? 'pending' : 'skipped',
  }
}

// A Postgres unique_violation on retrying the sale insert means an earlier
// attempt already landed (the id is client-generated, so retrying the same
// insert is otherwise safe) — useSupabase.ts's handleError() collapses the
// original error down to a plain message, so this is a string match rather
// than a `.code === '23505'` check.
function isDuplicateKeyError (error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /duplicate key value violates unique constraint/i.test(message)
}

function messageOf (error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error.'
}

function enqueue (sale: Sale, loyalty: QueuedSaleLoyalty | null): QueuedSale {
  const entry: QueuedSale = {
    sale,
    loyalty,
    steps: initialSteps(loyalty),
    redeemBalanceAfter: null,
    earnBalanceAfter: null,
    status: 'queued',
    attempts: 0,
    lastError: null,
    queuedAt: new Date().toISOString(),
  }
  state.queue.push(entry)
  persist()
  // Return the reactive proxy Vue wrapped around the pushed object (not the
  // raw `entry` above) — mutations below need to go through it for
  // pendingCount/failedCount to update reactively in the UI.
  return state.queue.at(-1)!
}

function removeEntry (entry: QueuedSale) {
  const index = state.queue.indexOf(entry)
  if (index !== -1) {
    state.queue.splice(index, 1)
    persist()
  }
}

// Every step still 'pending' means processing stopped early (offline, or a
// network error) — the entry stays in the queue for a later attempt.
export function isFullyResolved (entry: QueuedSale): boolean {
  return Object.values(entry.steps).every(status => status !== 'pending')
}

// Walks an entry's steps in order, skipping whatever's already done/skipped,
// persisting to localStorage after every individual step so a tab close
// mid-sync can never lose track of what already landed. Stops the moment
// we're offline or hit a network-classified error — the remaining steps
// stay 'pending' for the next flush()/live attempt to pick up.
async function processQueueEntry (entry: QueuedSale): Promise<void> {
  if (!useOnline().state.isOnline) {
    return
  }

  entry.attempts += 1

  const {
    addLoyaltyTransaction,
    addSale,
    adjustLoyaltyPoints,
    decrementBranchStock,
  } = await import('@/composables/useSupabase')

  if (entry.steps.saleInserted === 'pending') {
    try {
      await addSale(entry.sale)
      entry.steps.saleInserted = 'done'
      persist()
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        entry.steps.saleInserted = 'done'
        persist()
      } else if (isNetworkError(error)) {
        persist()
        return
      } else {
        // Genuine failure (bad data/RLS) — the sale was never recorded.
        // Left in the queue as 'failed' (not removed here) so a background
        // flush doesn't lose track of it; useCart.ts's checkout() removes
        // it itself for the live/first-attempt case, where nothing has been
        // shown to the cashier as "recorded" yet.
        entry.status = 'failed'
        entry.lastError = messageOf(error)
        persist()
        return
      }
    }
  }

  if (entry.steps.stockDecremented === 'pending') {
    try {
      await decrementBranchStock(
        entry.sale.branchId,
        entry.sale.items.map(({ productId, quantity }) => ({ productId, quantity })),
      )
      entry.steps.stockDecremented = 'done'
      persist()
    } catch (error) {
      if (isNetworkError(error)) {
        persist()
        return
      }
      // Non-fatal, matching the pre-queue behavior: the sale is already
      // recorded, so a real (non-network) stock-update failure doesn't
      // block the rest of this entry — just stop retrying this one step.
      entry.steps.stockDecremented = 'skipped'
      entry.lastError = messageOf(error)
      persist()
    }
  }

  if (entry.loyalty) {
    const { customerId, redeemPoints, earnPoints } = entry.loyalty

    if (entry.steps.redeemApplied === 'pending') {
      try {
        entry.redeemBalanceAfter = await adjustLoyaltyPoints(customerId, -redeemPoints)
        entry.steps.redeemApplied = 'done'
        persist()
      } catch (error) {
        if (isNetworkError(error)) {
          persist()
          return
        }
        entry.steps.redeemApplied = 'skipped'
        entry.steps.redeemLedgerWritten = 'skipped'
        entry.lastError = messageOf(error)
        persist()
      }
    }

    if (entry.steps.redeemApplied === 'done' && entry.steps.redeemLedgerWritten === 'pending') {
      try {
        await addLoyaltyTransaction({
          id: `LOYALTY-${Date.now()}-redeem`,
          customerId,
          saleId: entry.sale.id,
          type: 'redeem',
          points: -redeemPoints,
          balanceAfter: entry.redeemBalanceAfter!,
          createdBy: entry.sale.cashierId ?? null,
          createdAt: new Date().toISOString(),
        })
        entry.steps.redeemLedgerWritten = 'done'
        persist()
      } catch (error) {
        if (isNetworkError(error)) {
          persist()
          return
        }
        entry.steps.redeemLedgerWritten = 'skipped'
        entry.lastError = messageOf(error)
        persist()
      }
    }

    if (entry.steps.earnApplied === 'pending') {
      try {
        entry.earnBalanceAfter = await adjustLoyaltyPoints(customerId, earnPoints)
        entry.steps.earnApplied = 'done'
        persist()
      } catch (error) {
        if (isNetworkError(error)) {
          persist()
          return
        }
        entry.steps.earnApplied = 'skipped'
        entry.steps.earnLedgerWritten = 'skipped'
        entry.lastError = messageOf(error)
        persist()
      }
    }

    if (entry.steps.earnApplied === 'done' && entry.steps.earnLedgerWritten === 'pending') {
      try {
        await addLoyaltyTransaction({
          id: `LOYALTY-${Date.now()}-earn`,
          customerId,
          saleId: entry.sale.id,
          type: 'earn',
          points: earnPoints,
          balanceAfter: entry.earnBalanceAfter!,
          createdBy: entry.sale.cashierId ?? null,
          createdAt: new Date().toISOString(),
        })
        entry.steps.earnLedgerWritten = 'done'
        persist()
      } catch (error) {
        if (isNetworkError(error)) {
          persist()
          return
        }
        entry.steps.earnLedgerWritten = 'skipped'
        entry.lastError = messageOf(error)
        persist()
      }
    }
  }

  persist()
}

let flushing = false

async function flushLocked () {
  // A copy so entries removed mid-loop (fully resolved) don't shift
  // indices out from under the iteration.
  for (const entry of state.queue.slice()) {
    if (entry.status === 'failed') {
      continue
    }
    if (!useOnline().state.isOnline) {
      break
    }

    await processQueueEntry(entry)

    if (isFullyResolved(entry)) {
      removeEntry(entry)
      continue
    }
    if (entry.status === 'failed') {
      // A real (non-network) failure on this entry doesn't mean the
      // connection is down — keep trying the rest of the queue.
      continue
    }
    if (entry.attempts >= MAX_ATTEMPTS) {
      entry.status = 'failed'
      persist()
      continue
    }
    // Still pending with no failure recorded means processQueueEntry
    // stopped for a network reason — an outage would fail every
    // subsequent entry too, so stop burning through the rest of the queue.
    break
  }
}

// Triggered on reconnect, on a timer, and opportunistically on page mount
// (see App.vue/PosPage.vue/CartPage.vue). Wrapped in the Web Locks API when
// available so two tabs on the same device can't both flush the same queue
// at once — the stock/loyalty RPCs aren't idempotent the way the sale
// insert is, so a genuine double-decrement/double-credit is possible
// without this.
async function flush (): Promise<void> {
  if (flushing || !useOnline().state.isOnline) {
    return
  }
  flushing = true
  try {
    await ('locks' in navigator
      ? navigator.locks.request('pos-sales-queue-flush', flushLocked)
      : flushLocked())
  } finally {
    flushing = false
  }
}

const pendingCount = computed(() => state.queue.filter(entry => entry.status === 'queued').length)
const failedCount = computed(() => state.queue.filter(entry => entry.status === 'failed').length)

export function useSalesSyncQueue () {
  return {
    state,
    pendingCount,
    failedCount,
    enqueue,
    removeEntry,
    processQueueEntry,
    flush,
  }
}
