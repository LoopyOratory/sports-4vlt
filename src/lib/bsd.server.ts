import type { BsdParams } from './bsd'
import { cacheKey, cachedGet, cachedGetStale, cachedSet } from './bsd-cache.server'

const BASE_URL = process.env.BSD_BASE_URL ?? 'https://sports.bzzoiro.com/api/v2'

// BSD caps at 10 req/s per IP; parallel loaders (10 per match page) trip it.
// Serialize all outbound calls with a minimum gap so bursts never exceed ~8 rps.
const MIN_GAP_MS = 120
let chain = Promise.resolve()

function throttledFetch(url: string, init: RequestInit): Promise<Response> {
  const run = chain.then(async () => {
    await new Promise((resolve) => setTimeout(resolve, MIN_GAP_MS))
    return fetch(url, init)
  })
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

// Fowler-style circuit breaker: 5 consecutive failures opens the circuit for 15s,
// during which requests fail fast (and serve stale cache instead of hammering BSD).
const BREAKER_FAILURES = 5
const BREAKER_OPEN_MS = 15_000
let consecutiveFailures = 0
let openUntil = 0

function breakerIsOpen(): boolean {
  if (openUntil && Date.now() > openUntil) {
    openUntil = 0
    consecutiveFailures = 0
  }
  return openUntil > 0
}

function recordOutcome(success: boolean): void {
  if (success) {
    consecutiveFailures = 0
    return
  }
  consecutiveFailures += 1
  if (consecutiveFailures >= BREAKER_FAILURES) openUntil = Date.now() + BREAKER_OPEN_MS
}

export async function bsdGet<T>(path: string, params: BsdParams = {}): Promise<T> {
  const token = process.env.BSD_API_TOKEN
  if (!token) throw new Error('BSD_API_TOKEN is not set')

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value))
  }

  const url = `${BASE_URL}${path}${query.size ? `?${query}` : ''}`
  const key = cacheKey(path, query)
  const cached = cachedGet<T>(key)
  if (cached) return cached
  if (breakerIsOpen()) {
    // Breaker open: degraded mode — serve the last-known payload if we have one.
    const stale = cachedGetStale<T>(key)
    if (stale) return stale
    throw new Error(`BSD breaker open on ${path}`)
  }

  const delays = [800, 2_000, 4_000]

  try {
    for (let attempt = 0; ; attempt++) {
      const response = await throttledFetch(url, {
        headers: { Authorization: `Token ${token}` },
        signal: AbortSignal.timeout(15_000),
      })

      if (response.ok) {
        recordOutcome(true)
        const payload = (await response.json()) as T
        cachedSet(key, path, payload)
        return payload
      }
      if (response.status !== 429 && response.status < 500) {
        recordOutcome(false)
        const body = await response.text()
        throw new Error(`BSD ${response.status} on ${path}: ${body.slice(0, 300)}`)
      }
      // 429 = rate limited (possibly with Retry-After) or 5xx: back off, then retry.
      if (attempt >= delays.length) {
        recordOutcome(false)
        throw new Error(`BSD ${response.status} on ${path} after retries`)
      }
      const retryAfter = Number(response.headers.get('retry-after') ?? 0)
      await new Promise((resolve) =>
        setTimeout(resolve, retryAfter > 0 ? retryAfter * 1_000 : delays[attempt]),
      )
    }
  } catch (error) {
    // Upstream failed: stale-serve from L2 (expired rows included).
    const stale = cachedGetStale<T>(key)
    if (stale) return stale
    throw error
  }
}