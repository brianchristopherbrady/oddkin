import { define } from '@mote/core';
import { DemoCounter, countChange } from './demo-counter.js';
import { DemoGreeting } from './demo-greeting.js';

export { DemoCounter, DemoGreeting, countChange };

define('demo-counter', DemoCounter);
define('demo-greeting', DemoGreeting);

declare global {
  interface HTMLElementTagNameMap {
    'demo-counter': DemoCounter;
    'demo-greeting': DemoGreeting;
  }
}
