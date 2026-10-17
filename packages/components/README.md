# @mote/components

Accessible, themed custom elements, Mote layout presets, and component metadata.

**Status:** M4 in progress. Implemented: `mote-button`. See [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) and [packages.md](../../docs/architecture/packages.md).

## Use

```js
import '@mote/components/define/button'; // registers <mote-button>
```

```html
<mote-button appearance="primary" type="submit" name="intent" value="save">Save</mote-button>
```

Importing `@mote/components/button` gives the class, template, styles, and definition without registering anything. `@mote/components/button/foundation` gives the behavior class, template, and structural styles without the default visual styles, for product-specific skins composed with `compose()` (see [multi-product.md](../../docs/architecture/multi-product.md)).

Styles read semantic tokens through component variables (`--mote-button-radius`, `--mote-button-background`, …), so a theme or a scoped override restyles the button without JavaScript. Load a theme stylesheet such as `@mote/tokens/css/default.css`.
