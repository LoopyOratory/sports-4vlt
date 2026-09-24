/**
 * ScoreBat provider — official-source live streams + highlights via ScoreBat's
 * Video API. Embeddable per ScoreBat's terms; carries official-source streams
 * only. Disabled until SCOREBAT_API_TOKEN is set (owner's account).
 * This is a drop-in upgrade path: free tier now (watermark), paid tiers later
 * ($69–299/mo) — neither requires touching the app.
 */
import { providerCache, providerCacheStale } from '../cache'
import type { ProviderLive, WatchMatchRef, WatchOption, WatchProvider } from '../types'

const BASE = 'https://www.scorebat.com/video-api/v3'
const CACHE_KEY = 'scorebat:live'

interface SbVideo {
  title?: string
  embed?: string
  url?: string
}
interface SbMatch {
  title?: string
  competition?: string
  date?: string
  videos?: SbVideo[]
}

async function liveMatches(): Promise<SbMatch[]> {
  const token = process.env.SCOREBAT_API_TOKEN
  if (!token) return []
  try {
    return await providerCache<SbMatch[]>(CACHE_KEY, 'scorebat', 120, async () => {
      const r = await fetch(`${BASE}/live-streams/?token=${encodeURIComponent(token)}`)
      if (!r.ok) throw new Error(`scorebat ${r.status}`)
      const j = (await r.json()) as { response?: SbMatch[] }
      return j.response ?? []
    })
  } catch {
    return providerCacheStale<SbMatch[]>(CACHE_KEY) ?? []
  }
}

function iframeSrc(embed?: string): string | null {
  if (!embed) return null
  const m = embed.match(/src=["']([^"']+)["']/)
  if (!m) return null
  return m[1].startsWith('//') ? `https:${m[1]}` : m[1]
}

function longToken(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= 4)
      .sort((a, b) => b.length - a.length)[0] ?? name.toLowerCase()
  )
}

function toLive(m: SbMatch): ProviderLive | null {
  const embedUrl = iframeSrc(m.videos?.[0]?.embed)
  if (!embedUrl) return null
  return {
    provider: 'scorebat',
    title: m.title ?? 'Live',
    competition: m.competition,
    embedUrl,
    url: m.videos?.[0]?.url,
  }
}

export const scorebatProvider: WatchProvider = {
  id: 'scorebat',
  label: 'ScoreBat',
  embeddable: true,
  enabled: () => Boolean(process.env.SCOREBAT_API_TOKEN),
  async listLive(): Promise<ProviderLive[]> {
    return (await liveMatches()).flatMap((m) => {
      const l = toLive(m)
      return l ? [l] : []
    })
  },
  async optionsFor(match: WatchMatchRef): Promise<WatchOption[]> {
    const tokenLower = (s: string) => s.toLowerCase()
    const home = longToken(match.home)
    const away = longToken(match.away)
    return (await liveMatches())
      .filter((m) => {
        const t = tokenLower(m.title ?? '')
        return t.includes(home) && t.includes(away)
      })
      .flatMap((m) => {
        const embedUrl = iframeSrc(m.videos?.[0]?.embed)
        if (!embedUrl) return []
        return [
          {
            provider: 'scorebat',
            label: `ScoreBat · ${m.competition ?? 'Live'}`,
            kind: 'live-embed' as const,
            embedUrl,
            url: m.videos?.[0]?.url,
            note: 'official-source stream',
          },
        ]
      })
  },
}
