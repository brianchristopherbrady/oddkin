import { MoteElement, prop } from '@mote/core';

/** A greeting with typed public properties, attribute conversion, and opt-in reflection. */
export class DemoGreeting extends MoteElement.with({
  name: prop.string({ default: 'world', description: 'Who to greet.' }),
  excited: prop.boolean({ reflect: true, description: 'Adds emphasis; reflected for styling.' }),
  tone: prop.enum(['plain', 'warm', 'formal'], { default: 'plain', reflect: true }),
  history: prop.array<string>({ description: 'Previous names (property only).' }),
}) {}

declare global {
  interface HTMLElementTagNameMap {
    'demo-greeting': DemoGreeting;
  }
}
