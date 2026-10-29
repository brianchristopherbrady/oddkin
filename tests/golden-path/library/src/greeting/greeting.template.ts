import { html } from '@oddkin/core';
import type { AcmeGreeting } from './greeting.js';

export const greetingTemplate = (greeting: AcmeGreeting) =>
  html`<p part="text">Hello, <strong>${greeting.name}</strong>!</p>`;
