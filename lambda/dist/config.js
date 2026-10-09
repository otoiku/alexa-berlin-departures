"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
exports.resetConfig = resetConfig;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
/**
 * Stop IDs are NOT stored in the repository.
 * Resolution order:
 *   1. Environment variables FROM_STOP_ID / TO_STOP_ID / BUS_COUNT (own AWS Lambda)
 *   2. lambda/stops.json (git-ignored; used for Alexa-hosted, which has no env vars)
 */
function loadLocalFile() {
    const file = process.env.STOPS_FILE ?? (0, node_path_1.join)(__dirname, '..', 'stops.json');
    if (!(0, node_fs_1.existsSync)(file))
        return {};
    return JSON.parse((0, node_fs_1.readFileSync)(file, 'utf8'));
}
let cached;
function getConfig() {
    if (cached)
        return cached;
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
function resetConfig() {
    cached = undefined;
}
