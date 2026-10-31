# @oddkin/components

Themed custom elements, Oddkin layout presets, and component metadata. Accessibility is tested with keyboard checks and axe-core audits in Chromium, Firefox, and WebKit; screen readers are not yet verified ([support policy](../../docs/support.md#accessibility)).

**Status:** M4 in progress. Implemented: `odd-button`, `odd-card`, `odd-input`, `odd-side-nav`. See [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) and [packages.md](../../docs/architecture/packages.md).

## Use

```js
import '@oddkin/components/define/button'; // registers <odd-button>
```

```html
<odd-button appearance="primary" type="submit" name="intent" value="save">Save</odd-button>
```

Importing `@oddkin/components/button` gives the class, template, styles, and definition without registering anything. `@oddkin/components/button/foundation` gives the behavior class, template, and structural styles without the default visual styles, for product-specific skins composed with `compose()` (see [multi-product.md](../../docs/architecture/multi-product.md)).

Styles read semantic tokens through component variables (`--odd-button-radius`, `--odd-button-background`, …), so a theme or a scoped override restyles the button without JavaScript. Load a theme stylesheet such as `@oddkin/tokens/css/default.css`.

## Autoload (optional)

```js
import '@oddkin/components/autoload'; // registers each odd-* element on its first appearance
```

The autoloader imports an element's `define/<name>` entry when its tag first appears in the document, once per tag, resolved relative to the autoloader so import maps and CDNs serve the same files. Call `observe(shadowRoot)` for shadow roots your page creates; `load(tag)` registers one tag ahead of time. An `odd-*` tag that is not an Oddkin element is reported once (`autoload.tag.unknown`, through `@oddkin/core/diagnostics`).

Use it for markup you do not control the imports of: content written by people or agents, prototypes, CMS pages. For an application, import each `define/<name>` you use: a bundler sees them, the browser can preload them, and nothing is fetched after the first render. Measured with the same five elements under a strict CSP: two more module requests (the autoloader and its list of names), and the definitions start loading only once it runs (`e2e/autoload.spec.ts`).

## Side navigation from data

```js
import '@oddkin/components/define/side-nav';
import { NavigationItemModel } from '@oddkin/components/models'; // only to validate external data

const nav = document.querySelector('odd-side-nav');
const result = NavigationItemModel.validate(await (await fetch('/nav.json')).json());
if (result.ok) nav.items = result.value; // replace the array to change entries; never mutate it
nav.current = 'theming';
nav.addEventListener('odd-action', (e) => run(e.detail.action));
```

Links render as native `<a href>` (script URLs never do), actions as buttons that emit `odd-action`, and groups as disclosure buttons. Without `items`, native links in the default slot are styled instead; `header` and `footer` slots work with both. Set `expanded` to own group expansion yourself; otherwise the element tracks it and emits a cancelable `odd-toggle`. The `side-nav` layout recipe arranges entries by the element's own width (container queries only). The JSON Schema for the same model is `@oddkin/components/schemas/oddkin.navigation.v1.json`.

## Shared styles for your own components and pages

```js
import { hostStyles, focusRingStyles, visuallyHiddenStyles } from '@oddkin/components/styles';
// styles: [hostStyles, myStructuralStyles, focusRingStyles, visuallyHiddenStyles, myStyles]
```

Each primitive is one constructed sheet per document, shared by every component that adopts it. For pages, opt in to `@oddkin/components/css/reset.css`, `base.css` (theme-driven body text, links, focus ring), and `utilities.css` (`.odd-visually-hidden`, `.odd-focus-ring`); each sits in its Oddkin cascade layer, so unlayered page CSS overrides it.

## Styling and browser support

- Customize through inherited tokens, documented component variables, host styles, parts, and custom states: `odd-input:state(user-invalid)::part(control) { … }` styles the field while it shows its error (the same state that sets `aria-invalid`).
- Unlayered page CSS overrides the generated tokens (they sit in the `odd.tokens` layer); page selectors never reach inside a component.
- Hover feedback appears only where the primary pointer can hover; focus rings are outlines and stay visible in forced-colors mode; long labels and URLs wrap inside narrow containers; sizes are in `rem` and targets never fall below the target-size token.
- Supported browsers: Chrome and Edge 130, Firefox 132, Safari 18.2 and later (mobile equivalents included). See [css-architecture.md](../../docs/architecture/css-architecture.md) and the [platform feature matrix](../../docs/compatibility/matrix.md).
