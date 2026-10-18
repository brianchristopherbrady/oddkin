import { prop } from '@oddkin/core';
import { AcmePanel } from '../panel/panel.js';

// Analysis must never execute library modules.
throw new Error('analysis executed the alert module');

/**
 * A panel that announces status.
 *
 * @related acme-panel
 */
export class AcmeAlert extends AcmePanel.with({
  live: prop.enum(['polite', 'assertive'], { default: 'polite', attribute: 'live-mode' }),
  items: prop.array<string>({ description: 'Messages (property only).' }),
}) {}
