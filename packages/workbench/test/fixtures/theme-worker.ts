// A theme generator for the panel tests: each draft becomes one custom property, and a primary
// of `invalid` is refused, as the real generator refuses a value that is not a colour.
const worker = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
};

worker.addEventListener('message', (event) => {
  const { id, draft } = event.data as { id: number; draft: { brand?: { primary?: string } } };
  const primary = draft.brand?.primary ?? 'red';
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
