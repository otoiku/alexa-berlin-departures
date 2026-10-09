import { EventEmitter } from 'node:events';
import * as https from 'node:https';

jest.mock('node:https', () => ({ get: jest.fn() }));
import { buildUrl, fetchNextBuses, httpsGetJson, RawDeparture, selectBuses } from '../src/bvgClient';
import { resetConfig } from '../src/config';

beforeAll(() => {
  process.env.FROM_STOP_ID = '900000000001';
  process.env.TO_STOP_ID = '900000000002';
  resetConfig();
});

const NOW = new Date('2026-10-09T10:12:30+02:00');
const dep = (tripId: string, line: string, when: string | null, extra: Partial<RawDeparture> = {}): RawDeparture => ({
  tripId,
  when,
  plannedWhen: when,
  line: { name: line, product: 'bus' },
  ...extra,
});

describe('selectBuses', () => {
  it('uses realtime `when` (delay included) and computes floor minutes', () => {
    const r = selectBuses(
      [dep('a', '137', '2026-10-09T10:15:00+02:00', { plannedWhen: '2026-10-09T10:13:00+02:00' })],
      NOW, 3
    );
    expect(r).toEqual([{ line: '137', minutes: 2 }]);
  });

  it('re-sorts by actual time when a delay changes the order', () => {
    const r = selectBuses(
      [
        dep('late', 'M37', '2026-10-09T10:25:00+02:00', { plannedWhen: '2026-10-09T10:14:00+02:00' }),
        dep('ok', '130', '2026-10-09T10:18:00+02:00'),
      ],
      NOW, 3
    );
    expect(r.map((b) => b.line)).toEqual(['130', 'M37']);
  });

  it('falls back to plannedWhen when no realtime data', () => {
    const r = selectBuses([dep('a', 'X37', null, { plannedWhen: '2026-10-09T10:22:30+02:00' })], NOW, 3);
    expect(r).toEqual([{ line: 'X37', minutes: 10 }]);
  });

  it('excludes cancelled, departed, duplicate and non-bus entries; returns max 3', () => {
    const r = selectBuses(
      [
        dep('c', '130', '2026-10-09T10:14:00+02:00', { cancelled: true }),
        dep('gone', '137', '2026-10-09T10:10:00+02:00'),
        dep('1', '130', '2026-10-09T10:13:00+02:00'),
        dep('1', '130', '2026-10-09T10:13:00+02:00'),
        dep('s', 'S3', '2026-10-09T10:13:00+02:00', { line: { name: 'S3', product: 'suburban' } }),
        dep('2', '137', '2026-10-09T10:20:00+02:00'),
        dep('3', 'M37', '2026-10-09T10:30:00+02:00'),
        dep('4', 'X37', '2026-10-09T10:40:00+02:00'),
      ],
      NOW, 3
    );
    expect(r).toEqual([
      { line: '130', minutes: 0 },
      { line: '137', minutes: 7 },
      { line: 'M37', minutes: 17 },
    ]);
  });

  it('keeps loop lines / lines ending beyond the target (direction filter is trusted)', () => {
    // Trips whose final destination differs from the target stop must be kept.
    const r = selectBuses(
      [dep('a', '337', '2026-10-09T10:27:00+02:00'), dep('b', '137', '2026-10-09T10:15:00+02:00')],
      NOW, 3
    );
    expect(r.map((b) => b.line)).toEqual(['137', '337']);
  });
});

describe('fetchNextBuses', () => {
  it('builds the expected URL', () => {
    const u = new URL(buildUrl());
    expect(u.pathname).toBe('/stops/900000000001/departures');
    expect(u.searchParams.get('direction')).toBe('900000000002');
    expect(u.searchParams.get('bus')).toBe('true');
    expect(u.searchParams.get('subway')).toBe('false');
  });

  it('parses the response and passes the configured timeout', async () => {
    const getJson = jest.fn().mockResolvedValue({ departures: [dep('a', '130', '2026-10-09T10:18:00+02:00')] });
    await expect(fetchNextBuses(NOW, getJson)).resolves.toEqual([{ line: '130', minutes: 5 }]);
    expect(getJson).toHaveBeenCalledWith(expect.stringContaining('/stops/900000000001/departures'), 3000);
  });

  it('propagates errors', async () => {
    const getJson = jest.fn().mockRejectedValue(new Error('BVG API HTTP 503'));
    await expect(fetchNextBuses(NOW, getJson)).rejects.toThrow('503');
  });
});

describe('httpsGetJson', () => {
  type Handler = (...a: any[]) => void;
  function mockHttps(status: number, body: string, opts: { timeout?: boolean } = {}) {
    const req = new EventEmitter() as EventEmitter & { setTimeout: jest.Mock; destroy: jest.Mock };
    req.destroy = jest.fn((err: Error) => req.emit('error', err));
    req.setTimeout = jest.fn((_ms: number, cb: Handler) => {
      if (opts.timeout) setImmediate(cb);
    });
    (https.get as jest.Mock).mockImplementation(((_url: string, _o: unknown, cb: Handler) => {
      if (!opts.timeout) {
        const res = new EventEmitter() as EventEmitter & { statusCode: number; resume: jest.Mock };
        res.statusCode = status;
        res.resume = jest.fn();
        setImmediate(() => {
          cb(res);
          res.emit('data', Buffer.from(body));
          res.emit('end');
        });
      }
      return req;
    }) as any);
  }
  afterEach(() => (https.get as jest.Mock).mockReset());

  it('resolves parsed JSON on 200', async () => {
    mockHttps(200, '{"departures":[]}');
    await expect(httpsGetJson('https://x', 3000)).resolves.toEqual({ departures: [] });
  });

  it('rejects on non-2xx', async () => {
    mockHttps(503, '');
    await expect(httpsGetJson('https://x', 3000)).rejects.toThrow('HTTP 503');
  });

  it('rejects on invalid JSON', async () => {
    mockHttps(200, 'not json');
    await expect(httpsGetJson('https://x', 3000)).rejects.toThrow();
  });

  it('rejects on timeout', async () => {
    mockHttps(200, '', { timeout: true });
    await expect(httpsGetJson('https://x', 3000)).rejects.toThrow('timeout');
  });
});
