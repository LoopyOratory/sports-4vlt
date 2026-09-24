/**
 * Watch-provider registry — the single place where streaming services are
 * wired into the product.
 *
 * ┌─ STREAMING-INTEGRATION EXTENSION POINT ─────────────────────────────────┐
 * │ To plug in a streaming service later (official or a licensed aggregator │
 * │ the owner chooses):                                                     │
 * │   1. implement `WatchProvider` in providers/<name>.ts,                  │
 * │   2. import it here and add it to the `providers` list,                 │
 * │   3. gate it inside its own `enabled()` (env flag).                     │
 * │ Nothing else changes — every watch surface (match centre, tv-guide,     │
 * │ live strips) consumes the normalized WatchOption[]/ProviderLive[] below.│
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Active today: youtube (official channels, free), scorebat (official-source
 * aggregator, env-gated), links (curated map + BSD listings — always on).
 */
import { linksProvider } from './providers/links'
import { scorebatProvider } from './providers/scorebat'
import { youtubeProvider } from './providers/youtube'
import type { ProviderLive, WatchMatchRef, WatchOption, WatchProvider } from './types'

const providers: WatchProvider[] = [youtubeProvider, scorebatProvider, linksProvider]

export function watchProviders(): WatchProvider[] {
  return providers.filter((p) => p.enabled())
}

/** Register an extra provider at runtime (tests, future adapters). */
export function registerWatchProvider(p: WatchProvider): void {
  providers.push(p)
}

const KIND_WEIGHT: Record<WatchOption['kind'], number> = {
  'live-embed': 0,
  highlights: 1,
  stream: 2,
  tv: 3,
  'bookmaker-stream': 4,
  radio: 5,
}

/** All watch options for one match, providers merged, deduped, sorted. */
export async function getWatchOptions(match: WatchMatchRef): Promise<WatchOption[]> {
  const settled = await Promise.allSettled(
    watchProviders().map((p) => p.optionsFor?.(match) ?? Promise.resolve<WatchOption[]>([])),
  )
  const seen = new Set<string>()
  const out: WatchOption[] = []
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue
    for (const o of r.value) {
      const dedupe = `${o.kind}|${o.label}|${o.url ?? o.embedUrl ?? ''}`
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
      out.push(o)
    }
  }
  return out.sort((a, b) => KIND_WEIGHT[a.kind] - KIND_WEIGHT[b.kind])
}

/** Currently-live items across embeddable providers (live strips / guides). */
export async function getLiveWatch(): Promise<ProviderLive[]> {
  const settled = await Promise.allSettled(
    watchProviders().map((p) => p.listLive?.() ?? Promise.resolve<ProviderLive[]>([])),
  )
  return settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}
