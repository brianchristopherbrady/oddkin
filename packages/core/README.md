# @oddkin/core

Author custom elements with typed properties, fine-grained reactivity, tagged templates, and one ownership primitive (`Scope`) for listeners, timers, effects, and cancellation. No runtime dependencies, no compiler, no decorators; works in plain JavaScript with an import map or in any bundler.

```sh
npm install @oddkin/core@beta
```

The current release is a beta (`1.0.0-beta.0`, on the `beta` dist-tag): contracts may still change before 1.0.0.

## A counter

```js
import { OddkinElement, define, html, signal } from '@oddkin/core';

class DemoCounter extends OddkinElement {
  count = signal(0);
  increment = () => this.count.update((n) => n + 1);

  render() {
    return html`<button type="button" @click=${this.increment}>Count: ${this.count}</button>`;
  }
}

define('demo-counter', DemoCounter);
```

`${this.count}` binds the readable to that text directly, so a click updates one text node and never re-runs `render()`. Reading `${this.count.value}` instead tracks it as a dependency of `render()`, which re-runs (once per batch of changes). That is the binding rule; [CONTRACTS.md](./CONTRACTS.md) (`contract:core/binding-rule`) has the details.

## Properties, events, and cleanup (TypeScript)

```ts
import { OddkinElement, define, event, html, prop, type Scope } from '@oddkin/core';

const change = event<{ value: number }>('demo-change', {
  bubbles: true,
  composed: true,
  cancelable: false,
});

export class DemoStepper extends OddkinElement.with({
  value: prop.number({ default: 0, reflect: true }),
  label: prop.string({ default: 'Quantity' }),
}) {
  static override events = { change };

  protected override connected(scope: Scope) {
    // Removed when the element disconnects: no matching removeEventListener.
    scope.listen<KeyboardEvent>(window, 'keydown', (e) => {
      if (e.key === '+') this.#step(1);
    });
  }

  #step(by: number) {
    this.value += by;
    this.emit(change, { value: this.value });
  }

  protected override render() {
    return html`<span>${this.label}: ${this.value}</span>
      <button type="button" @click=${() => this.#step(1)}>Add one</button>`;
  }
}

define('demo-stepper', DemoStepper);
```

- `OddkinElement.with()` declares typed public properties: ordinary DOM accessors (`stepper.value = 3`), attribute conversion (`value="3"`), opt-in reflection, and metadata the analyzer reads without running your code.
- Events have explicit `bubbles`, `composed`, and `cancelable`; property writes never emit them.
- `connected(scope)` runs on every connection with a fresh `Scope`, disposed on disconnection: listeners, timers, effects, child scopes, and `scope.signal` for `fetch`.

## Entries

The root entry re-exports `./reactive`, `./scope`, `./template`, `./styles`, `./element`, and `./diagnostics`. Everything else is a separate entry, so a page pays only for what it imports.

| Entry | For |
| --- | --- |
| `@oddkin/core/reactive` | `signal`, `computed`, `effect`, `batch`, `untracked`, external stores (`fromExternal`, `toExternal`); DOM-free |
| `@oddkin/core/scope` | `Scope`, `createScope`, `scopeStats()` for leak tests; DOM-free |
| `@oddkin/core/template` | `html`, `svg`, `render`, `when`, `match`, keyed `repeat`, the attribute-directive protocol |
| `@oddkin/core/helpers/*` | `class-map`, `style-map` (CSSOM, strict CSP), `ref`, `live` (form fields: IME, caret, autofill) |
| `@oddkin/core/controllers/*` | `focus` (roving tabindex, focus recovery), `announce`, `observe`, `form` (form association), `position`, `typeahead`, `active-descendant`, `resize` |
| `@oddkin/core/i18n` | String tables and cached `Intl` formatters |
| `@oddkin/core/layout`, `/collections`, `/model` | Layout recipes, collection sources, and validated data models |
| `@oddkin/core/template/roles` | Composite roles: render dependencies by role, recomposable per product |

## Builds, errors, and contracts

- The `development` export condition selects `dist/` with full error explanations and development-only checks; the default selects `dist/prod/`, where every error keeps its stable code (`[template.value.function]`) and every behaviour and security check is unchanged.
- Errors that cannot be thrown to a caller go to one handler: `setErrorHandler((error, { code, origin }) => â€¦)`.
- Templates never parse values as HTML, block `javascript:` URLs, and work under strict CSP and Trusted Types (`oddkin-template` policy).
- [CONTRACTS.md](./CONTRACTS.md) is the published contract, with stable ids (also in `contracts.json`); tools and agents cite them.

Tested in Chromium, Firefox, and WebKit; the supported browser floor and its evidence are in the [compatibility matrix](https://github.com/brianchristopherbrady/oddkin/blob/main/docs/compatibility/matrix.md). Licence: MIT.
