// src/composables/useOfflineCache.ts
// Shared "network-first, fall back to cache when offline" helper. Kept as
// one reusable function rather than one per entity — the shape (try
// network, cache on success, fall back to the last cached value on a
// network failure) is identical everywhere it's used (products, customers,
// settings, sales history, inventory).
const CACHE_PREFIX = 'posCache:v1:'

interface CacheEntry<T> {
  data: T
  cachedAt: string
}

function readCache<T> (key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    return raw ? (JSON.parse(raw) as CacheEntry<T>) : null
  } catch {
    return null
  }
}

function writeCache<T> (key: string, data: T) {
  try {
    const entry: CacheEntry<T> = { data, cachedAt: new Date().toISOString() }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry))
  } catch {
    // Best-effort (e.g. quota exceeded) — never fail the read over this.
  }
}

// A failure that should fall back to cache rather than surface as a real
// error (a genuine validation/RLS failure should still be shown, not
// silently masked by stale data). Exported for useSalesSyncQueue.ts, which
// needs the identical classification to decide "stays queued for later" vs.
// "genuinely failed."
export function isNetworkError (error: unknown): boolean {
  if (!navigator.onLine) {
    return true
  }
  if (error instanceof TypeError) {
    return true // the generic "Failed to fetch" every browser's fetch throws
  }
  const message = error instanceof Error ? error.message : String(error)
  return /network|failed to fetch|load failed/i.test(message)
}

export interface CachedFetchResult<T> {
  data: T
  fromCache: boolean
  cachedAt: string | null
}

export async function cachedFetch<T> (
  key: string,
  fetcher: () => Promise<T>,
  isOnline: boolean,
): Promise<CachedFetchResult<T>> {
  const cached = readCache<T>(key)

  if (!isOnline) {
    if (cached) {
      return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt }
    }
    throw new Error('You are offline and no cached data is available yet.')
  }

  try {
    const data = await fetcher()
    writeCache(key, data)
    return { data, fromCache: false, cachedAt: new Date().toISOString() }
  } catch (error) {
    if (cached && isNetworkError(error)) {
      return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt }
    }
    throw error
  }
}
