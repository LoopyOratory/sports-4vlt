/**
 * Watch-layer contracts.
 *
 * The app never talks to a specific streaming service directly — match pages
 * and watch surfaces consume `WatchOption[]` produced by registered
 * `WatchProvider`s (see registry.ts). Any streaming service can be added later
 * by implementing this interface — the rest of the app does not change.
 */

export type WatchKind =
  | 'live-embed' // embeddable live video (official channels, ScoreBat, ...)
  | 'highlights' // post-match highlights / clips
  | 'stream' // broadcaster's own free stream (deep link)
  | 'tv' // linear TV channel carrying it (deep link or on-air note)
  | 'bookmaker-stream' // bookmaker live stream (affiliate deep link)
  | 'radio'

export interface WatchOption {
  /** stable provider id: 'youtube:caf-tv' | 'scorebat' | 'tv3' | 'sportytv' | ... */
  provider: string
  label: string
  kind: WatchKind
  /** iframe-able URL (only set when the provider's terms allow embedding) */
  embedUrl?: string
  /** deep link out */
  url?: string
  hd?: boolean
  language?: string
  affiliate?: boolean
  /** short human note, e.g. 'free · CAF's official channel' */
  note?: string
}

/** A currently-live item a provider can enumerate (for live strips / guides). */
export interface ProviderLive {
  provider: string
  title: string
  /** display name of the carrying channel, when applicable */
  channel?: string
  home?: string
  away?: string
  embedUrl?: string
  url?: string
  competition?: string
}

/** The match context providers receive for per-match resolution. */
export interface WatchMatchRef {
  eventId: number
  home: string
  away: string
  competitionSlug?: string
  competitionName?: string
  kickoff?: string
}

export interface WatchProvider {
  /** stable id — also the `provider` column value in stream_map/stream_cache */
  id: string
  label: string
  /** true when this provider can return iframe-embeddable media */
  embeddable: boolean
  /** env/config gate — false providers are filtered out of the registry */
  enabled(): boolean
  /** enumerate currently-live items (best effort, cached) */
  listLive?(): Promise<ProviderLive[]>
  /** resolve watch options for one match (best effort, cached) */
  optionsFor?(match: WatchMatchRef): Promise<WatchOption[]>
}
