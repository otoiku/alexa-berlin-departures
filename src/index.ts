import * as Alexa from 'ask-sdk-core';
import {
  ErrorHandler,
  FallbackHandler,
  HelpHandler,
  LaunchHandler,
  NextBusHandler,
  SessionEndedHandler,
  StopHandler,
} from './handlers';

export const handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchHandler,
    NextBusHandler,
    HelpHandler,
    StopHandler,
    FallbackHandler,
    SessionEndedHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .withCustomUserAgent('alexa-my-bus')
  .lambda();
