import { getConfig, resetConfig } from '../src/config';
import { helpSpeech } from '../src/speech';

describe('config', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env = { ...saved, FROM_STOP_ID: '1', TO_STOP_ID: '2', STOPS_FILE: '/nonexistent.json' };
    delete process.env.BUS_COUNT;
    resetConfig();
  });
  afterAll(() => {
    process.env = saved;
    resetConfig();
  });

  it('defaults count to 3', () => {
    expect(getConfig().count).toBe(3);
  });

  it('reads BUS_COUNT', () => {
    process.env.BUS_COUNT = '5';
    expect(getConfig().count).toBe(5);
  });

  it.each(['0', '11', '2.5', 'abc'])('rejects invalid count %s', (v) => {
    process.env.BUS_COUNT = v;
    expect(() => getConfig()).toThrow('Invalid bus count');
  });

  it('throws when stop IDs are missing', () => {
    delete process.env.FROM_STOP_ID;
    expect(() => getConfig()).toThrow('Stop IDs missing');
  });

  it('help speech reflects count', () => {
    expect(helpSpeech(5, 'ja')).toContain('5本');
    expect(helpSpeech(1, 'en')).toContain('the next bus');
    expect(helpSpeech(4, 'en')).toContain('next 4 buses');
  });
});
