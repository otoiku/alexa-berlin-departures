// Live smoke test: runs the compiled Lambda against the real BVG API.
// Usage: npm run smoke
const { handler } = require('../lambda/dist/index');

const req = (locale) => ({
  version: '1.0',
  session: { new: true, sessionId: 's', application: { applicationId: 'a' }, user: { userId: 'u' } },
  context: { System: { application: { applicationId: 'a' }, user: { userId: 'u' }, device: { deviceId: 'd' } } },
  request: { type: 'LaunchRequest', requestId: 'r', locale, timestamp: new Date().toISOString() },
});

(async () => {
  for (const locale of ['ja-JP', 'en-US']) {
    const t = Date.now();
    const res = await new Promise((ok, ng) => handler(req(locale), {}, (e, r) => (e ? ng(e) : ok(r))));
    console.log(`${locale} (${Date.now() - t}ms): ${res.response.outputSpeech.ssml}`);
  }
})();
