# @oddkin/components

Accessible, themed custom elements, Oddkin layout presets, and component metadata.

**Status:** M4 in progress. Implemented: `odd-button`. See [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) and [packages.md](../../docs/architecture/packages.md).

## Use

```js
import '@oddkin/components/define/button'; // registers <odd-button>
```

```html
<odd-button appearance="primary" type="submit" name="intent" value="save">Save</odd-button>
```

Importing `@oddkin/components/button` gives the class, template, styles, and definition without registering anything. `@oddkin/components/button/foundation` gives the behavior class, template, and structural styles without the default visual styles, for product-specific skins composed with `compose()` (see [multi-product.md](../../docs/architecture/multi-product.md)).

Styles read semantic tokens through component variables (`--odd-button-radius`, `--odd-button-background`, …), so a theme or a scoped override restyles the button without JavaScript. Load a theme stylesheet such as `@oddkin/tokens/css/default.css`.
