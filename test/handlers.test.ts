import { handler } from '../src/index';
import * as client from '../src/bvgClient';

function req(type: string, locale: string, intent?: string) {
  return {
    version: '1.0',
    session: { new: true, sessionId: 's', application: { applicationId: 'a' }, user: { userId: 'u' } },
    context: { System: { application: { applicationId: 'a' }, user: { userId: 'u' }, device: { deviceId: 'd' } } },
    request: {
      type,
      requestId: 'r',
      locale,
      timestamp: new Date().toISOString(),
      ...(intent ? { intent: { name: intent, confirmationStatus: 'NONE' } } : {}),
    },
  };
}

const invoke = (event: unknown): Promise<any> =>
  new Promise((resolve, reject) => handler(event as any, {} as any, (err, res) => (err ? reject(err) : resolve(res))));

describe('handlers', () => {
  afterEach(() => jest.restoreAllMocks());

  it('LaunchRequest answers immediately (ja)', async () => {
    jest.spyOn(client, 'fetchNextBuses').mockResolvedValue([{ line: '130', minutes: 5 }]);
    const res = await invoke(req('LaunchRequest', 'ja-JP'));
    expect(res.response.outputSpeech.ssml).toContain('130が5分後');
    expect(res.response.shouldEndSession).toBe(true);
  });

  it('NextBusIntent (en)', async () => {
    jest.spyOn(client, 'fetchNextBuses').mockResolvedValue([{ line: 'M37', minutes: 2 }]);
    const res = await invoke(req('IntentRequest', 'en-US', 'NextBusIntent'));
    expect(res.response.outputSpeech.ssml).toContain('M 37 in 2 minutes');
  });

  it('API failure -> friendly error', async () => {
    jest.spyOn(client, 'fetchNextBuses').mockRejectedValue(new Error('down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await invoke(req('LaunchRequest', 'ja-JP'));
    expect(res.response.outputSpeech.ssml).toContain('交通情報を取得できませんでした');
  });
});
