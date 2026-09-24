// Watch-layer smoke test — exercises the provider framework end-to-end.
//   bun run scripts/watch-smoke.ts
import { getLiveWatch, getWatchOptions, watchProviders } from '@/server/watch/registry'

const t0 = Date.now()
console.log('enabled providers:', watchProviders().map((p) => p.id).join(', '))

console.log('\n── listLive ──')
const live = await getLiveWatch()
if (live.length === 0) console.log('(nothing live right now)')
for (const l of live.slice(0, 8)) {
  console.log(`· [${l.provider}] ${l.title} → ${l.embedUrl ?? l.url ?? '(no url)'}`)
}

console.log('\n── optionsFor (example GPL match) ──')
const opts = await getWatchOptions({
  eventId: 0,
  home: 'Hearts of Oak',
  away: 'Asante Kotoko',
  competitionSlug: 'ghana-premier-league',
  competitionName: 'Ghana Premier League',
})
for (const o of opts) {
  console.log(
    `· [${o.kind}] ${o.label} ${o.embedUrl ?? o.url ?? '(no link)'}${o.affiliate ? ' (affiliate)' : ''}`,
  )
}

console.log(`\ndone in ${Date.now() - t0}ms — live=${live.length} options=${opts.length}`)

// --selftest: prove the keyless YouTube parser still works, independent of
// whether any of OUR channels are live right now (uses a 24/7 news channel —
// detection only, not part of the product config).
if (process.argv.includes('--selftest')) {
  const { parseStreamsPage } = await import('@/server/watch/providers/youtube')
  const r = await fetch('https://www.youtube.com/@SkyNews/streams?hl=en', {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      'accept-language': 'en-US,en;q=0.9',
      cookie: 'CONSENT=YES+cb',
    },
  })
  const items = parseStreamsPage(await r.text())
  console.log(`parser self-test (SkyNews, 24/7): ${items.length > 0 ? 'PASS' : 'FAIL'} — ${items.length} live item(s)${items[0] ? `, first id=${items[0].id}` : ''}`)
}

process.exit(0)
