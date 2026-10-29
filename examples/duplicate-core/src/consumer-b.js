// Consumer B: built independently, with a second copy of @oddkin/core and of the button module.
import * as core from '@oddkin/core';
import { buttonDefinition } from '@oddkin/components/button';

const reported = [];
core.setErrorHandler((_error, context) => reported.push(context.code));

const { count } = globalThis.consumerA;
// The supported way to follow another copy's readable: through the external-store contract.
const bridged = core.fromExternal(core.toExternal(count));
// Consumer A's button in this copy's template: a property set and an event heard across copies.
const blocked = core.signal(false);
let presses = 0;

/** Shows consumer A's signal twice: bound as is (not tracked by this copy) and bridged. */
class BMirror extends core.OddkinElement {
  render() {
    return core.html`<output class="direct">${count}</output>
      <output class="bridged">${bridged}</output>
      <odd-button .disabled=${blocked.value} @click=${() => (presses += 1)}>Pressed in B</odd-button>`;
  }
}
core.define('b-mirror', BMirror);

// Consumer A registered <odd-button> with its own class; this copy's class cannot take the name.
let collision;
try {
  core.define(buttonDefinition);
} catch (error) {
  collision = error;
}

globalThis.consumerB = {
  core,
  collision,
  reported,
  buttonClass: buttonDefinition.element,
  blocked,
  presses: () => presses,
};
document.body.dataset.ready = 'true';
