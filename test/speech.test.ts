import { busesSpeech, langOf } from '../src/speech';

describe('speech', () => {
  const buses = [
    { line: 'M37', minutes: 3 },
    { line: '137', minutes: 8 },
    { line: '130', minutes: 0 },
  ];

  it('detects language', () => {
    expect(langOf('ja-JP')).toBe('ja');
    expect(langOf('en-US')).toBe('en');
    expect(langOf(undefined)).toBe('en');
  });

  it('Japanese', () => {
    expect(busesSpeech(buses, 'ja')).toBe('次のバスは、M 37が3分後、137が8分後、130がまもなくです。');
    expect(busesSpeech([], 'ja')).toBe('1時間以内のバスはありません。');
  });

  it('English', () => {
    expect(busesSpeech(buses, 'en')).toBe('Next buses: M 37 in 3 minutes, 137 in 8 minutes, 130 now.');
    expect(busesSpeech([{ line: 'X37', minutes: 1 }], 'en')).toBe('Next bus: X 37 in 1 minute.');
    expect(busesSpeech([], 'en')).toBe('No buses in the next hour.');
  });
});
