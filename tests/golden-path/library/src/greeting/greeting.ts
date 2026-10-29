import { OddkinElement, prop } from '@oddkin/core';

/**
 * A greeting for one person, in the theme's heading style.
 *
 * @summary Greets someone by name.
 */
export class AcmeGreeting extends OddkinElement.with({
  name: prop.string({ default: 'world', description: 'Who to greet.' }),
}) {}

declare global {
  interface HTMLElementTagNameMap {
    'acme-greeting': AcmeGreeting;
  }
}
