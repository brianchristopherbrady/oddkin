import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { setErrorHandler } from '@oddkin/core/diagnostics';
import { flush } from '@oddkin/core/reactive';
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

  it('shows a picture, falls back to the initials when it fails, and retries a new src', async () => {
    const el = await mount<HTMLElementTagNameMap['odd-avatar']>(
      '<odd-avatar label="Jo Lee" src="data:image/png;base64,broken"></odd-avatar>',
    );
    await expect
      .poll(() => el.shadowRoot!.querySelector('.initials')?.textContent?.trim())
      .toBe('JL');
    el.src =
      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/%3E';
    await settle(el);
    expect(el.shadowRoot!.querySelector('[part="image"]')).not.toBeNull();
  });

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
