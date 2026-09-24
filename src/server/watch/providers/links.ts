/**
 * Links provider — the always-legal where-to-watch base layer:
 *  1. curated `stream_map` rows (owner-maintained: broadcasters, bookmaker
 *     streams, radio) matched by competition,
 *  2. BSD's broadcasts endpoint (official TV listings) per match.
 * Never returns embeds — every option is a deep link or an on-air note.
 */
import { and, eq, or } from 'drizzle-orm'
import { db } from '@/db'
import { streamMap } from '@/db/schema'
import { bsdGet } from '@/lib/bsd.server'
import { providerCache, providerCacheStale } from '../cache'
import type { WatchMatchRef, WatchOption, WatchProvider } from '../types'

interface BroadcastRow {
  name?: string
  channel?: string
  broadcaster?: string
  url?: string
  country_code?: string
}

/** Free-text competition name → stable slug used by stream_map. */
export function competitionSlug(name?: string): string {
  if (!name) return ''
  const n = name.toLowerCase()
  if (n.includes('africa cup') || n.includes('afcon')) return 'afcon'
  if (n.includes('world cup')) return 'world-cup'
  if (n.includes('champions league')) return 'uefa-champions-league'
  if (n.includes('ghana')) return 'ghana-premier-league'
  if (n.includes('premier league')) return 'premier-league'
  if (n.includes('europa league')) return 'uefa-europa-league'
  return n.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function broadcastsFor(eventId: number): Promise<BroadcastRow[]> {
  const key = `bsd:broadcasts:${eventId}`
  try {
    return await providerCache<BroadcastRow[]>(key, 'bsd', 3600, async () => {
      const page = await bsdGet<{ results?: BroadcastRow[] }>(`/events/${eventId}/broadcasts/`, {
        country_code: 'GH',
      })
      return page.results ?? []
    })
  } catch {
    return providerCacheStale<BroadcastRow[]>(key) ?? []
  }
}

export const linksProvider: WatchProvider = {
  id: 'links',
  label: 'Where to watch',
  embeddable: false,
  enabled: () => true,
  async optionsFor(match: WatchMatchRef): Promise<WatchOption[]> {
    const slug = match.competitionSlug ?? competitionSlug(match.competitionName)
    const options: WatchOption[] = []

    // 1. Curated map (DB) — competition-specific + catch-all rows
    try {
      const rows = db
        .select()
        .from(streamMap)
        .where(
          and(eq(streamMap.active, true), or(eq(streamMap.competition, slug), eq(streamMap.competition, '*'))),
        )
        .all()
      for (const r of rows.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))) {
        options.push({
          provider: r.provider,
          label: r.label,
          kind: r.kind as WatchOption['kind'],
          url: r.url ?? undefined,
          affiliate: Boolean(r.affiliate),
          note: r.kind === 'tv' && !r.url ? 'on air' : undefined,
        })
      }
    } catch {
      /* table not migrated yet — non-fatal */
    }

    // 2. BSD broadcasts (official listings)
    if (match.eventId) {
      for (const b of await broadcastsFor(match.eventId)) {
        const name = b.name ?? b.channel ?? b.broadcaster
        if (!name) continue
        options.push({
          provider: `broadcast:${slugify(name)}`,
          label: name,
          kind: 'tv',
          url: b.url ?? undefined,
          note: 'official broadcaster',
        })
      }
    }

    return options
  },
}
