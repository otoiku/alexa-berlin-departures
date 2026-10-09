import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Config {
  apiBase: string;
  fromId: string;
  toId: string;
  /** Look-ahead window in minutes. */
  durationMin: number;
  /** Number of buses to announce. */
  count: number;
  /** HTTP timeout; Alexa allows ~8s for the whole response. */
  timeoutMs: number;
}

/**
 * Stop IDs are NOT stored in the repository.
 * Resolution order:
 *   1. Environment variables FROM_STOP_ID / TO_STOP_ID / BUS_COUNT (own AWS Lambda)
 *   2. lambda/stops.json (git-ignored; used for Alexa-hosted, which has no env vars)
 */
function loadLocalFile(): { fromId?: string; toId?: string; count?: number } {
  const file = process.env.STOPS_FILE ?? join(__dirname, '..', 'stops.json');
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, 'utf8'));
}

let cached: Config | undefined;

export function getConfig(): Config {
  if (cached) return cached;
  const local = loadLocalFile();
  const fromId = process.env.FROM_STOP_ID ?? local.fromId;
  const toId = process.env.TO_STOP_ID ?? local.toId;
  if (!fromId || !toId) {
    throw new Error('Stop IDs missing: set FROM_STOP_ID/TO_STOP_ID or create lambda/stops.json');
  }
  const rawCount = process.env.BUS_COUNT ?? local.count ?? 3;
  const count = Number(rawCount);
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    throw new Error(`Invalid bus count: ${rawCount} (must be an integer 1-10)`);
  }
  cached = {
    apiBase: process.env.BVG_API_BASE ?? 'https://v6.bvg.transport.rest',
    fromId,
    toId,
    durationMin: 60,
    count,
    timeoutMs: 3000,
  };
  return cached;
}

/** For tests only. */
export function resetConfig(): void {
  cached = undefined;
}
