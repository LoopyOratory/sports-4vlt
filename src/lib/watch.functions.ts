import { createServerFn } from '@tanstack/react-start'
import type { WatchOption } from '@/server/watch/types'

// Same rule as db.server.ts: the watch modules reach bun:sqlite, so they are
// only ever imported dynamically inside handlers — never statically.
// Every watch surface in the app goes through these two functions.

/** All watch options (embeds + links) for one match. */
export const fetchWatchOptions = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      eventId: number
      home: string
      away: string
      competitionSlug?: string
      competitionName?: string
    }) => data,
  )
  .handler(async ({ data }): Promise<WatchOption[]> => {
    const { getWatchOptions } = await import('@/server/watch/registry')
    return getWatchOptions(data)
  })

/** Currently-live items across embeddable providers. */
export const fetchLiveWatch = createServerFn({ method: 'GET' }).handler(async () => {
  const { getLiveWatch } = await import('@/server/watch/registry')
  return getLiveWatch()
})
