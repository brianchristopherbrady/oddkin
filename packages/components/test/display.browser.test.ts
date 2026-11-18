import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { setErrorHandler } from '@oddkin/core/diagnostics';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import { alertDefinition } from '../src/alert/index.js';
import { avatarDefinition } from '../src/avatar/index.js';
import { iconDefinition } from '../src/icon/index.js';
import { skeletonDefinition } from '../src/skeleton/index.js';
import './register.js';
import { loadTheme, probeTag, semantics, settle, themeValue } from './probe.js';

// Display elements of the M10 catalog (component-contracts.md §3.2), with the shipped theme.
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
async function mount<E extends HTMLElement = HTMLElement>(markup: string): Promise<E> {
  container = document.createElement('div');
  container.innerHTML = markup;
  document.body.append(container);
  const el = container.firstElementChild as E;
  await settle(el);
  return el;
}
const part = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
const px = (value: string) => Math.round(parseFloat(value));

describe('odd-icon', () => {
  const svg =
    '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6" fill="currentColor"></circle></svg>';

  it('is decorative without a label and an image named by it with one', async () => {
    const tag = probeTag(iconDefinition);
    const el = await mount(`<${tag}>${svg}</${tag}>`);
    expect(semantics(el)).toEqual({ role: null, label: null, hidden: 'true' });
    el.setAttribute('label', 'Settings');
    await settle(el);
    expect(semantics(el)).toEqual({ role: 'img', label: 'Settings', hidden: null });
  });

  it('takes 16, 20, and 24 px from the icon size tokens, and the slotted svg fills it', async () => {
    for (const [size, token] of [
      ['sm', '--odd-icon-size-sm'],
      ['md', '--odd-icon-size-md'],
      ['lg', '--odd-icon-size-lg'],
    ] as const) {
      const el = await mount(`<odd-icon size="${size}">${svg}</odd-icon>`);
      const box = part(el, 'base').getBoundingClientRect();
      expect(`${box.width}px`, size).toBe(themeValue('inline-size', token));
      expect(el.querySelector('svg')!.getBoundingClientRect().width, size).toBe(box.width);
      container.remove();
    }
  });

  it('draws src as a mask in the text colour, escaping the URL', async () => {
    const el = await mount<HTMLElementTagNameMap['odd-icon']>(
      '<odd-icon style="color: rgb(200, 0, 0)"></odd-icon>',
    );
    el.src = 'icons/a"b.svg';
    await settle(el);
    const mask = el.shadowRoot!.querySelector<HTMLElement>('.mask')!;
    // Engines serialize the escaped quote differently; both are the same CSS string.
    expect(['url("icons/a\\22 b.svg")', 'url("icons/a\\"b.svg")']).toContain(
      mask.style.getPropertyValue('--_icon-src'),
    );
    expect(getComputedStyle(mask).backgroundColor).toBe('rgb(200, 0, 0)');
    expect(el.shadowRoot!.querySelector('slot')).toBeNull();
    el.src = '';
    await settle(el);
    expect(el.shadowRoot!.querySelector('.mask')).toBeNull();
    expect(el.shadowRoot!.querySelector('slot')).not.toBeNull();
  });
});

describe('odd-spinner', () => {
  const name = (el: Element) =>
    el.shadowRoot!.getElementById(part(el, 'base').getAttribute('aria-labelledby')!)!;

  it('is a progress bar without a value, named "Loading" for assistive technology only', async () => {
    const el = await mount('<odd-spinner></odd-spinner>');
    const base = part(el, 'base');
    expect(base.getAttribute('role')).toBe('progressbar');
    expect(base.hasAttribute('aria-valuenow')).toBe(false);
    const text = name(el);
    expect(text.className).toBe('visually-hidden');
    expect(text.textContent!.trim()).toBe('Loading');
    expect(text.getBoundingClientRect().width).toBeLessThanOrEqual(1);
  });

  it('is named by label or strings, and by visible slotted text when present', async () => {
    const el = await mount<HTMLElementTagNameMap['odd-spinner']>(
      '<odd-spinner label="Loading results"></odd-spinner>',
    );
    expect(name(el).textContent!.trim()).toBe('Loading results');
    el.label = '';
    el.strings = { loading: 'Chargement' };
    await settle(el);
    expect(name(el).textContent!.trim()).toBe('Chargement');
    el.textContent = 'Saving changes…';
    await settle(el);
    const text = name(el);
    expect(text.className).toBe('text');
    expect(text.querySelector('slot')!.assignedNodes()[0]!.textContent).toBe('Saving changes…');
    expect(text.getBoundingClientRect().width).toBeGreaterThan(20);
  });

  it('draws the action arc on the border track at the icon sizes', async () => {
    const el = await mount('<odd-spinner size="lg"></odd-spinner>');
    const ring = part(el, 'indicator');
    expect(getComputedStyle(ring).borderBlockStartColor).toBe(
      themeValue('color', '--odd-color-action-default'),
    );
    expect(getComputedStyle(ring).borderBlockEndColor).toBe(
      themeValue('color', '--odd-color-border-default'),
    );
    // Layout size: the bounding box of a turning ring is larger.
    expect(`${ring.offsetWidth}px`).toBe(themeValue('inline-size', '--odd-icon-size-lg'));
  });
});

describe('odd-progress', () => {
  type Progress = HTMLElementTagNameMap['odd-progress'];

  it('reports value, range, and a percentage, named and described by its text', async () => {
    const el = await mount<Progress>(
      '<odd-progress label="Uploading files" value="8" max="12" description="8 of 12 files"></odd-progress>',
    );
    const track = part(el, 'track');
    expect(track.getAttribute('role')).toBe('progressbar');
    expect(track.getAttribute('aria-valuenow')).toBe('8');
    expect(track.getAttribute('aria-valuemin')).toBe('0');
    expect(track.getAttribute('aria-valuemax')).toBe('12');
    expect(track.getAttribute('aria-valuetext')).toBe('67%');
    expect(part(el, 'value-text').textContent).toBe('67%');
    expect(el.shadowRoot!.getElementById(track.getAttribute('aria-labelledby')!)!.textContent).toBe(
      'Uploading files',
    );
    expect(
      el.shadowRoot!.getElementById(track.getAttribute('aria-describedby')!)!.textContent!.trim(),
    ).toBe('8 of 12 files');
    expect(part(el, 'indicator').style.getPropertyValue('--_progress')).toBe(String(8 / 12));
  });

  it('clamps the value, treats a non-positive max as 1, and formats through renderValue', async () => {
    const el = await mount<Progress>('<odd-progress value="5" max="0"></odd-progress>');
    const track = part(el, 'track');
    expect(track.getAttribute('aria-valuemax')).toBe('1');
    expect(track.getAttribute('aria-valuenow')).toBe('1');
    expect(track.getAttribute('aria-label')).toBe('Progress');
    el.max = 400;
    el.value = -3;
    await settle(el);
    expect(track.getAttribute('aria-valuenow')).toBe('0');
    el.value = 120;
    el.renderValue = (value, max) => `${value} of ${max} rows`;
    await settle(el);
    expect(track.getAttribute('aria-valuetext')).toBe('120 of 400 rows');
  });

  it('without a value shows activity and never a percentage', async () => {
    const el = await mount<Progress>('<odd-progress label="Preparing upload"></odd-progress>');
    const track = part(el, 'track');
    expect(track.hasAttribute('aria-valuenow')).toBe(false);
    expect(track.hasAttribute('aria-valuetext')).toBe(false);
    expect(part(el, 'value-text').textContent).toBe('');
    expect(part(el, 'base').classList.contains('indeterminate')).toBe(true);
    expect(part(el, 'indicator').getAnimations().length).toBeGreaterThan(0);
  });
});

describe('odd-skeleton', () => {
  it('draws its lines, the last of several shorter, and is hidden from assistive technology', async () => {
    const tag = probeTag(skeletonDefinition);
    const el = await mount(`<${tag} lines="3" style="inline-size: 300px"></${tag}>`);
    const lines = el.shadowRoot!.querySelectorAll<HTMLElement>('[part="line"]');
    expect(lines).toHaveLength(3);
    expect(lines[2]!.getBoundingClientRect().width).toBeLessThan(
      lines[0]!.getBoundingClientRect().width,
    );
    expect(semantics(el).hidden).toBe('true');
    expect(getComputedStyle(lines[0]!).backgroundColor).toBe(
      themeValue('color', '--odd-color-border-default'),
    );
  });

  it('draws a block for rect and a round one for circle; whole lines only', async () => {
    const el = await mount<HTMLElementTagNameMap['odd-skeleton']>(
      '<odd-skeleton shape="circle"></odd-skeleton>',
    );
    const block = part(el, 'base');
    expect(block.getBoundingClientRect().width).toBe(block.getBoundingClientRect().height);
    expect(getComputedStyle(block).borderStartStartRadius).not.toBe('0px');
    el.shape = 'text';
    el.lines = 2.7;
    await settle(el);
    expect(el.shadowRoot!.querySelectorAll('[part="line"]')).toHaveLength(2);
    el.lines = 0;
    await settle(el);
    expect(el.shadowRoot!.querySelectorAll('[part="line"]')).toHaveLength(1);
  });
});

describe('odd-avatar', () => {
  type Avatar = HTMLElementTagNameMap['odd-avatar'];
  const PICTURE =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"%3E%3Crect width="40" height="40" fill="%23b8c4d9"/%3E%3C/svg%3E';
  const OTHER =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"%3E%3Crect width="40" height="40" fill="%235f6b80"/%3E%3C/svg%3E';
  const BROKEN = 'data:image/png;base64,broken';
  const image = (el: Element) => el.shadowRoot!.querySelector<HTMLImageElement>('[part="image"]');
  const initials = (el: Element) => el.shadowRoot!.querySelector('.initials')?.textContent?.trim();
  /** In-scope value of a theme custom property, resolved inside `scope`. */
  const resolveIn = (scope: Element, property: string, variable: string) => {
    const probe = document.createElement('div');
    probe.style.setProperty(property, `var(${variable})`);
    scope.append(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  };

  it('shows the initials of its label and is an image named by it', async () => {
    const tag = probeTag(avatarDefinition);
    const el = await mount(`<${tag} label="Amelia  Rose Morgan"></${tag}>`);
    expect(el.shadowRoot!.querySelector('.initials')!.textContent!.trim()).toBe('AM');
    expect(semantics(el)).toEqual({ role: 'img', label: 'Amelia  Rose Morgan', hidden: null });
    el.setAttribute('label', 'cher');
    await settle(el);
    expect(el.shadowRoot!.querySelector('.initials')!.textContent!.trim()).toBe('C');
    el.removeAttribute('label');
    await settle(el);
    expect(semantics(el)).toEqual({ role: null, label: null, hidden: 'true' });
  });

  it('AV-A1: keeps the initials in the same circle until the picture loads, and after it fails', async () => {
    const el = await mount<Avatar>('<odd-avatar label="Jo Lee"></odd-avatar>');
    const field = document.createElement('input');
    field.value = 'Draft note';
    container.append(field);
    field.focus();
    field.setSelectionRange(2, 5);
    const base = part(el, 'base');
    const box = base.getBoundingClientRect().toJSON();
    el.src = PICTURE;
    flush();
    // Read in the task that requests it: no load event can have run yet.
    expect(initials(el)).toBe('JL');
    expect(image(el)!.hidden).toBe(true);
    expect(base.getBoundingClientRect().toJSON()).toEqual(box);
    await expect.poll(() => image(el)?.hidden).toBe(false);
    expect(el.shadowRoot!.querySelector('.initials')).toBeNull();
    expect(image(el)!.getBoundingClientRect().width).toBe(box.width);
    expect(base.getBoundingClientRect().toJSON()).toEqual(box);
    el.src = BROKEN;
    flush();
    expect(initials(el)).toBe('JL');
    expect(image(el)!.hidden).toBe(true);
    await expect.poll(() => image(el)).toBe(null);
    expect(initials(el)).toBe('JL');
    expect(base.getBoundingClientRect().toJSON()).toEqual(box);
    expect(document.activeElement).toBe(field);
    expect([field.value, field.selectionStart, field.selectionEnd]).toEqual(['Draft note', 2, 5]);
  });

  it('AV-A2: commits only the current source; reconnecting neither retries nor leaks', async () => {
    const el = await mount<Avatar>('<odd-avatar label="Jo Lee"></odd-avatar>');
    // A picture replaced before it settles never shows for the source that replaced it.
    const shown: string[] = [];
    const watch = new MutationObserver(() => {
      const img = image(el);
      if (img && !img.hidden) shown.push(img.getAttribute('src')!);
    });
    watch.observe(el.shadowRoot!, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['hidden'],
    });
    el.src = PICTURE;
    flush();
    const first = image(el)!;
    el.src = BROKEN;
    flush();
    // Each source has its own image: the replaced one leaves with its listeners.
    expect(image(el)).not.toBe(first);
    expect(first.isConnected).toBe(false);
    await expect.poll(() => image(el)).toBe(null);
    await new Promise((resolve) => setTimeout(resolve, 50));
    watch.disconnect();
    expect(shown).toEqual([]);
    expect(initials(el)).toBe('JL');
    // A failing source replaced before it settles cannot fail the source that replaced it.
    el.src = 'data:image/png;base64,alsobroken';
    flush();
    el.src = PICTURE;
    flush();
    await expect.poll(() => image(el)?.hidden).toBe(false);
    // Reconnecting keeps the picture: no new request or listener, scopes back to baseline.
    const loaded = image(el)!;
    let loads = 0;
    loaded.addEventListener('load', () => loads++);
    const before = scopeStats();
    for (let i = 0; i < 5; i++) {
      el.remove();
      container.append(el);
      await settle(el);
    }
    expect(scopeStats()).toEqual(before);
    expect(image(el)).toBe(loaded);
    expect(loaded.hidden).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(loads).toBe(0);
    // A failed source stays failed across reconnects: no automatic retry.
    el.src = BROKEN;
    await expect.poll(() => image(el)).toBe(null);
    el.remove();
    container.append(el);
    await settle(el);
    expect(image(el)).toBe(null);
    // Setting it again after another source is an explicit retry.
    el.src = '';
    flush();
    el.src = BROKEN;
    flush();
    expect(image(el)).not.toBe(null);
    await expect.poll(() => image(el)).toBe(null);
    // A source set while disconnected is requested on reconnect, the initials meanwhile.
    el.remove();
    el.src = OTHER;
    container.append(el);
    flush();
    expect(initials(el)).toBe('JL');
    await expect.poll(() => image(el)?.hidden).toBe(false);
  });

  it('AV-A3: one meaningful name, or hidden when decorative; never a focus stop', async () => {
    const tag = probeTag(avatarDefinition);
    const el = await mount<HTMLElement & { label: string }>(
      `<${tag} label="Amelia Morgan"></${tag}>`,
    );
    expect(semantics(el)).toEqual({ role: 'img', label: 'Amelia Morgan', hidden: null });
    for (const label of ['', '   ', '\u00a0\t']) {
      el.label = label;
      await settle(el);
      expect(semantics(el), JSON.stringify(label)).toEqual({
        role: null,
        label: null,
        hidden: 'true',
      });
      // The canonical property keeps the host's value.
      expect(el.label).toBe(label);
    }
    el.label = 'Amelia Morgan';
    await settle(el);
    expect(semantics(el).label).toBe('Amelia Morgan');
    el.focus();
    expect(document.activeElement).not.toBe(el);
    const focusable = 'a, button, input, select, textarea, [tabindex]';
    expect(el.shadowRoot!.querySelectorAll(focusable)).toHaveLength(0);
  });

  it('AV-A4: keeps its size and identity while the parent narrows and widens', async () => {
    const name = 'Amelia Morgan-Santamaría Wolfeschlegelsteinhausenbergerdorff';
    const row = await mount(
      `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: var(--odd-space-sm);
        box-sizing: border-box; inline-size: 640px; padding: var(--odd-space-md)">
        <odd-avatar label="${name}"></odd-avatar>
        <span class="name" style="flex: 1 1 8rem; min-inline-size: 0; overflow-wrap: anywhere">${name}</span>
        <odd-button>View profile</odd-button>
      </div>`,
    );
    const avatar = row.querySelector<Avatar>('odd-avatar')!;
    const button = row.querySelector('odd-button')!;
    await settle(avatar);
    await settle(button);
    const diameter = part(avatar, 'base').getBoundingClientRect().width;
    button.focus();
    const control = button.shadowRoot!.activeElement;
    expect(control).not.toBe(null);
    for (const width of [640, 240, 640]) {
      row.style.inlineSize = `${width}px`;
      await new Promise(requestAnimationFrame);
      expect(row.querySelector('odd-avatar')).toBe(avatar);
      expect(part(avatar, 'base').getBoundingClientRect().width, `${width}`).toBe(diameter);
      expect(row.scrollWidth, `${width}`).toBeLessThanOrEqual(row.clientWidth + 1);
      const text = row.querySelector<HTMLElement>('.name')!;
      expect(text.scrollWidth, `${width}`).toBeLessThanOrEqual(text.clientWidth + 1);
      expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(
        row.getBoundingClientRect().right + 0.5,
      );
      expect(document.activeElement).toBe(button);
      expect(button.shadowRoot!.activeElement).toBe(control);
    }
    expect(avatar.label).toBe(name);
  });

  it('AV-A5: takes its diameter, paint, and type from the scope; --odd-avatar-size wins', async () => {
    for (const scope of [
      'data-odd-mode="light"',
      'data-odd-mode="dark"',
      'data-odd-density="compact"',
    ])
      for (const size of ['sm', 'md', 'lg'] as const) {
        const wrapper = await mount(
          `<div ${scope}><odd-avatar size="${size}" label="Amelia Morgan"></odd-avatar></div>`,
        );
        const el = wrapper.firstElementChild!;
        await settle(el);
        const base = part(el, 'base');
        const style = getComputedStyle(base);
        const at = `${scope} ${size}`;
        expect(`${base.getBoundingClientRect().width}px`, at).toBe(
          resolveIn(wrapper, 'inline-size', `--odd-control-height-${size}`),
        );
        expect(style.backgroundColor, at).toBe(
          resolveIn(wrapper, 'background-color', '--odd-color-surface-sunken'),
        );
        expect(style.color, at).toBe(resolveIn(wrapper, 'color', '--odd-color-text-primary'));
        const type = size === 'sm' ? 'small' : 'ui';
        expect([style.fontSize, style.fontWeight], at).toEqual([
          resolveIn(wrapper, 'font-size', `--odd-type-${type}-size`),
          resolveIn(wrapper, 'font-weight', `--odd-type-${type}-weight`),
        ]);
        container.remove();
      }
    const wrapper = await mount(
      '<div data-odd-density="compact"><odd-avatar size="sm" label="Amelia Morgan" style="--odd-avatar-size: 3.5rem"></odd-avatar></div>',
    );
    await settle(wrapper.firstElementChild!);
    expect(part(wrapper.firstElementChild!, 'base').getBoundingClientRect().width).toBe(56);
  });

  it('AV-A6: keeps a localized fallback readable right to left and at twice the text size', async () => {
    const wrapper = await mount(
      '<div dir="rtl" lang="ar" style="display: flex; gap: 12px"><odd-avatar label="ليلى إبراهيم">لي</odd-avatar><span>ليلى إبراهيم — فريق التصميم</span></div>',
    );
    const el = wrapper.querySelector<Avatar>('odd-avatar')!;
    await settle(el);
    expect(el.label).toBe('ليلى إبراهيم');
    expect(el.shadowRoot!.querySelector('slot')!.assignedNodes()[0]!.textContent).toBe('لي');
    // The marker leads at the logical start: the right edge.
    expect(el.getBoundingClientRect().left).toBeGreaterThan(
      wrapper.querySelector('span')!.getBoundingClientRect().left,
    );
    const fits = () => {
      const circle = part(el, 'base').getBoundingClientRect();
      const text = el.shadowRoot!.querySelector('.initials')!.getBoundingClientRect();
      return (
        text.left >= circle.left - 0.5 &&
        text.right <= circle.right + 0.5 &&
        text.top >= circle.top - 0.5 &&
        text.bottom <= circle.bottom + 0.5
      );
    };
    expect(fits()).toBe(true);
    const before = part(el, 'base').getBoundingClientRect().width;
    document.documentElement.style.fontSize = '200%';
    try {
      await new Promise(requestAnimationFrame);
      expect(part(el, 'base').getBoundingClientRect().width).toBeCloseTo(before * 2, 0);
      expect(fits()).toBe(true);
    } finally {
      document.documentElement.style.fontSize = '';
    }
    // Without slotted content, the first letters of the first and last words.
    el.textContent = '';
    await settle(el);
    expect(el.shadowRoot!.querySelector('.initials')!.textContent!.trim()).toBe('لإ');
  });

  it.runIf(server.browser === 'chromium')(
    'keeps the circle and its initials visible in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const el = await mount('<odd-avatar label="Amelia Morgan"></odd-avatar>');
        const style = getComputedStyle(part(el, 'base'));
        const probe = document.createElement('span');
        probe.style.color = 'CanvasText';
        container.append(probe);
        const canvasText = getComputedStyle(probe).color;
        expect([style.borderTopWidth, style.borderTopStyle, style.borderTopColor]).toEqual([
          '1px',
          'solid',
          canvasText,
        ]);
        expect(style.borderTopLeftRadius).toBe('50%');
        expect(getComputedStyle(el.shadowRoot!.querySelector('.initials')!).color).toBe(canvasText);
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  it('lets content replace the initials, and sizes from the control heights', async () => {
    const el = await mount('<odd-avatar label="3 more" size="sm">+3</odd-avatar>');
    const slot = el.shadowRoot!.querySelector('slot')!;
    expect(slot.assignedNodes()[0]!.textContent).toBe('+3');
    expect(`${part(el, 'base').getBoundingClientRect().width}px`).toBe(
      themeValue('inline-size', '--odd-control-height-sm'),
    );
  });
});

describe('odd-chip', () => {
  type Chip = HTMLElementTagNameMap['odd-chip'];

  it('has a remove button named from its text that reports odd-chip-remove', async () => {
    const el = await mount<Chip>('<odd-chip removable>Design systems</odd-chip>');
    const remove = part(el, 'remove');
    expect(remove.getAttribute('aria-label')).toBe('Remove Design systems');
    const events: Event[] = [];
    document.addEventListener('odd-chip-remove', (e) => events.push(e), { once: true });
    remove.click();
    expect(events).toHaveLength(1);
    expect(events[0]!.bubbles && events[0]!.composed).toBe(true);
    expect(events[0]!.target).toBe(el);
    el.textContent = 'Research';
    await settle(el);
    expect(remove.getAttribute('aria-label')).toBe('Remove Research');
  });

  it('removes with Backspace and Delete from the button, not while disabled', async () => {
    const el = await mount<Chip>('<odd-chip removable>Design systems</odd-chip>');
    let count = 0;
    el.addEventListener('odd-chip-remove', () => count++);
    part(el, 'remove').focus();
    await userEvent.keyboard('{Backspace}');
    await userEvent.keyboard('{Delete}');
    expect(count).toBe(2);
    el.disabled = true;
    await settle(el);
    expect((part(el, 'remove') as HTMLButtonElement).disabled).toBe(true);
    part(el, 'remove').click();
    expect(count).toBe(2);
  });

  it('adds one Tab stop only when removable, and draws the focus ring around the chip', async () => {
    const el = await mount<Chip>('<odd-chip>Plain</odd-chip>');
    expect(el.shadowRoot!.querySelector('button')).toBeNull();
    el.removable = true;
    await settle(el);
    const before = document.createElement('button');
    container.prepend(before);
    before.focus();
    await userEvent.tab();
    expect(el.shadowRoot!.activeElement).toBe(part(el, 'remove'));
    expect(getComputedStyle(part(el, 'base')).outlineStyle).toBe('solid');
  });

  it('gives the remove button the minimum target, centred on its glyph and taking only its room', async () => {
    const el = await mount<Chip>('<odd-chip removable>Design systems</odd-chip>');
    const remove = part(el, 'remove').getBoundingClientRect();
    const glyph = part(el, 'remove').querySelector('svg')!.getBoundingClientRect();
    const target = parseFloat(themeValue('inline-size', '--odd-target-min'));
    const icon = parseFloat(themeValue('inline-size', '--odd-icon-size-sm'));
    expect([remove.width, remove.height]).toEqual([target, target]);
    expect([glyph.width, glyph.height]).toEqual([icon, icon]);
    expect(glyph.left + glyph.width / 2).toBeCloseTo(remove.left + remove.width / 2, 1);
    expect(glyph.top + glyph.height / 2).toBeCloseTo(remove.top + remove.height / 2, 1);
    // Figma's room: the padding (inside the chip's border) after the glyph, not after the target.
    const base = part(el, 'base').getBoundingClientRect();
    const padding = parseFloat(themeValue('padding-inline-end', '--odd-control-padding-inline-sm'));
    const border = parseFloat(themeValue('padding-top', '--odd-border-width-default'));
    expect(base.right - glyph.right).toBeCloseTo(padding + border, 1);
  });
});

describe('odd-alert', () => {
  it('shows a tone glyph, the title in the tone colour, and the message', async () => {
    const el = await mount(
      '<odd-alert tone="danger" label="Changes could not be saved">Your draft is safe.<odd-button slot="end">Try again</odd-button></odd-alert>',
    );
    expect(part(el, 'marker').querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(getComputedStyle(part(el, 'label')).color).toBe(
      themeValue('color', '--odd-color-danger-foreground'),
    );
    expect(getComputedStyle(part(el, 'base')).backgroundColor).toBe(
      themeValue('color', '--odd-color-danger-surface'),
    );
    expect(el.querySelector('odd-button')!.assignedSlot!.name).toBe('end');
  });

  it('takes the tone colour for the title, neutral too, and hides an empty title', async () => {
    const el = await mount('<odd-alert label="A new version is available">Refresh.</odd-alert>');
    expect(getComputedStyle(part(el, 'label')).color).toBe(
      themeValue('color', '--odd-color-neutral-foreground'),
    );
    el.removeAttribute('label');
    await settle(el);
    expect(part(el, 'label').hidden).toBe(true);
  });

  it('is an ARIA alert only with announce', async () => {
    const tag = probeTag(alertDefinition);
    const el = await mount(`<${tag} label="Saved"></${tag}>`);
    expect(semantics(el).role).toBeNull();
    el.setAttribute('announce', '');
    await settle(el);
    expect(semantics(el).role).toBe('alert');
    const codes: string[] = [];
    setErrorHandler((_error, context) => codes.push(context.code ?? ''));
    try {
      el.setAttribute('announce', 'polite');
      await settle(el);
    } finally {
      setErrorHandler(undefined);
    }
    expect(codes).toEqual(['element.attribute.invalid']);
    expect(semantics(el).role).toBeNull();
  });
});

describe('odd-empty-state', () => {
  it('shows its title and text, and media and footer only when filled', async () => {
    const el = await mount(
      '<odd-empty-state label="No matching projects">Try again.</odd-empty-state>',
    );
    expect(part(el, 'label').textContent).toBe('No matching projects');
    expect(part(el, 'media').hidden).toBe(true);
    expect(part(el, 'footer').hidden).toBe(true);
    const button = document.createElement('odd-button');
    button.slot = 'footer';
    button.textContent = 'Clear filters';
    const icon = document.createElement('odd-icon');
    icon.slot = 'media';
    el.append(button, icon);
    await settle(el);
    expect(part(el, 'footer').hidden).toBe(false);
    expect(part(el, 'media').hidden).toBe(false);
    expect(getComputedStyle(part(el, 'media')).backgroundColor).toBe(
      themeValue('color', '--odd-color-surface-sunken'),
    );
    expect(px(getComputedStyle(part(el, 'label')).fontSize)).toBe(
      px(themeValue('font-size', '--odd-type-title-size')),
    );
  });
});
