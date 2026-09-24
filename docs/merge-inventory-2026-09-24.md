# Merge Inventory — LiveBall → sports-4vlt
**2026-09-24 · classification of every LiveBall source file for the merge into the sports-4vlt codebase**

Legend: **PORT** = logic moves over (adapted to sports-4vlt patterns: server functions instead of Hono routers, new design tokens/routes per the approved IA). **STRIP** = valuable file minus streamed-coupled blocks. **EXCLUDE** = not carried into the merged product.

## EXCLUDE — streamed.pk / streamed.st coupling (not ported)
| File | Why |
|---|---|
| `src/server/streamed.ts` | The streamed.pk API client itself |
| `src/server/routers/streams.ts` | Stream fetching from streamed.* |
| `src/server/routers/streams-available.ts` | Both endpoints are 100% `streamed:matches:*` |
| `src/routes/streams.tsx` | Stream page built on streamed.* embeds |
| `src/components/dashboard/streaming-list.tsx` | Dashboard streameds list (replaced by the Watch panel) |
| `src/lib/stream-match.ts` | BSD↔streamed team-name matcher |
| `STREAMED_IMG` in `src/lib/constants.ts` | streamed image CDN constant |
| `streamedBadgeUrl` / `streamedPosterUrl` in `src/lib/formatters.ts` | streamed image URLs (BSD image proxy covers this — `/img/team/{id}/`) |
| `streamed.pk` CSP allowance in `src/server/middleware/securityHeaders.ts` | Remove from `img-src` |
| `STREAMED_*` entries in `src/server/ttl.ts` | Stream TTLs |
| "Streamed" error branch in `src/server/middleware/errorHandler.ts` | Cosmetic |

**Watch layer substitute (merged product):** legal providers only — YouTube official channel embeds (CAF TV / TV3 / Onua / MaxTV live detection), ScoreBat (free highlights; paid live-streams endpoint as a one-env upgrade), BSD broadcasts + broadcaster/bookmaker deep links. Provider-pluggable by design. See `/opt/data/workspace/research/streaming-alternatives-2026-09.md`.

## STRIP — port the rest, remove streamed blocks during adaptation
| File | Lines | Streamed parts to strip |
|---|---|---|
| `src/routes/game.$id.tsx` | 800 | "Watch Stream" button + streamed embed player block; keep the full match-centre structure (tabs, header, data loading) |
| `src/routes/live.tsx` | 247 | Streaming section; keep BSD live-events feed |

## PORT — the merge value (≈10.3k lines before adaptation)
### Server / data layer
| File | Lines | Notes |
|---|---|---|
| `src/server/bsd.ts` | 358 | BSD v2 client + Zod schemas for every endpoint — the endpoint catalogue |
| `src/server/cache.ts` | 104 | sqlite L2 cache + memory LRU pattern |
| `src/server/ttl.ts` (minus STREAMED_*) | ~85 | Per-resource TTL matrix |
| `src/server/routers/events.ts` | 138 | → server functions |
| `src/server/routers/odds.ts` | 116 | → server functions |
| `src/server/routers/leagues.ts` | 82 | → server functions |
| `src/server/routers/players.ts` · `teams.ts` · `managers.ts` · `referees.ts` · `venues.ts` · `broadcasts.ts` · `tvchannels.ts` · `social.ts` · `worldcup.ts` · `predictions.ts` · `bookmakers.ts` · `search.ts` · `events-today.ts` | ~700 total | → server functions; `broadcasts`/`tvchannels` power the Watch layer |
| `src/server/middleware/rateLimit.ts` | — | Adapt to app-level rate limiting |

### Routes / pages
| File | Lines | Notes |
|---|---|---|
| `game.$id.tsx` (stripped) | ~780 | Match centre: header, facts, stats, lineups, H2H, incidents, player ratings |
| `worldcup.tsx` | 735 | → becomes the AFCON 2027 + tournament hub pattern |
| `teams.$id.tsx` | 624 | Squad + fixtures + transfers |
| `players.$id.tsx` | 334 | Attributes + stats + career |
| `leagues.$id.tsx` + `leagues.index.tsx` | 547 | Season selector, standings, fixtures |
| `managers.$id.tsx` · `referees.$id.tsx` | 270 | Career + match history |
| `live.tsx` (stripped) | ~200 | BSD live-events feed |
| `predictions.tsx` | 285 | Grid (folds into sports-4vlt predictions suite) |
| `odds.tsx` | 173 | Best-odds table (folds into odds suite) |

### Hooks
| `src/hooks/use-events.ts` | 709 | Live polling + query hooks — adapt to TanStack Query patterns already in sports-4vlt |

### Components
| File | Lines |
|---|---|
| `components/game/facts-tab.tsx` | 576 |
| `components/game/stats-tab.tsx` | 465 |
| `components/dashboard/standings-leaderboard.tsx` | 276 |
| `components/dashboard/hero-match.tsx` | 272 |
| `components/dashboard/trending-odds.tsx` | 207 |
| `components/dashboard/scoreboard-slider.tsx` | 169 |
| `components/dashboard/upcoming-grid.tsx` | 100 |
| `components/worldcup/tournament-bracket.tsx` | 174 |
| `components/shared/match-card.tsx` · `search-dialog.tsx` · `pagination.tsx` · `loading-skeleton.tsx` | ~690 |
| `components/shared/team-logo.tsx` | 88 | Rewire: BSD image proxy only (drop streamed fallback) |
| `components/layout/sidebar.tsx` · `topbar.tsx` | 223 | Adapt to approved nav skeleton (bottom-nav mobile + desktop nav) |
| `components/ui/charts/*` (bar, donut, progress, stat-bar) | ~360 | Keep alongside sports-4vlt charts as needed |

## Execution order (feeds S0 → S1)
1. **S0**: port server/data layer (bsd.ts + cache + ttl + routers→server fns); drizzle + migrations on the merged schema; tokens + shell.
2. **S1**: port match centre + live feed + team/league/player/manager/referee pages (adapted to new routes/design); wire the Watch layer (legal providers).
3. **S2–S4**: fold predictions.tsx/odds.tsx/dashboard components into the sports-4vlt suites already planned; worldcup.tsx → AFCON hub.
