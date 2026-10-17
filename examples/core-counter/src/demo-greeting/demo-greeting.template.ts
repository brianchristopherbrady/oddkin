import { html, when } from '@mote/core';
import { styleMap } from '@mote/core/helpers/style-map';
import type { DemoGreeting } from './demo-greeting.js';

const toneColors = { plain: 'currentcolor', warm: '#9a3412', formal: '#1e3a5f' } as const;

export const demoGreetingTemplate = (greeting: DemoGreeting) => {
  const salutation =
    greeting.tone === 'formal'
      ? 'Good day'
      : greeting.tone === 'warm'
        ? 'Lovely to see you'
        : 'Hello';
  return html`
    <p style=${styleMap({ color: toneColors[greeting.tone] })}>
      ${salutation}, ${greeting.name}${greeting.excited ? '!' : '.'}
    </p>
    ${when(
      greeting.history.length > 0,
      () => html`<small>Earlier: ${greeting.history.join(', ')}</small>`,
    )}
  `;
};
