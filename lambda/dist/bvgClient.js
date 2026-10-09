"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpsGetJson = void 0;
exports.buildUrl = buildUrl;
exports.selectBuses = selectBuses;
exports.fetchNextBuses = fetchNextBuses;
const https = __importStar(require("node:https"));
const config_1 = require("./config");
/**
 * Uses node:https instead of global fetch, which is missing on older
 * Node.js runtimes (e.g. Alexa-hosted's Node 16).
 */
const httpsGetJson = (url, timeoutMs) => new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { accept: 'application/json', 'user-agent': 'alexa-berlin-departures' } }, (res) => {
        const status = res.statusCode ?? 0;
        if (status < 200 || status >= 300) {
            res.resume();
            reject(new Error(`BVG API HTTP ${status}`));
            return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            }
            catch (e) {
                reject(e);
            }
        });
        res.on('error', reject);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`BVG API timeout after ${timeoutMs}ms`)));
    req.on('error', reject);
});
exports.httpsGetJson = httpsGetJson;
function buildUrl() {
    const config = (0, config_1.getConfig)();
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
function selectBuses(raw, now, count) {
    const seen = new Set();
    return raw
        .filter((d) => !d.cancelled)
        .filter((d) => !d.line?.product || d.line.product === 'bus')
        .filter((d) => (seen.has(d.tripId) ? false : (seen.add(d.tripId), true)))
        .map((d) => {
        const t = d.when ?? d.plannedWhen;
        return t ? { line: d.line?.name ?? '?', ms: Date.parse(t) - now.getTime() } : null;
    })
        .filter((x) => x !== null && !Number.isNaN(x.ms))
        .filter((x) => x.ms >= -30000) // drop buses that already left
        .sort((a, b) => a.ms - b.ms)
        .slice(0, count)
        .map((x) => ({ line: x.line, minutes: Math.max(0, Math.floor(x.ms / 60000)) }));
}
async function fetchNextBuses(now = new Date(), getJson = exports.httpsGetJson) {
    const { timeoutMs, count } = (0, config_1.getConfig)();
    const body = (await getJson(buildUrl(), timeoutMs));
    return selectBuses(body.departures ?? [], now, count);
}
