// The Workbench frame runtime for the reference pages' live previews (apps/docs/frame.html).
import '@oddkin/workbench/frame';

// Example fixtures write markup with innerHTML. The frame's policy (only this document's) allows
// a default Trusted Types policy for it; scripts still run only from 'self', so markup runs none.
(
  globalThis as {
    trustedTypes?: {
      createPolicy(name: string, rules: { createHTML(html: string): string }): void;
    };
  }
).trustedTypes?.createPolicy('default', { createHTML: (html) => html });

// The reference page gives the example a short canvas (14rem). The frame grows to fit what the
// component draws in flow, gives a modal dialog a room to open in, and grows further while an
// anchored overlay is held at its edge; it takes its height back as these go away.
function fitFrame(frame: HTMLIFrameElement): void {
  const preview = document.querySelector<HTMLElement>('[data-oddkin-preview]');
  if (!preview) return;
  // Reset reloads this document in the same element: start from the height the page gave it.
  const own = frame.dataset['ownHeight'] ?? frame.style.blockSize;
  frame.dataset['ownHeight'] = own;
  frame.style.blockSize = own;
  const base = frame.getBoundingClientRect().height;
  // Overlays keep 8 px from the viewport, a modal dialog about 1em.
  const EDGE = 24;
  const STEP = 240;
  // Dialogs, drawers, and palettes size themselves to the viewport.
  const ROOM = 560;
  let grown = 0;
  let steps = 0;
  let padded = '';

  const overlays = (root: Document | ShadowRoot, found: HTMLElement[] = []) => {
    for (const element of root.querySelectorAll<HTMLElement>('*')) {
      if (element.shadowRoot) overlays(element.shadowRoot, found);
      if (element.matches(':popover-open, dialog:modal')) found.push(element);
    }
    return found;
  };

  // Clear of the edges, an overlay that still scrolls has a maximum of its own.
  const lackOf = (overlay: HTMLElement) => {
    const rect = overlay.getBoundingClientRect();
    if (rect.top > EDGE && rect.bottom < innerHeight - EDGE) return 0;
    return Math.max(overlay.scrollHeight - overlay.clientHeight, rect.bottom - innerHeight, 0);
  };

  const contentHeight = () => {
    let top = Infinity;
    let bottom = -Infinity;
    for (const child of preview.children) {
      const rect = child.getBoundingClientRect();
      top = Math.min(top, rect.top);
      bottom = Math.max(bottom, rect.bottom);
    }
    const padding = parseFloat(getComputedStyle(preview).paddingBlockStart) || 0;
    return bottom > top ? Math.ceil(bottom - top + 2 * padding) : 0;
  };

  const resized = new ResizeObserver(() => schedule());

  const measure = () => {
    for (const child of preview.children) resized.observe(child);
    const fit = Math.max(base, contentHeight());
    const open = overlays(document);
    if (open.length === 0) {
      grown = 0;
      steps = 0;
    } else {
      const lack = Math.max(...open.map(lackOf));
      if (lack >= 1 && steps < 8) {
        steps++;
        grown += Math.min(lack, STEP) + EDGE;
      }
    }
    const room = open.some((overlay) => overlay.matches('dialog:modal')) ? ROOM : 0;
    const height = Math.max(fit, room) + grown;
    // The component keeps its place in the fitted canvas; added height pads below it.
    const padding = height > fit ? `calc(var(--odd-space-md, 1rem) + ${height - fit}px)` : '';
    if (padding !== padded) preview.style.paddingBlockEnd = padded = padding;
    if (Math.abs(frame.getBoundingClientRect().height - height) >= 1)
      frame.style.blockSize = height === base ? own : `${height}px`;
  };

  let pending = 0;
  const schedule = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => (pending = requestAnimationFrame(measure)));
  };
  for (const type of ['click', 'keyup', 'focusout'])
    document.addEventListener(type, schedule, { capture: true });
  addEventListener('resize', schedule);
  // The mount, fixtures, and the page's controls (such as `open`) change the content.
  new MutationObserver(schedule).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
  });
}

// Same origin: the frame sizes its own iframe element (another realm, so no instanceof).
const host = window.frameElement;
if (host?.localName === 'iframe') fitFrame(host as HTMLIFrameElement);
