// A theme generator for the panel tests: each draft becomes one custom property, and a primary
// of `invalid` is refused, as the real generator refuses a value that is not a colour. A draft on
// bases takes the primary of the last file that sets one, as the merge of theme files does, and
// each product its own primary, else the theme's; with `products`, the reply carries each one's
// values (its primary), as the real Worker's carry every token's. With `view` (a product, or ''
// for the theme), it carries that one's views: three ramp steps out of order, the brand step its
// primary, and two contrast pairs, the failing one last, so the views' ordering shows.
const worker = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
};

type Theme = {
  brand?: { primary?: string };
  products?: Record<string, { brand?: { primary?: string } } | null>;
};

type Request = { id: number; draft: Theme; bases?: Theme[]; products?: string[]; view?: string };

worker.addEventListener('message', (event) => {
  const { id, draft, bases = [], products, view } = event.data as Request;
  const layers = [...bases, draft];
  const last = (read: (layer: Theme) => string | undefined) =>
    layers.reduce<string | undefined>((value, layer) => read(layer) ?? value, undefined);
  const primary = last((layer) => layer.brand?.primary) ?? 'red';
  if (primary === 'invalid') {
    const message = 'brand.primary is not a colour.';
    worker.postMessage({ id, ok: false, diagnostics: [{ severity: 'error', message }], ms: 1 });
    return;
  }
  const own = (product: string) => last((layer) => layer.products?.[product]?.brand?.primary);
  const rule = (product: string) =>
    ` [data-odd-product="${product}"] { --fixture-primary: ${own(product) ?? primary}; }`;
  const rules = Object.keys(Object.assign({}, ...layers.map((layer) => layer.products ?? {})))
    .map(rule)
    .join('');
  const pair = (mode: string, foregroundHex: string, ratio: number, status: string) => ({
    concern: 'text',
    foreground: 'color.text.primary',
    background: 'color.canvas',
    mode,
    foregroundHex,
    backgroundHex: '#ffffff',
    ratio,
    minimum: 4.5,
    criterion: '1.4.3',
    status,
  });
  const views =
    view === undefined
      ? undefined
      : {
          ramps: [
            ['ref.neutral.1000', '#000000'],
            ['ref.brand.500', (view && own(view)) || primary],
            ['ref.neutral.0', '#ffffff'],
          ],
          contrast: [pair('light', '#000000', 21, 'pass'), pair('dark', '#cccccc', 1.6, 'fail')],
        };
  worker.postMessage({
    id,
    ok: true,
    css: `:root { --fixture-primary: ${primary}; }${rules}`,
    diagnostics: [],
    ms: 1,
    ...(products
      ? { values: Object.fromEntries(products.map((p) => [p, own(p) ?? primary])) }
      : {}),
    ...(views ? { views } : {}),
  });
});
