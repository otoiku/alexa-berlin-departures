import { getConfig } from './config';

/** Subset of the transport.rest departure object we rely on. */
export interface RawDeparture {
  tripId: string;
  when: string | null;
  plannedWhen: string | null;
  cancelled?: boolean;
  line?: { name?: string; product?: string };
}

export interface Bus {
  line: string;
  /** Minutes until actual departure (delay included), >= 0. */
  minutes: number;
}

export type FetchFn = typeof fetch;

export function buildUrl(): string {
  const config = getConfig();
  const p = new URLSearchParams({
    direction: config.toId,
    duration: String(config.durationMin),
    results: String(Math.max(15, config.count * 3)),
    bus: 'true',
    suburban: 'false',
    subway: 'false',
    tram: 'false',
    regional: 'false',
    express: 'false',
    ferry: 'false',
    remarks: 'false',
  });
  return `${config.apiBase}/stops/${config.fromId}/departures?${p}`;
}

/**
 * Pure: turn raw departures into the next `count` buses (count comes from config).
 * `when` already includes the realtime delay; fall back to `plannedWhen`.
 * Note: the API's `direction` filter is trusted. It was verified via
 * /trips/{id} that every returned trip stops at the target after the origin,
 * even when the trip's final destination name differs (loop lines, lines
 * continuing beyond the target). Do NOT filter by destination name.
 */
export function selectBuses(raw: RawDeparture[], now: Date, count: number): Bus[] {
  const seen = new Set<string>();
  return raw
    .filter((d) => !d.cancelled)
    .filter((d) => !d.line?.product || d.line.product === 'bus')
    .filter((d) => (seen.has(d.tripId) ? false : (seen.add(d.tripId), true)))
    .map((d) => {
      const t = d.when ?? d.plannedWhen;
      return t ? { line: d.line?.name ?? '?', ms: Date.parse(t) - now.getTime() } : null;
    })
    .filter((x): x is { line: string; ms: number } => x !== null && !Number.isNaN(x.ms))
    .filter((x) => x.ms >= -30_000) // drop buses that already left
    .sort((a, b) => a.ms - b.ms)
    .slice(0, count)
    .map((x) => ({ line: x.line, minutes: Math.max(0, Math.floor(x.ms / 60_000)) }));
}

export async function fetchNextBuses(now = new Date(), fetchFn: FetchFn = fetch): Promise<Bus[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), getConfig().timeoutMs);
  try {
    const res = await fetchFn(buildUrl(), {
      signal: ctrl.signal,
      headers: { accept: 'application/json', 'user-agent': 'alexa-my-bus (personal skill)' },
    });
    if (!res.ok) throw new Error(`BVG API HTTP ${res.status}`);
    const body = (await res.json()) as { departures?: RawDeparture[] };
    return selectBuses(body.departures ?? [], now, getConfig().count);
  } finally {
    clearTimeout(timer);
  }
}
