import type { Diagnostic } from '@oddkin/tokens/generate';
import { afterAll, describe, expect, it } from 'vitest';
import { commands, server } from 'vitest/browser';

interface Reply {
  readonly id: number;
  readonly ok: boolean;
  readonly diagnostics: readonly Diagnostic[];
  readonly css?: string;
  readonly inspection?: string;
}

// One long-lived worker, as Theme Studio keeps one: drafts go in by postMessage, replies come back by id.
const worker = new Worker(new URL('./fixtures/theme-studio.worker.ts', import.meta.url), {
  type: 'module',
});
const waiting = new Map<number, { resolve: (reply: Reply) => void; reject: (e: Error) => void }>();
worker.onmessage = (event: MessageEvent<Reply>) => {
  waiting.get(event.data.id)?.resolve(event.data);
  waiting.delete(event.data.id);
};
worker.onerror = (event) => {
  for (const { reject } of waiting.values()) reject(new Error(event.message));
  waiting.clear();
};
let lastId = 0;
const run = (draft: unknown) =>
  new Promise<Reply>((resolve, reject) => {
    const id = ++lastId;
    waiting.set(id, { resolve, reject });
    worker.postMessage({ id, draft });
  });
afterAll(() => worker.terminate());

// Exact bytes from disk; Vite would transform CSS and JSON served as modules.
const read = (path: string) => commands.readFile(path);
const paths = (reply: Reply) => reply.diagnostics.map((d) => [d.code, d.severity, d.path]);

describe('the published generator in a module Worker', () => {
  it('generates the shipped default theme byte for byte: CSS and token inspection', async () => {
    const config = JSON.parse(await read('packages/tokens/themes/default.theme.json')) as unknown;
    const reply = await run(config);
    expect([reply.ok, reply.diagnostics]).toEqual([true, []]);
    expect(reply.css).toBe(await read('packages/tokens/dist/css/default.css'));
    expect(reply.inspection).toBe(await read('packages/tokens/dist/inspect/default.inspect.json'));
  });

  it('matches what the oddkin-tokens CLI wrote for the same configuration', async () => {
    // build-token-assets.mjs runs the real bin: oddkin-tokens build theme.json --format css --strict.
    const config = JSON.parse(await read('examples/tokens-css-only/theme.json')) as unknown;
    const reply = await run(config);
    expect(reply.ok).toBe(true);
    expect(reply.css).toBe(await read('examples/tokens-css-only/generated/harbor.css'));
  });

  it('answers invalid drafts with paths into the draft and no output, and keeps working', async () => {
    const structural = await run({ brand: { primary: 'nope' }, spacing: null, colour: {} });
    expect([structural.ok, structural.css, structural.inspection]).toEqual([
      false,
      undefined,
      undefined,
    ]);
    expect(paths(structural)).toEqual([
      ['config.unknownKey', 'error', '/colour'],
      ['color.invalid', 'error', '/brand/primary'],
      ['config.type', 'error', '/spacing'],
    ]);

    const resolved = await run({
      brand: { primary: '#5b46e8' },
      overrides: { 'radius.md': '{layout.gap}', 'color.text.primry': '#000' },
    });
    expect(paths(resolved)).toEqual([
      ['override.unknown', 'error', '/overrides/color.text.primry'],
      ['tier.violation', 'error', '/overrides/radius.md'],
    ]);
    expect(resolved.diagnostics[0]?.suggestion).toBe('Did you mean "color.text.primary"?');
    expect(paths(await run('not a theme'))).toEqual([['config.type', 'error', '']]);

    const warned = await run({
      brand: { primary: '#5b46e8' },
      overrides: { 'color.text.secondary': { light: '#bbbbbb', dark: '{ref.neutral.300}' } },
    });
    expect([warned.ok, typeof warned.css, typeof warned.inspection]).toEqual([
      true,
      'string',
      'string',
    ]);
    expect(paths(warned)[0]).toEqual(['contrast.fail', 'warning', '/tokens/color.text.secondary']);
  });

  it('applies as a constructed sheet in a frame document, replaced in place', async () => {
    const frame = document.createElement('iframe');
    frame.srcdoc = '<!doctype html><html><body><p>Preview</p></body></html>';
    document.body.append(frame);
    await expect.poll(() => frame.contentDocument?.querySelector('p')).toBeTruthy();
    const view = frame.contentWindow as Window & typeof globalThis;
    const doc = frame.contentDocument as Document;
    const value = (name: string) =>
      view.getComputedStyle(doc.documentElement).getPropertyValue(name).trim();

    const brand = { primary: '#5b46e8' };
    const first = await run({ brand, overrides: { 'radius.md': '0.375rem' } });
    const next = await run({ brand, overrides: { 'radius.md': '0.625rem' } });
    expect(first.css).not.toContain('@import');

    // The same rules a <style> element parses: nothing is dropped by the constructed-sheet path.
    const sheet = new view.CSSStyleSheet();
    sheet.replaceSync(first.css as string);
    const style = doc.createElement('style');
    style.textContent = first.css as string;
    doc.head.append(style);
    const texts = (rules: CSSRuleList) => [...rules].map((rule) => rule.cssText);
    expect(sheet.cssRules.length).toBeGreaterThan(1);
    expect(texts(sheet.cssRules)).toEqual(texts((style.sheet as CSSStyleSheet).cssRules));
    style.remove();

    doc.adoptedStyleSheets = [sheet];
    const paragraph = doc.querySelector('p') as HTMLParagraphElement;
    expect(value('--odd-radius-md')).toBe('0.375rem');
    sheet.replaceSync(next.css as string);
    expect(value('--odd-radius-md')).toBe('0.625rem');
    expect(doc.querySelector('p')).toBe(paragraph);

    // A constructed sheet belongs to the document whose realm constructed it. A rejected assignment
    // empties the array in Chromium and Firefox (WebKit keeps it), so never assign a foreign sheet:
    // construct with the frame's CSSStyleSheet and update it with replaceSync.
    const foreign = new CSSStyleSheet();
    foreign.replaceSync(next.css as string);
    expect(() => {
      doc.adoptedStyleSheets = [foreign];
    }).toThrow();
    expect([doc.adoptedStyleSheets.length, value('--odd-radius-md')]).toEqual(
      server.browser === 'webkit' ? [1, '0.625rem'] : [0, ''],
    );
    doc.adoptedStyleSheets = [sheet];
    expect(value('--odd-radius-md')).toBe('0.625rem');
    frame.remove();
  });
});
