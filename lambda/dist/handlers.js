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
exports.ErrorHandler = exports.SessionEndedHandler = exports.FallbackHandler = exports.StopHandler = exports.HelpHandler = exports.NextBusHandler = exports.LaunchHandler = void 0;
const Alexa = __importStar(require("ask-sdk-core"));
const bvgClient_1 = require("./bvgClient");
const config_1 = require("./config");
const speech_1 = require("./speech");
const lang = (h) => (0, speech_1.langOf)(Alexa.getLocale(h.requestEnvelope));
async function answerNextBuses(h) {
    const l = lang(h);
    let speech;
    try {
        speech = (0, speech_1.busesSpeech)(await (0, bvgClient_1.fetchNextBuses)(), l);
    }
    catch (e) {
        console.error('fetchNextBuses failed', e);
        speech = speech_1.messages.error[l];
    }
    // One-shot: answer and end the session (works well with a Routine).
    return h.responseBuilder.speak(speech).withShouldEndSession(true).getResponse();
}
const isIntent = (h, ...names) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    names.includes(Alexa.getIntentName(h.requestEnvelope));
exports.LaunchHandler = {
    canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest',
    handle: answerNextBuses,
};
exports.NextBusHandler = {
    canHandle: (h) => isIntent(h, 'NextBusIntent'),
    handle: answerNextBuses,
};
exports.HelpHandler = {
    canHandle: (h) => isIntent(h, 'AMAZON.HelpIntent'),
    handle: (h) => h.responseBuilder.speak((0, speech_1.helpSpeech)((0, config_1.getConfig)().count, lang(h))).reprompt(speech_1.messages.helpReprompt[lang(h)]).getResponse(),
};
exports.StopHandler = {
    canHandle: (h) => isIntent(h, 'AMAZON.StopIntent', 'AMAZON.CancelIntent', 'AMAZON.NavigateHomeIntent'),
    handle: (h) => h.responseBuilder.speak(speech_1.messages.bye[lang(h)]).withShouldEndSession(true).getResponse(),
};
exports.FallbackHandler = {
    canHandle: (h) => isIntent(h, 'AMAZON.FallbackIntent'),
    handle: (h) => h.responseBuilder.speak(speech_1.messages.fallback[lang(h)]).reprompt(speech_1.messages.helpReprompt[lang(h)]).getResponse(),
};
exports.SessionEndedHandler = {
    canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'SessionEndedRequest',
    handle: (h) => h.responseBuilder.getResponse(),
};
exports.ErrorHandler = {
    canHandle: () => true,
    handle: (h, err) => {
        console.error('Unhandled error', err);
        return h.responseBuilder.speak(speech_1.messages.error[lang(h)]).withShouldEndSession(true).getResponse();
    },
};
