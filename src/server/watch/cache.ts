/**
 * Two-tier cache for watch providers: process-local L1 (Map) over the sqlite
 * `stream_cache` table (L2). Providers call `providerCache()` so a dead API or
 * an offline box degrades to last-known payloads instead of empty screens.
 */
import { and, eq, gt } from 'drizzle-orm'
import { db } from '@/db'
import { streamCache } from '@/db/schema'

const L1 = new Map<string, { v: unknown; exp: number }>()

export async function providerCache<T>(
  key: string,
  provider: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T> {
  const now = Date.now()

  const mem = L1.get(key)
  if (mem && mem.exp > now) return mem.v as T

  const row = db
    .select()
    .from(streamCache)
    .where(and(eq(streamCache.key, key), gt(streamCache.expiresAt, now)))
    .get()
  if (row) {
    try {
      const v = JSON.parse(row.payload) as T
      L1.set(key, { v, exp: row.expiresAt })
      return v
    } catch {
      /* fall through to refetch */
    }
  }

  const v = await fn()
  const exp = now + ttlSeconds * 1000
  const payload = JSON.stringify(v)
  try {
    db.insert(streamCache)
      .values({ key, provider, payload, expiresAt: exp })
      .onConflictDoUpdate({
        target: streamCache.key,
        set: { provider, payload, expiresAt: exp },
      })
      .run()
  } catch {
    /* cache write is best-effort */
  }
  L1.set(key, { v, exp })
  return v
}

/**
 * Last-known payload regardless of expiry — degraded-mode reads for when the
 * upstream is down (mirrors the BSD stale-serve policy).
 */
export function providerCacheStale<T>(key: string): T | null {
  const row = db.select().from(streamCache).where(eq(streamCache.key, key)).get()
  if (!row) return null
  try {
    return JSON.parse(row.payload) as T
  } catch {
    return null
  }
}
