"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messages = void 0;
exports.langOf = langOf;
exports.busesSpeech = busesSpeech;
exports.helpSpeech = helpSpeech;
function langOf(locale) {
    return locale?.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}
function escapeSsml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
/** Split "M37" -> "M 37" so Alexa reads the letter and the number separately. */
function lineSsml(line, _lang) {
    const m = /^([A-Za-z]+)(\d+)$/.exec(line);
    return m ? `${m[1]} ${m[2]}` : escapeSsml(line);
}
function minutesText(min, lang) {
    if (lang === 'ja')
        return min === 0 ? 'まもなく' : `${min}分後`;
    if (min === 0)
        return 'now';
    return min === 1 ? 'in 1 minute' : `in ${min} minutes`;
}
function busesSpeech(buses, lang) {
    if (buses.length === 0) {
        return lang === 'ja' ? '1時間以内のバスはありません。' : 'No buses in the next hour.';
    }
    if (lang === 'ja') {
        const parts = buses.map((b) => `${lineSsml(b.line, lang)}が${minutesText(b.minutes, lang)}`);
        return `次のバスは、${parts.join('、')}です。`;
    }
    const parts = buses.map((b) => `${lineSsml(b.line, lang)} ${minutesText(b.minutes, lang)}`);
    return `${buses.length === 1 ? 'Next bus' : 'Next buses'}: ${parts.join(', ')}.`;
}
function helpSpeech(count, lang) {
    return lang === 'ja'
        ? `次のバス、と言うと、登録したバス停から目的地までのバスを${count}本お知らせします。`
        : `Say next bus, and I will tell you the next ${count === 1 ? 'bus' : `${count} buses`} from your stop to your destination.`;
}
exports.messages = {
    error: { ja: '交通情報を取得できませんでした。', en: "Sorry, I couldn't get the departures." },
    helpReprompt: { ja: '次のバス、と言ってください。', en: 'Say next bus.' },
    bye: { ja: 'またね。', en: 'Goodbye.' },
    fallback: {
        ja: 'すみません、わかりませんでした。次のバス、と言ってください。',
        en: "Sorry, I didn't get that. Say next bus.",
    },
};
