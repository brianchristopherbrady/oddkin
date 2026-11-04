// A theme generator for the panel tests: each draft becomes one custom property, and a primary
// of `invalid` is refused, as the real generator refuses a value that is not a colour. A draft on
// bases takes the primary of the last file that sets one, as the merge of theme files does.
const worker = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
};

type Theme = { brand?: { primary?: string } };

worker.addEventListener('message', (event) => {
  const { id, draft, bases = [] } = event.data as { id: number; draft: Theme; bases?: Theme[] };
  const primary =
    [...bases, draft].reduce<string | undefined>(
      (value, layer) => layer.brand?.primary ?? value,
      undefined,
    ) ?? 'red';
  if (primary === 'invalid') {
    const message = 'brand.primary is not a colour.';
    worker.postMessage({ id, ok: false, diagnostics: [{ severity: 'error', message }], ms: 1 });
    return;
  }
  worker.postMessage({
    id,
    ok: true,
    css: `:root { --fixture-primary: ${primary}; }`,
    diagnostics: [],
    ms: 1,
  });
});
