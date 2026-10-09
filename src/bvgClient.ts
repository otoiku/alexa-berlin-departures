import * as https from 'node:https';
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

/** GET a URL and resolve with parsed JSON. Injected in tests. */
export type GetJson = (url: string, timeoutMs: number) => Promise<unknown>;

/**
 * Uses node:https instead of global fetch, which is missing on older
 * Node.js runtimes (e.g. Alexa-hosted's Node 16).
 */
export const httpsGetJson: GetJson = (url, timeoutMs) =>
  new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { accept: 'application/json', 'user-agent': 'alexa-berlin-departures' } },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`BVG API HTTP ${status}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch (e) {
            reject(e);
          }
        });
        res.on('error', reject);
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`BVG API timeout after ${timeoutMs}ms`)));
    req.on('error', reject);
  });

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

export async function fetchNextBuses(now = new Date(), getJson: GetJson = httpsGetJson): Promise<Bus[]> {
  const { timeoutMs, count } = getConfig();
  const body = (await getJson(buildUrl(), timeoutMs)) as { departures?: RawDeparture[] };
  return selectBuses(body.departures ?? [], now, count);
}
