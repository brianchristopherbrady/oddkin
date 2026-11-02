// A theme generator for the panel tests: each draft becomes one custom property.
const worker = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
};

worker.addEventListener('message', (event) => {
  const { id, draft } = event.data as { id: number; draft: { brand?: { primary?: string } } };
  const primary = draft.brand?.primary ?? 'red';
  worker.postMessage({
    id,
    ok: true,
    css: `:root { --fixture-primary: ${primary}; }`,
    diagnostics: [],
    ms: 1,
  });
});
