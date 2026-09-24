/**
 * YouTube provider — OFFICIAL broadcaster channels only (CAF TV, TV3, Onua…).
 * Two modes:
 *  - YOUTUBE_API_KEY set → Data API (handle→id, eventType=live search).
 *    Free quota (10k units/day) is plenty at our call pattern.
 *  - no key → keyless scrape of the channel `/streams` page (best effort).
 * Only official channels are tracked here — no user-submitted or rehosted feeds.
 */
import { providerCache } from '../cache'
import type { ProviderLive, WatchMatchRef, WatchOption, WatchProvider } from '../types'

interface ChannelCfg {
  handle: string
  id?: string
  label: string
  /** competition slug this channel carries — '*' = anything */
  competition: string
}

const CHANNELS: ChannelCfg[] = [
  { handle: 'CAF_TV', id: 'UCr5K057x3mHroPHsNk9OiwA', label: 'CAF TV', competition: 'afcon' },
  { handle: 'TV3Ghana', label: 'TV3 Ghana', competition: 'ghana-premier-league' },
  { handle: 'onuatv', label: 'Onua TV', competition: 'ghana-premier-league' },
  { handle: 'FIFA', label: 'FIFA', competition: '*' },
]

const HEADERS: Record<string, string> = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'accept-language': 'en-US,en;q=0.9',
  cookie: 'CONSENT=YES+cb',
}

interface LiveItem {
  id: string
  title: string
}

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url, { headers: HEADERS })
  if (!r.ok) throw new Error(`youtube fetch ${r.status} ${url}`)
  return await r.text()
}

async function resolveChannelId(cfg: ChannelCfg): Promise<string | null> {
  if (cfg.id) return cfg.id
  return providerCache<string | null>(`youtube:chid:${cfg.handle}`, 'youtube', 86400, async () => {
    try {
      const html = await fetchText(`https://www.youtube.com/@${cfg.handle}?hl=en`)
      const m =
        html.match(/"channelId":"(UC[0-9A-Za-z_-]{22})"/) ??
        html.match(/"externalId":"(UC[0-9A-Za-z_-]{22})"/)
      return m?.[1] ?? null
    } catch {
      return null
    }
  })
}

function decodeJsonText(s: string): string {
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

/** Best-effort parse of a channel /streams page for currently-live entries. */
export function parseStreamsPage(html: string): LiveItem[] {
  const out: LiveItem[] = []
  const seen = new Set<string>()

  // Current layout: lockupViewModel entries. Live ones carry the
  // THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE badge; the video id sits on the badge's
  // animationActivationTargetId (validated against live channels 2026-09).
  for (const part of html.split('"lockupViewModel":{').slice(1)) {
    const seg = part.slice(0, 20000)
    if (!seg.includes('BADGE_STYLE_LIVE')) continue
    const id =
      seg.match(/"animationActivationTargetId":"([A-Za-z0-9_-]{11})"/)?.[1] ??
      part.match(/"contentId":"([A-Za-z0-9_-]{11})"/)?.[1] ??
      seg.match(/"videoId":"([A-Za-z0-9_-]{11})"/)?.[1]
    if (!id || seen.has(id)) continue
    seen.add(id)
    const title =
      seg.match(/"lockupMetadataViewModel":\{"title":\{"content":"((?:[^"\\]|\\.)*)"/)?.[1] ??
      seg.match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/)?.[1] ??
      ''
    out.push({ id, title: decodeJsonText(title) })
  }

  // Legacy layout fallback: videoRenderer entries with LIVE overlays.
  for (const part of html.split('"videoRenderer":{').slice(1)) {
    const id = part.match(/"videoId":"([A-Za-z0-9_-]{11})"/)?.[1]
    if (!id || seen.has(id)) continue
    const seg = part.slice(0, 6000)
    if (seg.includes('"isLiveNow":true') || seg.includes('"style":"LIVE"')) {
      seen.add(id)
      const title = seg.match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/)?.[1] ?? ''
      out.push({ id, title: decodeJsonText(title) })
    }
  }

  return out.slice(0, 3)
}

async function apiLive(channelId: string): Promise<LiveItem[]> {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) return []
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&maxResults=3&key=${encodeURIComponent(key)}`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`youtube api ${r.status}`)
  const j = (await r.json()) as {
    items?: { id?: { videoId?: string }; snippet?: { title?: string } }[]
  }
  return (j.items ?? []).flatMap((it) =>
    it.id?.videoId ? [{ id: it.id.videoId, title: it.snippet?.title ?? '' }] : [],
  )
}

async function channelLives(cfg: ChannelCfg): Promise<LiveItem[]> {
  const channelId = await resolveChannelId(cfg)
  if (!channelId) return []
  return providerCache<LiveItem[]>(`youtube:live:${channelId}`, 'youtube', 120, async () => {
    try {
      if (process.env.YOUTUBE_API_KEY) return await apiLive(channelId)
      const html = await fetchText(`https://www.youtube.com/channel/${channelId}/streams?hl=en`)
      return parseStreamsPage(html)
    } catch {
      return []
    }
  })
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

function competitionMatches(providerComp: string, slug?: string): boolean {
  if (providerComp === '*') return true
  if (!slug) return false
  return providerComp === slug || slug.includes(providerComp)
}

async function listAll(): Promise<ProviderLive[]> {
  const out: ProviderLive[] = []
  for (const cfg of CHANNELS) {
    const lives = await channelLives(cfg)
    for (const l of lives) {
      out.push({
        provider: `youtube:${cfg.handle.toLowerCase()}`,
        channel: cfg.label,
        title: l.title || cfg.label,
        competition: cfg.competition,
        embedUrl: `https://www.youtube-nocookie.com/embed/${l.id}`,
        url: `https://www.youtube.com/watch?v=${l.id}`,
      })
    }
  }
  return out
}

export const youtubeProvider: WatchProvider = {
  id: 'youtube',
  label: 'YouTube (official channels)',
  embeddable: true,
  enabled: () => process.env.WATCH_YOUTUBE !== 'off',
  listLive: listAll,
  async optionsFor(match: WatchMatchRef): Promise<WatchOption[]> {
    const lives = (await listAll()).filter((l) => competitionMatches(l.competition ?? '*', match.competitionSlug))
    const naming = lives.filter((l) => {
      const t = l.title.toLowerCase()
      return t.includes(longToken(match.home)) && t.includes(longToken(match.away))
    })
    const chosen = naming.length ? naming : lives
    return chosen.map((l) => ({
      provider: l.provider,
      label: `YouTube · ${l.channel ?? l.provider.split(':')[1] ?? ''}`.trim(),
      kind: 'live-embed' as const,
      embedUrl: l.embedUrl,
      url: l.url,
      note: 'free · official channel',
    }))
  },
}
