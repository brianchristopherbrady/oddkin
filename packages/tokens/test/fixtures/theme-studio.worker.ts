import { emitInspectJson, generate } from '@oddkin/tokens/generate';

/**
 * Reference Theme Studio worker on the published entry: a draft in, plain data out. The resolved
 * theme holds Maps and stays here; the inspection text is what "View draft" needs.
 */
self.onmessage = (event: MessageEvent<{ id: number; draft: unknown }>) => {
  const { id, draft } = event.data;
  const result = generate(draft);
  self.postMessage({
    id,
    ok: result.ok,
    diagnostics: result.diagnostics,
    css: result.css,
    inspection: result.theme ? emitInspectJson(result.theme, result.diagnostics) : undefined,
  });
};
