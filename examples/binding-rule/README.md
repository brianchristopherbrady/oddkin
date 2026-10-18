# binding-rule example

A walkthrough of Oddkin's binding rule. One scenario (`scenario.js`, ordinary consumer code) drives two sets of identical elements: [`plain/components.js`](./plain/components.js), plain JavaScript loaded without a build step, and [`src/components.ts`](./src/components.ts), TypeScript compiled by `tsc`. For each step it counts `render()` runs and the mutations made in the element's shadow root, and shows both tables on the page.

## The rule

| You write | What happens |
| --- | --- |
| `${this.count}` (interpolate the readable) | A **direct binding**: a commit-phase effect writes that one DOM position. `render()` does not run again. |
| `${this.count.value}` inside `render()` | A **render-tracked read**: `render()` subscribes and re-runs once per flush, however many writes happened. The template diff then writes only changed positions. |
| `this.count.value` in an event handler, timer, or promise | A **snapshot**: it reads the current value and subscribes nothing. |
| `el.label = 'Ada'` or `setAttribute('label', …)` | A **public property** write. Reading `this.label` in `render()` is a tracked read. Equal values are no-ops. |
| `await el.updateComplete` | The **update boundary**. Writes are synchronous in memory; DOM commits happen in the microtask flush. |

## Observed (Chromium, Firefox, WebKit; identical for JavaScript and TypeScript)

| Step | `render()` runs | DOM writes | Result |
| --- | --- | --- | --- |
| Direct binding: three writes in one task | 0 | 1 | 3 |
| Render-tracked `.value`: three writes in one task | 1 | 1 | 3 |
| Both paths reach one value (coalesced) | 1 | 1 | small 1 |
| Event handler reads `.value` (snapshot) | 0 | 0 | read 0 |
| Later write after a handler read | 0 | 0 | async callback read 5 |
| No-op write (same value) | 0 | 0 | 3 |
| Public property set by DOM code | 1 | 1 | Hello, Ada; `updated(label)` |
| Same public value again | 0 | 0 | `updated` not called |
| Attribute set by markup or DOM code | 1 | 1 | Hello, Grace |
| Update boundary (`updateComplete`) | 1 | 1 | before await 3, after 4 |

Notes:
- **Coalescing:** `render()` reads `count.value` to choose a label, and also interpolates `count` directly. One write re-runs `render()`, which hands the part the same readable, so the binding is kept rather than rewritten. The number's text node changes once, and the unchanged label is not touched.
- **Snapshots are current, not stale:** a callback scheduled by the handler reads the value at the time it runs (`5`), and the read creates no subscription (zero renders).
- **Plain JavaScript and TypeScript differ only in syntax.** JavaScript uses class fields and `render()`. TypeScript adds `protected override`, and `prop.string` infers `label: string`. Behavior and counts are the same.

## Outcome of the helper, directive, and controller experiments (M3)

- **Directives stay a small protocol, not a class hierarchy.** Child-position helpers (`when`, `match`, `repeat`) return plain values that parts understand. Attribute-position helpers use one exported `ATTRIBUTE_DIRECTIVE` protocol. `class-map`, `style-map`, `ref`, and `live` are built on it as separate subpaths, so a component pays only for the helpers it imports. Another library can author its own directives with the same protocol.
- **`repeat()` carries its own reconciler**, so templates that never use it do not ship keyed-move code (ADR 0031).
- **Controllers are `Scope` owners, not a separate lifecycle API.** A controller is any object with `connect(scope)`, attached with `scope.use(controller)`. Together with `scope.listen`, `timeout`, `interval`, `child`, and per-run `scope.effect`, this covers the reusable-behavior cases from the plan. Resources return to baseline after mount and remove cycles: `scopeStats()` is exactly at baseline after 100 cycles of 100 elements in three engines (`research/benchmarks`).
- **No decorators and no compiler.** Every rule above is visible in plain JavaScript.

## Run

```sh
npm run build
node scripts/serve-static.mjs
# open http://localhost:4173/examples/binding-rule/
```

Verified by `e2e/binding-rule.spec.ts` in Chromium, Firefox, and WebKit.
