import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { ttlForPath, ttlToExpiresMs } from './bsd-ttl'

const dataDir = join(process.cwd(), 'data')
mkdirSync(dataDir, { recursive: true })

const db = new Database(join(dataDir, 'bsd-cache.sqlite'))
db.exec('PRAGMA journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )
`)

const getStmt = db.prepare('SELECT payload, expires_at FROM cache WHERE key = ? AND expires_at > ?')
const getStaleStmt = db.prepare('SELECT payload FROM cache WHERE key = ?')
const setStmt = db.prepare(
  'INSERT OR REPLACE INTO cache (key, payload, expires_at) VALUES (?, ?, ?)',
)
const delStmt = db.prepare('DELETE FROM cache WHERE key = ?')

// ── L1: in-process LRU (ported from the LiveBall cache layer 2026-09-24) ────
// Absorbs hot reads during live-match windows without touching sqlite.
// L1 entries mirror the L2 expiry, so freshness rules are identical.
const MEMORY_MAX = 500
const memCache = new Map<string, { value: unknown; expires: number }>()

function memGet<T>(key: string): T | null {
  const hit = memCache.get(key)
  if (!hit) return null
  if (hit.expires <= Date.now()) {
    memCache.delete(key)
    return null
  }
  // refresh LRU position
  memCache.delete(key)
  memCache.set(key, hit)
  return hit.value as T
}

function memSet(key: string, value: unknown, expires: number): void {
  if (memCache.size >= MEMORY_MAX) {
    const first = memCache.keys().next().value
    if (first !== undefined) memCache.delete(first)
  }
  memCache.set(key, { value, expires })
}

// ── L2: sqlite ───────────────────────────────────────────────────────────────

export function cacheKey(path: string, query: URLSearchParams): string {
  return `${path}?${query.toString()}`
}

/** Fresh read (L1 → L2). */
export function cachedGet<T>(key: string): T | null {
  const mem = memGet<T>(key)
  if (mem !== null) return mem

  const row = getStmt.get(key, Date.now()) as { payload: string; expires_at: number } | null
  if (!row) return null
  const value = JSON.parse(row.payload) as T
  memSet(key, value, row.expires_at)
  return value
}

/**
 * Stale-tolerant read — returns the last stored payload even if EXPIRED.
 * Used by the upstream-failure fallback: serve yesterday's standings rather
 * than a 5xx page when BSD is down or the breaker is open.
 */
export function cachedGetStale<T>(key: string): T | null {
  const row = getStaleStmt.get(key) as { payload: string } | null
  return row ? (JSON.parse(row.payload) as T) : null
}

/**
 * Write-through (L1 + L2). TTL resolution: explicit `ttlSeconds` wins;
 * otherwise the per-resource matrix in `bsd-ttl.ts` classifies the path.
 */
export function cachedSet(key: string, path: string, payload: unknown, ttlSeconds?: number): void {
  const ttl = ttlSeconds ?? ttlForPath(path)
  const expires = ttlToExpiresMs(ttl)
  setStmt.run(key, JSON.stringify(payload), expires)
  memSet(key, payload, expires)
}

/** Drop one key from both layers (e.g. after an admin edit invalidates data). */
export function cacheInvalidate(key: string): void {
  memCache.delete(key)
  delStmt.run(key)
}
