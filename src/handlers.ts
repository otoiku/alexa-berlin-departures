import * as Alexa from 'ask-sdk-core';
import { fetchNextBuses } from './bvgClient';
import { getConfig } from './config';
import { busesSpeech, helpSpeech, langOf, messages } from './speech';

const lang = (h: Alexa.HandlerInput) => langOf(Alexa.getLocale(h.requestEnvelope));

async function answerNextBuses(h: Alexa.HandlerInput) {
  const l = lang(h);
  let speech: string;
  try {
    speech = busesSpeech(await fetchNextBuses(), l);
  } catch (e) {
    console.error('fetchNextBuses failed', e);
    speech = messages.error[l];
  }
  // One-shot: answer and end the session (works well with a Routine).
  return h.responseBuilder.speak(speech).withShouldEndSession(true).getResponse();
}

const isIntent = (h: Alexa.HandlerInput, ...names: string[]) =>
  Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
  names.includes(Alexa.getIntentName(h.requestEnvelope));

export const LaunchHandler: Alexa.RequestHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest',
  handle: answerNextBuses,
};

export const NextBusHandler: Alexa.RequestHandler = {
  canHandle: (h) => isIntent(h, 'NextBusIntent'),
  handle: answerNextBuses,
};

export const HelpHandler: Alexa.RequestHandler = {
  canHandle: (h) => isIntent(h, 'AMAZON.HelpIntent'),
  handle: (h) =>
    h.responseBuilder.speak(helpSpeech(getConfig().count, lang(h))).reprompt(messages.helpReprompt[lang(h)]).getResponse(),
};

export const StopHandler: Alexa.RequestHandler = {
  canHandle: (h) => isIntent(h, 'AMAZON.StopIntent', 'AMAZON.CancelIntent', 'AMAZON.NavigateHomeIntent'),
  handle: (h) => h.responseBuilder.speak(messages.bye[lang(h)]).withShouldEndSession(true).getResponse(),
};

export const FallbackHandler: Alexa.RequestHandler = {
  canHandle: (h) => isIntent(h, 'AMAZON.FallbackIntent'),
  handle: (h) =>
    h.responseBuilder.speak(messages.fallback[lang(h)]).reprompt(messages.helpReprompt[lang(h)]).getResponse(),
};

export const SessionEndedHandler: Alexa.RequestHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'SessionEndedRequest',
  handle: (h) => h.responseBuilder.getResponse(),
};

export const ErrorHandler: Alexa.ErrorHandler = {
  canHandle: () => true,
  handle: (h, err) => {
    console.error('Unhandled error', err);
    return h.responseBuilder.speak(messages.error[lang(h)]).withShouldEndSession(true).getResponse();
  },
};
