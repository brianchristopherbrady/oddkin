/**
 * `@oddkin/workbench/theme-link`: a team's own app with Theme Studio's draft (P1.5 item 6). Load
 * it in development only, for example behind `import.meta.env.DEV`; nothing of it belongs in a
 * production build. With `themeStudio.app` set to this app's URL, Theme Studio in
 * `oddkin workbench dev` opens the app and sends the draft's CSS, which replaces one stylesheet
 * here, as the generated CSS does in Theme Studio's preview frames: the app keeps its state.
 *
 * Messages are taken only from the window Theme Studio runs in, at its origin; the CSS goes into
 * a constructed stylesheet, which runs no script and loads no `@import`.
 */
import { OddkinError } from '@oddkin/core/diagnostics';

/** The messages between Theme Studio and the app. */
export type ThemeLinkMessage =
  | { readonly protocol: 'oddkin.theme-link'; readonly version: 1; readonly type: 'ready' }
  | {
      readonly protocol: 'oddkin.theme-link';
      readonly version: 1;
      readonly type: 'css';
      readonly css: string;
    };

export interface ThemeLinkOptions {
  /** Theme Studio's origin, as `oddkin workbench dev` serves it, e.g. `http://localhost:4175`. */
  readonly studio: string;
  /**
   * The stylesheet the draft replaces, as an element (`<link rel="stylesheet">` or `<style>`)
   * or a selector for one: it is disabled while the draft applies. Unset, the draft is added
   * after the page's stylesheets.
   */
  readonly stylesheet?: string | HTMLLinkElement | HTMLStyleElement;
  /** The window Theme Studio runs in; by default, the one that opened this page. */
  readonly studioWindow?: Window | null;
  /** The page's document; by default, this one. */
  readonly document?: Document;
}

/**
 * Theme Studio's origin from `studio`, an absolute http or https URL: never `*`, a relative path,
 * or another scheme, whose opaque origin a sandboxed or `data:` window would share.
 */
function studioOrigin(studio: string): string {
  let url: URL | undefined;
  try {
    url = new URL(studio);
  } catch {
    // Not an absolute URL.
  }
  if (!url || !/^https?:$/.test(url.protocol))
    throw new OddkinError(
      'themeLink.studio.invalid',
      `studio must be Theme Studio's http or https origin, such as http://localhost:4175, not ${JSON.stringify(studio)}.`,
    );
  return url.origin;
}

/**
 * Takes Theme Studio's draft in this page: says it is ready, then applies each CSS it receives.
 * Returns a function that stops, removing the draft and enabling the stylesheet again. Without
 * a Theme Studio window (a page not opened from Theme Studio), it does nothing. Throws
 * `themeLink.studio.invalid` unless `studio` is an http or https URL.
 */
export function linkThemeStudio(options: ThemeLinkOptions): () => void {
  const origin = studioOrigin(options.studio);
  const doc = options.document ?? document;
  const view = doc.defaultView;
  const studio =
    options.studioWindow === undefined ? (view?.opener as Window | null) : options.studioWindow;
  if (!view || !studio) return () => {};
  let sheet: CSSStyleSheet | undefined;
  let replaced: HTMLLinkElement | HTMLStyleElement | null = null;
  const receive = (event: MessageEvent) => {
    const data = event.data as Readonly<Record<string, unknown>> | null;
    const css = data?.['css'];
    if (
      event.source !== studio ||
      event.origin !== origin ||
      data?.['protocol'] !== 'oddkin.theme-link' ||
      data['version'] !== 1 ||
      data['type'] !== 'css' ||
      typeof css !== 'string'
    )
      return;
    if (!sheet) {
      sheet = new view.CSSStyleSheet();
      replaced =
        typeof options.stylesheet === 'string'
          ? doc.querySelector<HTMLLinkElement | HTMLStyleElement>(options.stylesheet)
          : (options.stylesheet ?? null);
      if (replaced) replaced.disabled = true;
      doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
    }
    sheet.replaceSync(css);
  };
  view.addEventListener('message', receive);
  const ready: ThemeLinkMessage = { protocol: 'oddkin.theme-link', version: 1, type: 'ready' };
  studio.postMessage(ready, origin);
  return () => {
    view.removeEventListener('message', receive);
    if (sheet) doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((s) => s !== sheet);
    if (replaced) replaced.disabled = false;
  };
}
