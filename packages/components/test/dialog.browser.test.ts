import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { OddkinElement, define } from '@oddkin/core/element';
import { flush } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { scopeStats } from '@oddkin/core/scope';
import { html } from '@oddkin/core/template';
import { dialogDefinition } from '../src/dialog/index.js';
import type { OddkinDialog } from '../src/dialog/dialog.js';
import { ModalDialog, firstFocusable } from '../src/overlay/dialog.js';
import { deepActiveElement } from '../src/overlay/overlay.js';
import { hostStyles } from '../src/styles/host.styles.js';
import { overlaySurfaceStructuralStyles } from '../src/styles/overlay-surface.structural.styles.js';
import { overlaySurfaceStyles } from '../src/styles/overlay-surface.styles.js';
import './register.js';
import { loadTheme, probeTag, settle, themeValue } from './probe.js';

// odd-dialog (component-contracts.md §2.6, §3.5) and the modal wiring it is built on.
let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
});
afterAll(() => unload());

let container: HTMLElement;
afterEach(() => {
  container?.remove();
  flush();
});
async function mount(markup: string, attributes: Record<string, string> = {}) {
  container = document.createElement('div');
  for (const [name, value] of Object.entries(attributes)) container.setAttribute(name, value);
  container.innerHTML = `<button id="before">before</button>${markup}<button id="after">after</button>`;
  document.body.append(container);
  for (const el of container.querySelectorAll('*')) await settle(el);
  return container;
}
const byId = <E extends HTMLElement = HTMLElement>(id: string) =>
  container.querySelector<E>(`#${id}`)!;
const inner = (el: Element) => el.shadowRoot!.querySelector('dialog')!;
const part = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);
const closed = (el: Element) =>
  new Promise<Event>((resolve) => el.addEventListener('close', resolve, { once: true }));
const box = (el: Element) => el.getBoundingClientRect();
const DIALOG = `<button id="trigger">Rename</button><odd-dialog id="d" label="Rename workspace"><p>Choose a clear name.</p><input id="name" value="Design"><button id="save" slot="footer">Save</button></odd-dialog>`;
/** Activates the trigger from the keyboard: Safari does not focus a button on a press. */
async function press(trigger: HTMLElement) {
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  await new Promise(requestAnimationFrame);
}
/** Mounts DIALOG, opens it from the trigger, and returns it. */
async function opened(markup = DIALOG) {
  await mount(markup);
  const el = byId<OddkinDialog>('d');
  const trigger = byId('trigger');
  trigger.addEventListener('click', () => el.show());
  await press(trigger);
  await settle(el);
  return { el, trigger };
}
/** Runs `body` as if the browser had no native `closedby`. */
async function withoutNativeClosedBy(body: () => Promise<void>) {
  const proto = HTMLDialogElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'closedBy');
  if (descriptor) delete (proto as { closedBy?: string }).closedBy;
  try {
    await body();
  } finally {
    if (descriptor) Object.defineProperty(proto, 'closedBy', descriptor);
  }
}
/** A press on the backdrop, near the viewport's corner. */
const pressBackdrop = () =>
  userEvent.click(document.body, { position: { x: 4, y: 4 }, force: true });

describe('odd-dialog', () => {
  it('opens modally from show(), leaving only its own content reachable', async () => {
    const { el } = await opened();
    expect(inner(el).matches(':modal')).toBe(true);
    expect(el.open).toBe(true);
    expect(el.hasAttribute('open')).toBe(true);
    // The page behind is inert; the slotted content is not.
    byId('after').focus();
    expect(document.activeElement).not.toBe(byId('after'));
    byId('save').focus();
    expect(document.activeElement).toBe(byId('save'));
    const done = closed(el);
    el.close();
    await done;
    expect(inner(el).open).toBe(false);
    expect(el.open).toBe(false);
    await settle(el);
    expect(el.hasAttribute('open')).toBe(false);
  });

  it('is a dialog named by its title; an alert dialog is described by its body', async () => {
    const tag = probeTag(dialogDefinition);
    await mount(`<${tag} label="Rename workspace"><p>Body.</p></${tag}>`);
    const el = container.querySelector(tag)!;
    const dialog = inner(el);
    expect(dialog.getAttribute('role')).toBeNull();
    const title = el.shadowRoot!.getElementById(dialog.getAttribute('aria-labelledby')!)!;
    expect(title.localName).toBe('h2');
    expect(title.textContent).toBe('Rename workspace');
    expect(dialog.hasAttribute('aria-describedby')).toBe(false);
    el.setAttribute('alert', '');
    await settle(el);
    expect(dialog.getAttribute('role')).toBe('alertdialog');
    const body = el.shadowRoot!.getElementById(dialog.getAttribute('aria-describedby')!)!;
    expect(body.getAttribute('part')).toBe('body');
    el.removeAttribute('alert');
    await settle(el);
    expect(dialog.getAttribute('role')).toBeNull();
    expect(dialog.hasAttribute('aria-describedby')).toBe(false);
  });

  it.runIf(server.browser === 'chromium')(
    'the accessibility tree reports its role, name, and description',
    async () => {
      const { el } = await opened(
        DIALOG.replace('label="Rename workspace"', 'label="Delete workspace?" alert'),
      );
      const session = cdp();
      await session.send('Accessibility.enable');
      try {
        type Frame = { frame: { id: string }; childFrames?: Frame[] };
        const ids = (tree: Frame): string[] => [
          tree.frame.id,
          ...(tree.childFrames ?? []).flatMap((child) => ids(child)),
        ];
        const { frameTree } = (await session.send('Page.getFrameTree')) as { frameTree: Frame };
        type Node = {
          role?: { value: string };
          name?: { value: string };
          description?: { value: string };
        };
        const nodes: Node[] = [];
        for (const frameId of ids(frameTree))
          nodes.push(
            ...(
              (await session.send('Accessibility.getFullAXTree', { frameId })) as {
                nodes: Node[];
              }
            ).nodes,
          );
        const node = nodes.find((n) => n.role?.value === 'alertdialog');
        expect(node?.name?.value).toBe('Delete workspace?');
        expect(node?.description?.value).toContain('Choose a clear name.');
      } finally {
        await session.send('Accessibility.disable');
        el.close();
      }
    },
  );

  it('moves focus to autofocus, else the first control in its content, else the close button', async () => {
    let { el } = await opened();
    expect(document.activeElement).toBe(byId('name'));
    el.close();
    container.remove();

    ({ el } = await opened(DIALOG.replace('id="save"', 'id="save" autofocus')));
    expect(document.activeElement).toBe(byId('save'));
    el.close();
    container.remove();

    // Disabled and hidden controls are skipped; a focus-delegating host takes focus.
    ({ el } = await opened(
      DIALOG.replace(
        '<input id="name" value="Design">',
        '<button disabled>Off</button><input hidden><button slot="nowhere">Unslotted</button><odd-button id="go">Go</odd-button>',
      ),
    ));
    expect(document.activeElement).toBe(byId('go'));
    el.close();
    container.remove();

    ({ el } = await opened(
      '<button id="trigger">Open</button><odd-dialog id="d" label="Notice"><p>Text only.</p></odd-dialog>',
    ));
    expect(el.shadowRoot!.activeElement).toBe(part(el, 'close'));
  });

  it('returns focus to the control that opened it, however it closes', async () => {
    let { el, trigger } = await opened();
    let done = closed(el);
    await userEvent.keyboard('{Escape}');
    await done;
    expect(document.activeElement).toBe(trigger);

    await press(trigger);
    await settle(el);
    done = closed(el);
    await userEvent.click(part(el, 'close')!);
    await done;
    expect(el.open).toBe(false);
    expect(document.activeElement).toBe(trigger);

    await press(trigger);
    await settle(el);
    done = closed(el);
    el.open = false;
    await done;
    expect(document.activeElement).toBe(trigger);

    // Opened with no focused control (a press in Safari): focus leaves the closed dialog.
    (document.activeElement as HTMLElement).blur();
    el.show();
    expect(document.activeElement).toBe(byId('name'));
    done = closed(el);
    el.close();
    await done;
    expect(document.activeElement).toBe(document.body);

    // Opened by a press, which focuses the trigger in Chromium and Firefox but not in Safari:
    // focus never stays in the closed dialog.
    for (const close of [() => userEvent.keyboard('{Escape}'), async () => el.close()]) {
      await userEvent.click(trigger);
      await settle(el);
      expect(document.activeElement).toBe(byId('name'));
      done = closed(el);
      await close();
      await done;
      const active = document.activeElement;
      expect(active === el || el.contains(active)).toBe(false);
    }
  });

  it('closes on Escape after a cancelable cancel at the host, then fires close', async () => {
    const { el } = await opened();
    const seen: string[] = [];
    el.addEventListener('cancel', () => seen.push('cancel'));
    el.addEventListener('close', () => seen.push('close'));
    el.addEventListener('cancel', (event) => event.preventDefault(), { once: true });
    await userEvent.keyboard('{Escape}');
    await new Promise(requestAnimationFrame);
    expect(inner(el).open).toBe(true);
    expect(seen).toEqual(['cancel']);
    // Pressing inside is a user activation, so the next cancel is cancelable again.
    await userEvent.click(byId('name'));
    const done = closed(el);
    await userEvent.keyboard('{Escape}');
    await done;
    expect(seen).toEqual(['cancel', 'cancel', 'close']);
    expect(el.open).toBe(false);
  });

  for (const native of [true, false]) {
    const run = native
      ? (body: () => Promise<void>) => body()
      : (body: () => Promise<void>) => withoutNativeClosedBy(body);
    const how = native ? 'natively where supported' : 'emulated';

    it(`closes on a backdrop press with closedby="any" (${how})`, async () => {
      await run(async () => {
        const { el, trigger } = await opened(DIALOG.replace('label=', 'closedby="any" label='));
        expect(el.closedBy).toBe('any');
        const seen: string[] = [];
        el.addEventListener('cancel', () => seen.push('cancel'));
        // A press inside, on its content or on its own border, keeps it open.
        await userEvent.click(part(el, 'header')!, { position: { x: 48, y: 4 } });
        await userEvent.click(inner(el), { position: { x: 0, y: 48 }, force: true });
        expect(inner(el).open).toBe(true);
        expect(seen).toEqual([]);
        if (!native) {
          // Emulated: a press on its own box (its border or padding) is inside, and a press on
          // content drawn outside its box (a nested popover) is not on the backdrop.
          const box = inner(el).getBoundingClientRect();
          const press = (target: Element, clientX: number, clientY: number) =>
            target.dispatchEvent(
              new MouseEvent('click', { bubbles: true, composed: true, clientX, clientY }),
            );
          press(inner(el), box.left + 0.5, box.top + 48);
          press(byId('name'), box.left - 8, box.top - 8);
          expect(inner(el).open).toBe(true);
          expect(seen).toEqual([]);
        }
        // The host's cancel can keep it open.
        el.addEventListener('cancel', (event) => event.preventDefault(), { once: true });
        await pressBackdrop();
        await new Promise(requestAnimationFrame);
        expect(inner(el).open).toBe(true);
        const done = closed(el);
        await pressBackdrop();
        await done;
        expect(el.open).toBe(false);
        expect(seen).toEqual(['cancel', 'cancel']);
        expect(document.activeElement).toBe(trigger);
      });
      // Six presses: Firefox needed more than 15 s once while three lanes ran browsers.
    }, 30_000);

    it(`stays open on a backdrop press by default, and on Escape with closedby="none" (${how})`, async () => {
      await run(async () => {
        const { el } = await opened();
        await pressBackdrop();
        await new Promise(requestAnimationFrame);
        expect(inner(el).open).toBe(true);
        el.close();
        el.closedBy = 'none';
        await settle(el);
        await userEvent.click(byId('trigger'));
        await settle(el);
        const seen: string[] = [];
        el.addEventListener('cancel', () => seen.push('cancel'));
        await userEvent.keyboard('{Escape}');
        await pressBackdrop();
        await new Promise(requestAnimationFrame);
        expect(inner(el).open).toBe(true);
        expect(seen).toEqual([]);
      });
    });
  }

  it('sets the native closedby where the browser has it, and nothing where it does not', async () => {
    const { el } = await opened(DIALOG.replace('label=', 'closedby="none" label='));
    expect(inner(el).getAttribute('closedby')).toBe(
      'closedBy' in HTMLDialogElement.prototype ? 'none' : null,
    );
  });

  it('closes from a <form method="dialog"> in its content with the submitter value', async () => {
    const { el, trigger } = await opened(
      `<button id="trigger">Rename</button><odd-dialog id="d" label="Rename workspace">
        <form id="f" method="dialog"><input id="name" name="name" value="Design"></form>
        <button slot="footer" id="cancel" form="f" value="cancel">Cancel</button>
        <odd-button slot="footer" id="save" type="submit" form="f" value="save">Save</odd-button>
      </odd-dialog>`,
    );
    let done = closed(el);
    await userEvent.click(byId('cancel'));
    await done;
    expect(el.returnValue).toBe('cancel');
    expect(document.activeElement).toBe(trigger);

    await press(trigger);
    await settle(el);
    done = closed(el);
    await userEvent.click(byId('save'));
    await done;
    expect(el.returnValue).toBe('save');

    // Enter submits through the form's default button, its first native submit button.
    await press(trigger);
    await settle(el);
    done = closed(el);
    byId('name').focus();
    await userEvent.keyboard('{Enter}');
    await done;
    expect(el.returnValue).toBe('cancel');
  });

  it('closes from a formmethod="dialog" submitter, and ignores other forms', async () => {
    const { el } = await opened(
      `<button id="trigger">Open</button><odd-dialog id="d" label="Filter">
        <form id="f"><input id="q" name="q"></form>
        <button slot="footer" id="apply" form="f" type="submit">Apply</button>
        <button slot="footer" id="cancel" form="f" formmethod="dialog" value="cancel">Cancel</button>
      </odd-dialog>`,
    );
    // Outside the dialog: submissions it did not take.
    let submitted = 0;
    container.addEventListener('submit', (event) => {
      if (!event.defaultPrevented) submitted++;
      event.preventDefault();
    });
    await userEvent.click(byId('apply'));
    expect(submitted).toBe(1);
    expect(inner(el).open).toBe(true);
    const done = closed(el);
    await userEvent.click(byId('cancel'));
    await done;
    expect(el.returnValue).toBe('cancel');
    expect(submitted).toBe(1);
  });

  it('keeps returnValue from close(value), and opens from open and the open attribute', async () => {
    await mount(DIALOG.replace('label=', 'open label='));
    const el = byId<OddkinDialog>('d');
    expect(inner(el).matches(':modal')).toBe(true);
    expect(document.activeElement).toBe(byId('name'));
    let done = closed(el);
    el.close('done');
    await done;
    expect(el.returnValue).toBe('done');
    el.returnValue = '';
    expect(inner(el).returnValue).toBe('');
    el.open = true;
    await settle(el);
    expect(inner(el).matches(':modal')).toBe(true);
    done = closed(el);
    el.close();
    await done;
    expect(el.returnValue).toBe('');
    el.show();
    el.show();
    expect(inner(el).open).toBe(true);
  });

  it('stays closed when show() and close() run in one task, reporting one close', async () => {
    await mount(DIALOG);
    const el = byId<OddkinDialog>('d');
    let closes = 0;
    el.addEventListener('close', () => closes++);
    const done = closed(el);
    el.show();
    el.close();
    expect(el.open).toBe(false);
    await done;
    await settle(el);
    expect(inner(el).open).toBe(false);
    expect(el.hasAttribute('open')).toBe(false);
    expect(closes).toBe(1);
  });

  it('stays open when shown again before the close event of the last close', async () => {
    const { el } = await opened();
    const done = closed(el);
    el.close();
    el.show();
    await done;
    await settle(el);
    expect(inner(el).matches(':modal')).toBe(true);
    expect(el.open).toBe(true);
    expect(el.hasAttribute('open')).toBe(true);
  });

  it('opens from the open attribute at connection with nothing else to update', async () => {
    await mount('<odd-dialog id="d" label="Notice" open>Text only.</odd-dialog>');
    const el = byId<OddkinDialog>('d');
    await settle(el);
    expect(inner(el).matches(':modal')).toBe(true);
  });

  it('lays out a title, body, and footer with the Figma spacing, type, and divider', async () => {
    const { el } = await opened();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const dialog = inner(el);
    const header = part(el, 'header')!;
    const title = part(el, 'title')!;
    const body = part(el, 'body')!;
    const footer = part(el, 'footer')!;
    expect(box(dialog).width).toBe(Math.min(32 * rem, innerWidth - 2 * rem));
    expect(getComputedStyle(header).paddingBlockStart).toBe(`${1.5 * rem}px`);
    expect(getComputedStyle(body).paddingInlineStart).toBe(`${1.5 * rem}px`);
    expect(getComputedStyle(title).fontSize).toBe(`${1.25 * rem}px`);
    expect(getComputedStyle(title).marginBlockStart).toBe('0px');
    expect(getComputedStyle(body).color).toBe(themeValue('color', '--odd-color-text-secondary'));
    const divider = getComputedStyle(footer, '::before');
    expect(divider.backgroundColor).toBe(themeValue('color', '--odd-color-border-default'));
    expect(divider.blockSize).toBe(themeValue('inline-size', '--odd-border-width-default'));
    // The close button sits at the inline-end top corner; the footer actions at the inline end.
    expect(Math.round(box(part(el, 'close')!).right)).toBeGreaterThan(
      Math.round(box(dialog).right) - rem,
    );
    expect(Math.round(box(byId('save')).right)).toBe(Math.round(box(footer).right - 1.5 * rem));
    // A form wrapping the actions lays them out like direct children, space.sm apart.
    const form = document.createElement('form');
    form.slot = 'footer';
    form.innerHTML = '<button id="a">A</button><button id="b">B</button>';
    el.append(form);
    await settle(el);
    expect(`${Math.round(box(byId('b')).left - box(byId('a')).right)}px`).toBe(
      themeValue('inline-size', '--odd-space-sm'),
    );
    expect(Math.round(box(byId('a')).top)).toBe(Math.round(box(byId('b')).top));
    form.remove();
    // An empty footer is hidden.
    byId('save').remove();
    await settle(el);
    expect(footer.hidden).toBe(true);
    expect(box(footer).height).toBe(0);
  });

  it('fits the viewport, following the writing direction', async () => {
    const { el } = await opened(
      DIALOG.replace('<p>Choose a clear name.</p>', `<p>${'A long body. '.repeat(400)}</p>`),
    );
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const dialog = inner(el);
    // 100dvh less space.md on each side; the body scrolls and the footer stays.
    expect(Math.round(box(dialog).height)).toBe(Math.round(innerHeight - 2 * rem));
    const body = part(el, 'body')!;
    expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
    expect(Math.round(box(part(el, 'footer')!).bottom)).toBe(Math.round(box(dialog).bottom) - 1);
    el.style.setProperty('--odd-dialog-inline-size', '200rem');
    expect(Math.round(box(dialog).width)).toBe(Math.round(innerWidth - 2 * rem));
    el.style.setProperty('--odd-dialog-inline-size', '15rem');
    expect(box(dialog).width).toBe(15 * rem);
    el.close();
    container.remove();

    const rtl = await opened();
    container.dir = 'rtl';
    expect(Math.round(box(part(rtl.el, 'close')!).left)).toBeLessThan(
      Math.round(box(inner(rtl.el)).left) + rem,
    );
  });

  it('keeps the theme, density, direction, and language of where it is written (F10)', async () => {
    await mount(DIALOG, {
      'data-odd-mode': 'dark',
      'data-odd-density': 'compact',
      dir: 'rtl',
      lang: 'de',
    });
    const el = byId<OddkinDialog>('d');
    el.show();
    await settle(el);
    const scoped = (property: string, value: string) => {
      const probe = document.createElement('span');
      probe.style.setProperty(property, value);
      container.append(probe);
      const result = getComputedStyle(probe).getPropertyValue(property);
      probe.remove();
      return result;
    };
    const dialog = inner(el);
    const background = getComputedStyle(dialog).backgroundColor;
    expect(background).toBe(scoped('background-color', 'var(--odd-color-surface-default)'));
    expect(background).not.toBe(themeValue('background-color', '--odd-color-surface-default'));
    const padding = getComputedStyle(part(el, 'header')!).paddingBlockStart;
    expect(padding).toBe(scoped('padding-block-start', 'var(--odd-space-lg)'));
    expect(padding).not.toBe(themeValue('padding-block-start', '--odd-space-lg'));
    expect(dialog.matches(':dir(rtl)')).toBe(true);
    expect(box(part(el, 'close')!).left).toBeLessThan(box(dialog).left + box(dialog).width / 2);
    // As in the popover test: Firefox does not match `:lang()` inside the shadow root.
    expect(el.matches(':lang(de)')).toBe(true);
    expect(byId('name').matches(':lang(de)')).toBe(true);
    expect(dialog.matches(':lang(de)')).toBe(server.browser !== 'firefox');
  });

  it('carries a named close button unless no-close', async () => {
    await mount(DIALOG);
    const el = byId<OddkinDialog>('d');
    const button = part(el, 'close')!;
    expect(button.localName).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Close');
    expect(getComputedStyle(button).color).toBe(themeValue('color', '--odd-color-text-secondary'));
    el.strings = { close: 'Schließen' };
    await settle(el);
    expect(part(el, 'close')!.getAttribute('aria-label')).toBe('Schließen');
    el.noClose = true;
    await settle(el);
    expect(part(el, 'close')).toBeNull();
  });

  it('fades with its backdrop only with motion allowed, never waiting for the fade', async () => {
    await mount(DIALOG);
    const el = byId<OddkinDialog>('d');
    el.style.setProperty('--odd-motion-duration-fast', '2s');
    const trigger = byId('trigger');
    trigger.addEventListener('click', () => el.show());
    await press(trigger);
    await settle(el);
    const dialog = inner(el);
    expect(getComputedStyle(dialog).animationName).toBe('odd-overlay-in');
    expect(getComputedStyle(dialog, '::backdrop').animationName).toBe('odd-overlay-in');
    const done = closed(el);
    el.close();
    expect(dialog.open).toBe(false);
    expect(getComputedStyle(dialog).transitionProperty).toContain('opacity');
    expect(getComputedStyle(dialog, '::backdrop').transitionProperty).toContain('opacity');
    await new Promise(requestAnimationFrame);
    expect(Number(getComputedStyle(dialog).opacity)).toBeLessThan(1);
    await done;
    expect(el.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it.runIf(server.browser === 'chromium')(
    'appears and disappears without motion when motion is reduced',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
      });
      try {
        const { el } = await opened();
        const dialog = inner(el);
        expect(getComputedStyle(dialog).animationName).toBe('none');
        expect(getComputedStyle(dialog, '::backdrop').animationName).toBe('none');
        el.close();
        expect(getComputedStyle(dialog).transitionProperty).not.toContain('opacity');
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  it.runIf(server.browser === 'chromium')(
    'keeps its boundary, divider, and close button in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const { el } = await opened();
        const system = (color: string) => {
          const probe = document.createElement('span');
          probe.style.color = color;
          container.append(probe);
          return getComputedStyle(probe).color;
        };
        expect(getComputedStyle(inner(el)).borderBlockStartColor).toBe(system('CanvasText'));
        const divider = getComputedStyle(part(el, 'footer')!, '::before');
        expect(divider.borderBlockStartColor).toBe(system('CanvasText'));
        expect(divider.borderBlockStartStyle).toBe('solid');
        expect(divider.borderBlockStartWidth).toBe('1px');
        expect(getComputedStyle(part(el, 'close')!).color).toBe(system('ButtonText'));
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  it('closes and releases everything it owns when removed while open', async () => {
    const before = scopeStats();
    const { el } = await opened();
    let closes = 0;
    el.addEventListener('close', () => closes++);
    container.remove();
    flush();
    expect(inner(el).open).toBe(false);
    expect(el.open).toBe(false);
    expect(scopeStats()).toEqual(before);
    await new Promise(requestAnimationFrame);
    expect(closes).toBe(0);
    // Back in the document it stays closed until opened.
    document.body.append(container);
    await settle(el);
    expect(inner(el).open).toBe(false);
    el.show();
    expect(inner(el).matches(':modal')).toBe(true);
  });
});

// The wiring as another lane uses it: a `<dialog>` with its own controls in one shadow root.
class TestPalette extends OddkinElement {
  static override styles = [hostStyles, overlaySurfaceStructuralStyles, overlaySurfaceStyles];
  closedBy: 'any' | 'closerequest' | 'none' = 'closerequest';
  readonly calls: string[] = [];
  readonly modal: ModalDialog = this.#modal();
  #modal() {
    const host = this;
    return new ModalDialog({
      host,
      dialog: () => host.shadowRoot?.querySelector('dialog'),
      get closedBy() {
        return host.closedBy;
      },
      initialFocus: () => host.shadowRoot?.querySelector<HTMLElement>('input'),
      returnFocus: () => document.getElementById('after'),
      onToggle: (open) =>
        host.calls.push(
          `${open} focus=${deepActiveElement()?.id || deepActiveElement()?.localName}`,
        ),
    });
  }
  override render() {
    return html`<dialog class="overlay-surface sheet" aria-label="Commands">
      <button id="clear">Clear</button>
      <input id="search" aria-label="Search" />
    </dialog>`;
  }
  protected override mounted(scope: Scope): void {
    scope.use(this.modal);
  }
}
define('test-palette', TestPalette);

describe('modal wiring (a dialog with its own controls)', () => {
  it('places initial focus and returns it where the owner says, reporting each change', async () => {
    await mount('<test-palette id="p"></test-palette>');
    const el = byId<TestPalette>('p');
    byId('before').focus();
    el.modal.show();
    expect(el.modal.open.value).toBe(true);
    expect(el.shadowRoot!.activeElement?.id).toBe('search');
    const done = closed(el);
    el.modal.close('x');
    await done;
    expect(el.modal.open.value).toBe(false);
    expect(el.modal.returnValue).toBe('x');
    expect(document.activeElement).toBe(byId('after'));
    expect(el.calls).toEqual(['true focus=search', 'false focus=before']);
  });

  it('reads closedby at each opening', async () => {
    await mount('<test-palette id="p"></test-palette>');
    const el = byId<TestPalette>('p');
    const dialog = el.shadowRoot!.querySelector('dialog')!;
    el.closedBy = 'any';
    el.modal.show();
    if ('closedBy' in HTMLDialogElement.prototype) expect(dialog.closedBy).toBe('any');
    const done = closed(el);
    await pressBackdrop();
    await done;
    el.closedBy = 'none';
    el.modal.show();
    await pressBackdrop();
    await userEvent.keyboard('{Escape}');
    await new Promise(requestAnimationFrame);
    expect(dialog.open).toBe(true);
  });

  it('finds the first control in a light DOM, skipping disabled, hidden, and unslotted ones', async () => {
    await mount(
      '<div id="root"><span>text</span><button disabled>a</button><a>no href</a><input type="hidden"><span tabindex="-1">b</span><fieldset disabled><input id="in-disabled"></fieldset><a href="#x" id="link">c</a></div>',
    );
    expect(firstFocusable(byId('root'))).toBe(byId('link'));
    byId('link').remove();
    expect(firstFocusable(byId('root'))).toBeNull();
  });
});
