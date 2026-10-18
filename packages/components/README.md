# @oddkin/components

Accessible, themed custom elements, Oddkin layout presets, and component metadata.

**Status:** M4 in progress. Implemented: `odd-button`, `odd-card`, `odd-input`. See [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) and [packages.md](../../docs/architecture/packages.md).

## Use

```js
import '@oddkin/components/define/button'; // registers <odd-button>
```

```html
<odd-button appearance="primary" type="submit" name="intent" value="save">Save</odd-button>
```

Importing `@oddkin/components/button` gives the class, template, styles, and definition without registering anything. `@oddkin/components/button/foundation` gives the behavior class, template, and structural styles without the default visual styles, for product-specific skins composed with `compose()` (see [multi-product.md](../../docs/architecture/multi-product.md)).

Styles read semantic tokens through component variables (`--odd-button-radius`, `--odd-button-background`, …), so a theme or a scoped override restyles the button without JavaScript. Load a theme stylesheet such as `@oddkin/tokens/css/default.css`.

## Styling and browser support

- Customize through inherited tokens, documented component variables, host styles, parts, and custom states: `odd-input:state(user-invalid)::part(control) { … }` styles the field while it shows its error (the same state that sets `aria-invalid`).
- Unlayered page CSS overrides the generated tokens (they sit in the `odd.tokens` layer); page selectors never reach inside a component.
- Hover feedback appears only where the primary pointer can hover; focus rings are outlines and stay visible in forced-colors mode; long labels and URLs wrap inside narrow containers; sizes are in `rem` and targets never fall below the target-size token.
- Supported browsers: Chrome and Edge 125, Firefox 126, Safari 17.4 and later (mobile equivalents included). See [css-architecture.md](../../docs/architecture/css-architecture.md) and the [platform feature matrix](../../docs/compatibility/matrix.md).
