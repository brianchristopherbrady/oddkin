import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinColorPicker } from '../src/color-picker/color-picker.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-color-picker (component-contracts.md §3.3; Figma colorPicker and color/Swatch; HTML colour
// input; WAI-ARIA slider and spinbutton).
let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
});
afterAll(() => unload());

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  container.style.padding = '2rem';
  document.body.append(container);
});
afterEach(async () => {
  await userEvent.unhover(document.body);
  container.remove();
  flush();
});

async function mount(markup: string) {
  container.innerHTML = markup;
  const el = container.querySelector('odd-color-picker') as OddkinColorPicker;
  await settle(el);
  const root = el.shadowRoot!;
  const part = (name: string) => root.querySelector<HTMLElement>(`[part~="${name}"]`)!;
  const control = part('control') as HTMLInputElement;
  const button = part('button') as HTMLButtonElement;
  const open = () => part('popup').matches(':popover-open');
  const events: string[] = [];
  el.addEventListener('input', () => events.push(`input ${el.value}`));
  el.addEventListener('change', () => events.push(`change ${el.value}`));
  const openPopup = async () => {
    await userEvent.click(button);
    await settle(el);
  };
  return {
    el,
    root,
    part,
    control,
    button,
    open,
    events,
    openPopup,
    form: container.querySelector('form'),
  };
}

/** Types `text` into an input and leaves it with Tab, as a user does. */
async function type(el: Element, input: HTMLInputElement, text: string, leave = true) {
  await userEvent.clear(input);
  if (text) await userEvent.type(input, text);
  if (leave) await userEvent.tab();
  await settle(el);
}

const press = async (el: Element, keys: string) => {
  await userEvent.keyboard(keys);
  await settle(el);
};

// Synthetic pointer events at fractions of an area's usable box.
const pointer = (type: string, area: HTMLElement, x: number, y: number, inset = 0) => {
  const rect = area.getBoundingClientRect();
  const init = {
    clientX: rect.left + inset + x * (rect.width - 2 * inset),
    clientY: rect.top + y * rect.height,
    button: 0,
    isPrimary: true,
    pointerId: 9,
    bubbles: true,
    composed: true,
  };
  (type === 'pointerdown' ? area : document).dispatchEvent(new PointerEvent(type, init));
};

// A native colour input exists (Playwright's WebKit on Windows has none: type="color" is text).
const nativeColor =
  Object.assign(document.createElement('input'), { type: 'color' }).type === 'color';

describe('imports', () => {
  it('the foundation and the component entry register nothing new', async () => {
    const foundation = await import('../src/color-picker/foundation.js');
    expect(Object.keys(foundation).sort()).toEqual(
      [
        'COLOR_PICKER_STRINGS',
        'OddkinColorPicker',
        'colorPickerChangeEvent',
        'colorPickerInputEvent',
        'colorPickerStructuralStyles',
        'colorPickerTemplate',
        'fieldStructuralStyles',
        'glyphStyles',
        'hostStyles',
        'overlaySurfaceStructuralStyles',
      ].sort(),
    );
    const index = await import('../src/color-picker/index.js');
    expect(Object.keys(index)).toContain('colorPickerDefinition');
  });
});

describe('value', () => {
  const values = [
    '#2563EB',
    '2563eb',
    '#abc',
    '  #2563eb  ',
    'red',
    'rgb(37 99 235)',
    'hsl(0 100% 50%)',
    'color(srgb 1 0 0)',
    'transparent',
    '#2563eb80',
    'nonsense',
    '',
  ];

  it.runIf(nativeColor)('sanitizes as a native colour input does', async () => {
    const { el } = await mount('<odd-color-picker label="Color"></odd-color-picker>');
    const native = Object.assign(document.createElement('input'), { type: 'color' });
    for (const value of values) {
      native.value = value;
      el.value = value;
      expect(el.value, value).toBe(native.value);
    }
  });

  it('is #rrggbb, black for no colour, and shows uppercase hex in the field', async () => {
    const { el, control, part } = await mount(
      '<odd-color-picker label="Color" value="#D4466C"></odd-color-picker>',
    );
    expect([el.value, control.value]).toEqual(['#d4466c', '#D4466C']);
    expect(getComputedStyle(part('swatch')).backgroundColor).toBe('rgb(212, 70, 108)');
    el.value = 'not a colour';
    await settle(el);
    expect([el.value, control.value]).toEqual(['#000000', '#000000']);
    // Without alpha, the colour is opaque.
    el.value = '#2563eb80';
    await settle(el);
    expect([el.value, control.value]).toEqual(['#2563eb', '#2563EB']);
    el.removeAttribute('value');
    expect(el.defaultValue).toBe('');
    el.formStateRestoreCallback('#16a34a', 'restore');
    expect(el.value).toBe('#16a34a');
  });

  it("with alpha is HTML's color(srgb r g b / a), the alpha left out while opaque", async () => {
    const { el, control } = await mount(
      '<odd-color-picker label="Color" alpha value="#d4466c80"></odd-color-picker>',
    );
    expect(el.value).toBe('color(srgb 0.831373 0.27451 0.423529 / 0.501961)');
    expect(control.value).toBe('#D4466C80');
    el.value = '#2563eb';
    expect(el.value).toBe('color(srgb 0.145098 0.388235 0.921569)');
    el.value = 'transparent';
    expect(el.value).toBe('color(srgb 0 0 0 / 0)');
    el.value = 'color(srgb 1 0 0 / 0.25)';
    expect(el.value).toBe('color(srgb 1 0 0 / 0.25)');
    el.alpha = false;
    expect(el.value).toBe('#ff0000');
  });

  it('keeps a value assigned before the element was upgraded', async () => {
    const template = document.createElement('template');
    template.innerHTML = '<odd-color-picker label="Late"></odd-color-picker>';
    const early = template.content.firstElementChild as HTMLElement & { value?: string };
    early.value = '#D4466C';
    container.append(early);
    const upgraded = early as OddkinColorPicker;
    await settle(upgraded);
    expect(upgraded.value).toBe('#d4466c');
    expect(upgraded.shadowRoot!.querySelector<HTMLInputElement>('[part~="control"]')!.value).toBe(
      '#D4466C',
    );
  });
});

describe('field', () => {
  it('is a text field named by its label, with a swatch and a button that names the colour', async () => {
    const { el, root, control, button, part } = await mount(
      '<odd-color-picker label="Layer color" description="Pick one." value="#2563eb"></odd-color-picker>',
    );
    expect(root.querySelector(`label[for="${control.id}"]`)!.textContent).toBe('Layer color');
    expect(control.type).toBe('text');
    expect(control.getAttribute('aria-describedby')).toContain('description');
    expect(part('swatch').getAttribute('aria-hidden')).toBe('true');
    expect([
      button.getAttribute('aria-label'),
      button.getAttribute('aria-haspopup'),
      button.getAttribute('aria-expanded'),
    ]).toEqual(['Change color, #2563EB', 'dialog', 'false']);
    el.strings = { change: 'Farbe ändern, {color}' };
    await settle(el);
    expect(button.getAttribute('aria-label')).toBe('Farbe ändern, #2563EB');
  });

  it('commits typed hex when focus leaves the field, with one input and change', async () => {
    const { el, control, events } = await mount(
      '<odd-color-picker label="Color" value="#2563eb"></odd-color-picker>',
    );
    await type(el, control, 'd4466c');
    expect([el.value, control.value]).toEqual(['#d4466c', '#D4466C']);
    expect(events).toEqual(['input #d4466c', 'change #d4466c']);
    await type(el, control, '#D4466C');
    expect(events).toHaveLength(2);
    await type(el, control, '#abc');
    expect(el.value).toBe('#aabbcc');
  });

  it('typed text that is not hex is a bad input; the colour stays until it is corrected', async () => {
    const { el, control, events } = await mount(
      '<odd-color-picker label="Color" value="#2563eb"></odd-color-picker>',
    );
    await type(el, control, '#12ZZ34');
    expect([el.value, control.value]).toEqual(['#2563eb', '#12ZZ34']);
    expect([el.validity.badInput, el.validationMessage]).toEqual([
      true,
      'Enter a six-digit hex color, such as #2563EB.',
    ]);
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(el.matches(':state(user-invalid)')).toBe(true);
    expect(events).toEqual([]);
    // Four or eight digits only with alpha; colour names are not typed hex.
    for (const text of ['#2563eb80', 'red']) {
      await type(el, control, text);
      expect(el.validity.badInput, text).toBe(true);
    }
    await type(el, control, '#16a34a');
    expect([el.validity.valid, el.value]).toEqual([true, '#16a34a']);
    // Setting the value replaces typed text.
    await type(el, control, 'zz');
    el.value = '#d4466c';
    await settle(el);
    expect([control.value, el.validity.badInput]).toEqual(['#D4466C', false]);
    await type(el, control, 'zz');
    el.disabled = true;
    await settle(el);
    expect(el.validity.badInput).toBe(false);
  });
});

describe('popup', () => {
  it('opens a dialog joined to the field on the colour; focus goes to the area', async () => {
    const { el, part, button, open, root } = await mount(
      '<odd-color-picker label="Color" value="#2563eb"></odd-color-picker>',
    );
    await userEvent.click(button);
    await settle(el);
    expect(open()).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(el.matches(':state(open)')).toBe(true);
    const popup = part('popup');
    expect([popup.getAttribute('role'), popup.getAttribute('aria-label')]).toEqual([
      'dialog',
      'Choose color',
    ]);
    expect(root.activeElement).toBe(part('area-thumb'));
    const field = root.querySelector('.control-box')!.getBoundingClientRect();
    const box = popup.getBoundingClientRect();
    expect([box.left, box.width, Math.round(box.top)]).toEqual([
      field.left,
      field.width,
      Math.round(field.bottom),
    ]);
    expect(getComputedStyle(popup).borderTopWidth).toBe('0px');
    expect(getComputedStyle(popup).borderTopLeftRadius).toBe('0px');
    expect(getComputedStyle(part('control')).borderBottomLeftRadius).toBe('0px');
    expect(part('rgb').textContent).toBe('RGB 37, 99, 235');
    expect((part('hex') as HTMLInputElement).value).toBe('#2563EB');
    expect(part('opacity')).toBeNull();
  });

  it('the area is one slider: arrows move saturation across and brightness up', async () => {
    const { el, part, openPopup } = await mount(
      '<odd-color-picker label="Color" value="#2563eb"></odd-color-picker>',
    );
    await openPopup();
    const thumb = part('area-thumb');
    const read = () => [thumb.getAttribute('aria-valuenow'), thumb.getAttribute('aria-valuetext')];
    expect([thumb.getAttribute('role'), thumb.getAttribute('aria-label')]).toEqual([
      'slider',
      'Saturation and brightness',
    ]);
    expect(read()).toEqual(['84', 'Saturation 84%, brightness 92%']);
    // Modified arrows and other keys are left to the page.
    await press(
      el,
      '{Control>}{ArrowRight}{/Control}{Alt>}{ArrowUp}{/Alt}{Meta>}{ArrowDown}{/Meta}{a}',
    );
    expect(read()).toEqual(['84', 'Saturation 84%, brightness 92%']);
    await press(el, '{ArrowRight}');
    expect(read()).toEqual(['85', 'Saturation 85%, brightness 92%']);
    await press(el, '{ArrowLeft}{ArrowLeft}');
    expect(read()[0]).toBe('83');
    await press(el, '{ArrowUp}');
    expect(read()[1]).toBe('Saturation 83%, brightness 93%');
    await press(el, '{PageDown}');
    expect(read()[1]).toBe('Saturation 83%, brightness 83%');
    await press(el, '{ArrowDown}');
    expect(read()[1]).toBe('Saturation 83%, brightness 82%');
    await press(el, '{PageUp}');
    expect(read()[1]).toBe('Saturation 83%, brightness 92%');
    await press(el, '{End}');
    expect(read()[0]).toBe('100');
    await press(el, '{Home}');
    expect(read()).toEqual(['0', 'Saturation 0%, brightness 92%']);
    expect(part('rgb').textContent).toBe('RGB 235, 235, 235');
    // The hue is kept through a grey.
    await press(el, '{End}');
    expect(part('rgb').textContent).toBe('RGB 0, 73, 235');
    expect(el.value).toBe('#2563eb');
  });

  it('right to left, Left and Right swap and the area and hue are mirrored', async () => {
    const { el, part, openPopup } = await mount(
      '<div dir="rtl"><odd-color-picker label="Color" value="#2563eb"></odd-color-picker></div>',
    );
    await openPopup();
    const thumb = part('area-thumb');
    await press(el, '{ArrowRight}');
    expect(thumb.getAttribute('aria-valuenow')).toBe('83');
    await press(el, '{ArrowLeft}{ArrowLeft}');
    expect(thumb.getAttribute('aria-valuenow')).toBe('85');
    const area = part('area').getBoundingClientRect();
    const handle = thumb.getBoundingClientRect();
    expect(Math.round(area.right - (handle.left + handle.width / 2))).toBe(
      Math.round(0.85 * area.width),
    );
    expect(getComputedStyle(part('area')).backgroundImage).toContain('to left');
    expect(getComputedStyle(part('hue').querySelector('.track')!).backgroundImage).toContain(
      'to left',
    );
    part('hue-thumb').focus();
    await press(el, '{ArrowRight}');
    expect(part('hue-thumb').getAttribute('aria-valuenow')).toBe('220');
  });

  it('the hue is a slider in degrees', async () => {
    const { el, part, openPopup } = await mount(
      '<odd-color-picker label="Color" value="#2563eb"></odd-color-picker>',
    );
    await openPopup();
    const hue = part('hue-thumb');
    expect([
      hue.getAttribute('role'),
      hue.getAttribute('aria-label'),
      hue.getAttribute('aria-valuemin'),
      hue.getAttribute('aria-valuemax'),
      hue.getAttribute('aria-valuenow'),
    ]).toEqual(['slider', 'Hue', '0', '360', '221']);
    hue.focus();
    await press(el, '{ArrowRight}');
    expect(hue.getAttribute('aria-valuenow')).toBe('222');
    await press(el, '{PageDown}');
    expect(hue.getAttribute('aria-valuenow')).toBe('212');
    await press(el, '{End}');
    expect(hue.getAttribute('aria-valuenow')).toBe('360');
    await press(el, '{Home}');
    expect(hue.getAttribute('aria-valuenow')).toBe('0');
    expect(part('rgb').textContent).toBe('RGB 235, 37, 37');
    expect(getComputedStyle(part('area')).backgroundImage).toContain('rgb(255, 0, 0)');
    await press(el, '{a}');
    expect(hue.getAttribute('aria-valuenow')).toBe('0');
    await press(el, '{Control>}{ArrowRight}{/Control}{Alt>}{ArrowUp}{/Alt}');
    expect(hue.getAttribute('aria-valuenow')).toBe('0');
    // A colour typed as hex sets the hue whichever channel is largest.
    const hex = part('hex') as HTMLInputElement;
    for (const [text, degrees] of [
      ['16A34A', '142'],
      ['D4466C', '344'],
      ['2563EB', '221'],
    ]) {
      await type(el, hex, text!, false);
      expect(hue.getAttribute('aria-valuenow'), text).toBe(degrees);
    }
  });

  it('a press or drag on the area sets saturation and brightness; on the hue, the hue', async () => {
    const { el, part, openPopup, root } = await mount(
      '<odd-color-picker label="Color" value="#2563eb"></odd-color-picker>',
    );
    await openPopup();
    const area = part('area');
    pointer('pointerdown', area, 0.5, 0.25);
    await settle(el);
    expect(part('area-thumb').getAttribute('aria-valuetext')).toBe(
      'Saturation 50%, brightness 75%',
    );
    pointer('pointermove', area, 1.5, -1);
    await settle(el);
    expect(part('area-thumb').getAttribute('aria-valuetext')).toBe(
      'Saturation 100%, brightness 100%',
    );
    pointer('pointerup', area, 1.5, -1);
    // Only the primary button.
    area.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: area.getBoundingClientRect().left + 1,
        clientY: area.getBoundingClientRect().bottom - 1,
        button: 2,
        isPrimary: true,
        pointerId: 9,
        bubbles: true,
      }),
    );
    await settle(el);
    expect(part('area-thumb').getAttribute('aria-valuenow')).toBe('100');
    const hue = part('hue');
    const inset = part('hue-thumb').offsetWidth / 2;
    pointer('pointerdown', hue, 0.25, 0.5, inset);
    pointer('pointerup', hue, 0.25, 0.5, inset);
    await settle(el);
    expect(part('hue-thumb').getAttribute('aria-valuenow')).toBe('90');
    expect(root.activeElement).toBe(part('hue-thumb'));
    expect(part('rgb').textContent).toBe('RGB 128, 255, 0');
    expect(el.value).toBe('#2563eb');
  });

  it('Apply commits the popup colour with one input and change and closes; focus returns', async () => {
    const { el, part, button, open, events, openPopup, root } = await mount(
      '<odd-color-picker label="Color" value="#2563eb"></odd-color-picker>',
    );
    await openPopup();
    const hex = part('hex') as HTMLInputElement;
    await type(el, hex, 'D4466C', false);
    expect(part('rgb').textContent).toBe('RGB 212, 70, 108');
    expect(part('area-thumb').getAttribute('aria-valuenow')).toBe('67');
    expect(events).toEqual([]);
    await userEvent.click(part('apply'));
    await settle(el);
    expect(open()).toBe(false);
    expect(el.value).toBe('#d4466c');
    expect(events).toEqual(['input #d4466c', 'change #d4466c']);
    expect(root.activeElement).toBe(button);
    // Applying the same colour is no change.
    await openPopup();
    await userEvent.click(part('apply'));
    await settle(el);
    expect(events).toHaveLength(2);
  });

  it('hex text that is not a colour is invalid and Apply is unavailable', async () => {
    const { el, part, openPopup } = await mount(
      '<odd-color-picker label="Color" value="#2563eb"></odd-color-picker>',
    );
    await openPopup();
    const hex = part('hex') as HTMLInputElement;
    await type(el, hex, '#12ZZ34', false);
    expect(hex.getAttribute('aria-invalid')).toBe('true');
    expect((part('apply') as HTMLButtonElement).disabled).toBe(true);
    expect(part('rgb').textContent).toBe('RGB 37, 99, 235');
    await Promise.all(hex.getAnimations().map((animation) => animation.finished));
    expect(getComputedStyle(hex).borderTopColor).toBe(
      themeValue('border-top-color', '--odd-color-danger-foreground'),
    );
    part('area-thumb').focus();
    await press(el, '{ArrowUp}');
    expect([hex.value, hex.hasAttribute('aria-invalid')]).toEqual(['#2564ED', false]);
    // Text left behind in a closed popup is gone when it opens again.
    await type(el, hex, 'zz', false);
    await press(el, '{Escape}');
    await openPopup();
    expect([hex.value, (part('apply') as HTMLButtonElement).disabled]).toEqual(['#2563EB', false]);
  });

  it('Cancel, Escape, or a press outside close it without a change', async () => {
    const { el, part, open, events, openPopup, button, root } = await mount(
      '<odd-color-picker label="Color" value="#2563eb"></odd-color-picker>',
    );
    for (const close of ['cancel', 'escape', 'outside'] as const) {
      await openPopup();
      await press(el, '{End}');
      if (close === 'cancel') await userEvent.click(part('cancel'));
      else if (close === 'escape') await press(el, '{Escape}');
      else await userEvent.click(document.body, { position: { x: 1, y: 1 } });
      await settle(el);
      expect(open(), close).toBe(false);
      expect(el.value).toBe('#2563eb');
      if (close !== 'outside') expect(root.activeElement, close).toBe(button);
    }
    expect(events).toEqual([]);
    // It reopens on the colour, not the discarded one.
    await openPopup();
    expect(part('area-thumb').getAttribute('aria-valuenow')).toBe('84');
  });

  it('suggests colours from options or <option> children as radios', async () => {
    const { el, part, root, openPopup, events } = await mount(
      `<odd-color-picker label="Color" value="#2563eb">
        <option value="#2563eb">Blue</option><option value="#D4466C">Rose</option><option value="#f5f5f5">Mist</option><option value="#16a34a" disabled>Green</option>
      </odd-color-picker>`,
    );
    await openPopup();
    const group = root.querySelector('[role="radiogroup"]')!;
    expect(root.getElementById(group.getAttribute('aria-labelledby')!)!.textContent).toBe(
      'Suggested colors',
    );
    const radios = [...root.querySelectorAll<HTMLInputElement>('[part~="option-swatch"] input')];
    expect(
      radios.map((r) => [r.type, r.getAttribute('aria-label'), r.checked, r.disabled]),
    ).toEqual([
      ['radio', 'Blue', true, false],
      ['radio', 'Rose', false, false],
      ['radio', 'Mist', false, false],
      ['radio', 'Green', false, true],
    ]);
    const swatches = root.querySelectorAll<HTMLElement>('[part~="option-swatch"]');
    expect(getComputedStyle(swatches[1]!).backgroundColor).toBe('rgb(212, 70, 108)');
    // The check contrasts with the colour.
    expect(getComputedStyle(swatches[0]!).color).toBe('rgb(255, 255, 255)');
    expect(getComputedStyle(swatches[1]!).color).toBe('rgb(0, 0, 0)');
    expect(getComputedStyle(swatches[2]!).color).toBe('rgb(0, 0, 0)');
    expect(getComputedStyle(swatches[0]!.querySelector('.glyph')!).visibility).toBe('visible');
    expect(getComputedStyle(swatches[1]!.querySelector('.glyph')!).visibility).toBe('hidden');
    await userEvent.click(swatches[1]!);
    await settle(el);
    expect(radios.map((r) => r.checked)).toEqual([false, true, false, false]);
    expect(part('rgb').textContent).toBe('RGB 212, 70, 108');
    expect(events).toEqual([]);
    await press(el, '{ArrowRight}');
    expect(part('rgb').textContent).toBe('RGB 245, 245, 245');
    // A grey keeps the hue the popup had.
    expect(part('hue-thumb').getAttribute('aria-valuenow')).toBe('344');
    await userEvent.click(part('apply'));
    await settle(el);
    expect(el.value).toBe('#f5f5f5');
    // Without alpha, a suggested colour is opaque; text that is no colour suggests none.
    el.options = [
      { value: '#000000', label: 'Ink' },
      { value: '#2563eb80', label: 'Glass' },
      { value: 'nonsense', label: 'None' },
    ];
    el.value = '#000000';
    await settle(el);
    await openPopup();
    const next = [...root.querySelectorAll<HTMLInputElement>('[part~="option-swatch"] input')];
    expect(next.map((r) => [r.getAttribute('aria-label'), r.checked])).toEqual([
      ['Ink', true],
      ['Glass', false],
      ['None', false],
    ]);
    expect(getComputedStyle(next[2]!.parentElement!).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    await userEvent.click(next[1]!.parentElement!);
    await settle(el);
    expect((part('hex') as HTMLInputElement).value).toBe('#2563EB');
  });

  it('has no suggested colours without options', async () => {
    const { part, openPopup } = await mount('<odd-color-picker label="Color"></odd-color-picker>');
    await openPopup();
    expect(part('swatches')).toBeNull();
  });

  it('with alpha, the opacity field is a spinbutton in percent', async () => {
    const { el, part, openPopup } = await mount(
      '<odd-color-picker label="Color" alpha value="#d4466c80"></odd-color-picker>',
    );
    await openPopup();
    const opacity = part('opacity') as HTMLInputElement;
    expect([
      opacity.value,
      opacity.getAttribute('role'),
      opacity.getAttribute('aria-valuenow'),
      opacity.getAttribute('aria-valuetext'),
    ]).toEqual(['50%', 'spinbutton', '50', '50%']);
    opacity.focus();
    await press(el, '{ArrowUp}');
    expect(opacity.value).toBe('51%');
    await press(el, '{PageDown}');
    expect(opacity.value).toBe('41%');
    await type(el, opacity, '25', false);
    expect(opacity.getAttribute('aria-valuenow')).toBe('25');
    await type(el, opacity, '140%', false);
    expect(opacity.getAttribute('aria-valuenow')).toBe('100');
    await type(el, opacity, '', false);
    expect(opacity.getAttribute('aria-valuenow')).toBe('100');
    await type(el, opacity, '-5', false);
    expect(opacity.getAttribute('aria-valuenow')).toBe('0');
    // Pasted text with its percent sign.
    await userEvent.fill(opacity, '30%');
    await settle(el);
    expect(opacity.getAttribute('aria-valuenow')).toBe('30');
    await type(el, opacity, '25 %', false);
    await type(el, opacity, 'x', false);
    expect(opacity.getAttribute('aria-valuenow')).toBe('25');
    expect((part('hex') as HTMLInputElement).value).toBe('#D4466C40');
    // A key replaces the typed text with the percentage.
    await press(el, '{ArrowDown}');
    expect(opacity.value).toBe('24%');
    await userEvent.click(part('apply'));
    await settle(el);
    expect(el.value).toBe('color(srgb 0.831373 0.27451 0.423529 / 0.24)');
  });

  it('with alpha, the popup hex takes eight digits', async () => {
    const { el, part, openPopup } = await mount(
      '<odd-color-picker label="Color" alpha value="#2563eb"></odd-color-picker>',
    );
    await openPopup();
    await type(el, part('hex') as HTMLInputElement, '#D4466C80', false);
    expect((part('opacity') as HTMLInputElement).value).toBe('50%');
    await userEvent.click(part('apply'));
    await settle(el);
    expect(el.value).toBe('color(srgb 0.831373 0.27451 0.423529 / 0.501961)');
  });
});

describe('look', () => {
  it('draws the swatch at the field start and the text after it', async () => {
    const { part, control } = await mount(
      '<odd-color-picker label="Color" value="#2563eb"></odd-color-picker>',
    );
    const swatch = getComputedStyle(part('swatch'));
    expect([swatch.width, swatch.height]).toEqual([
      themeValue('width', '--odd-icon-size-lg'),
      themeValue('width', '--odd-icon-size-lg'),
    ]);
    expect(part('swatch').getBoundingClientRect().right).toBeLessThan(
      control.getBoundingClientRect().left + parseFloat(getComputedStyle(control).paddingLeft),
    );
  });

  it('draws the area 148 px high and the hue one small icon high, its handle inside the track', async () => {
    const { part, openPopup } = await mount(
      '<odd-color-picker label="Color" value="#ff0000"></odd-color-picker>',
    );
    await openPopup();
    const small = parseFloat(themeValue('height', '--odd-icon-size-sm'));
    const track = part('hue').querySelector('.track')!.getBoundingClientRect();
    const handle = part('hue-thumb').getBoundingClientRect();
    expect(part('area').getBoundingClientRect().height).toBe(148);
    expect([part('hue').getBoundingClientRect().height, track.height, handle.width]).toEqual([
      small,
      small,
      small,
    ]);
    expect([handle.left, handle.top]).toEqual([track.left, track.top]);
  });

  it.runIf(server.browser === 'chromium')(
    'keeps the user’s colours in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const { part, openPopup, root } = await mount(
          '<odd-color-picker label="Color" value="#d4466c"><option value="#2563eb">Blue</option></odd-color-picker>',
        );
        expect(matchMedia('(forced-colors: active)').matches).toBe(true);
        await openPopup();
        expect([
          getComputedStyle(part('swatch')).backgroundColor,
          getComputedStyle(root.querySelector('[part~="option-swatch"]')!).backgroundColor,
          getComputedStyle(part('area')).backgroundImage.includes('linear-gradient'),
          getComputedStyle(part('hue').querySelector('.track')!).backgroundImage.includes(
            'linear-gradient',
          ),
        ]).toEqual(['rgb(212, 70, 108)', 'rgb(37, 99, 235)', true, true]);
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );
});

describe('forms', () => {
  it('submits the value under its name; reset returns to the value attribute; disabled submits nothing', async () => {
    const { el, control, form, button } = await mount(
      '<form><odd-color-picker label="Color" name="layer" value="#2563eb"></odd-color-picker></form>',
    );
    expect([...new FormData(form!)]).toEqual([['layer', '#2563eb']]);
    await type(el, control, '#d4466c');
    expect([...new FormData(form!)]).toEqual([['layer', '#d4466c']]);
    await type(el, control, 'zz');
    form!.reset();
    await settle(el);
    expect([el.value, control.value, el.validity.valid]).toEqual(['#2563eb', '#2563EB', true]);
    el.disabled = true;
    await settle(el);
    expect([...new FormData(form!)]).toEqual([]);
    expect([control.disabled, button.disabled]).toEqual([true, true]);
  });

  it('error marks it invalid and points the browser at the field', async () => {
    const { el, control, form } = await mount(
      '<form><odd-color-picker label="Color" name="layer" error="Too light."></odd-color-picker></form>',
    );
    expect([el.validity.customError, el.validationMessage, form!.checkValidity()]).toEqual([
      true,
      'Too light.',
      false,
    ]);
    el.reportValidity();
    await settle(el);
    expect(el.shadowRoot!.activeElement).toBe(control);
    expect(control.getAttribute('aria-invalid')).toBe('true');
  });
});

describe('ownership', () => {
  it('returns to baseline after reconnects, also when removed open in the middle of a drag', async () => {
    const { el, part, openPopup } = await mount(
      '<odd-color-picker label="Color"></odd-color-picker>',
    );
    const before = scopeStats();
    await openPopup();
    pointer('pointerdown', part('area'), 0.2, 0.2);
    el.remove();
    container.append(el);
    await settle(el);
    for (let i = 0; i < 5; i++) {
      el.remove();
      container.append(el);
      await settle(el);
    }
    expect(scopeStats()).toEqual(before);
  });
});
