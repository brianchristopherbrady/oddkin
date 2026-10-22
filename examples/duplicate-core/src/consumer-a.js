// Consumer A: an application bundle with its own copy of @oddkin/core and the Oddkin button.
import * as core from '@oddkin/core';
import '@oddkin/components/define/button';

class AGreeting extends core.OddkinElement.with({ name: core.prop.string({ default: 'world' }) }) {
  render() {
    return core.html`<p>A says hello, ${this.name}</p>`;
  }
}
core.define('a-greeting', AGreeting);

/** Shared with consumer B on purpose: a signal from this copy of core. */
globalThis.consumerA = { core, count: core.signal(1) };
