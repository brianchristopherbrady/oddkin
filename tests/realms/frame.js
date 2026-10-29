// A same-origin frame: another realm, with its own registry and its own copy of @oddkin/core. It
// defines the button again (no collision across realms) but not the input.
import * as core from '@oddkin/core';
import '@oddkin/components/define/button';

const reported = [];
core.setErrorHandler((_error, context) => reported.push(context.code));

const { count } = window.parent.parentRealm;
const bridged = core.fromExternal(core.toExternal(count));

/** Shows the page realm's signal: bound as is (not tracked by this copy) and bridged. */
class FMirror extends core.OddkinElement {
  render() {
    return core.html`<output class="direct">${count}</output>
      <output class="bridged">${bridged}</output>`;
  }
}
core.define('f-mirror', FMirror);

globalThis.frameRealm = { core, reported };
document.body.dataset.ready = 'true';
