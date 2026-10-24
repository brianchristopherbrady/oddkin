import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinSlider } from '../src/slider/slider.js';
import { loadTheme, themeValue } from './probe.js';

let container: HTMLElement;
beforeAll(async () => {
  await loadTheme();
  await import('../src/slider/slider.define.js');
});
beforeEach(() => {
  container = document.createElement('div');
  container.style.inlineSize = '264px';
  document.body.append(container);
});
afterEach(async () => {
  container.remove();
  flush();
  await userEvent.unhover(document.body);
});

const settle = async (el: { updateComplete: Promise<void> }) => {
  await el.updateComplete;
  flush();
  await el.updateComplete;
  await new Promise(requestAnimationFrame);
};

async function mount(markup: string) {
  container.innerHTML = markup;
  const el = container.querySelector('odd-slider') as OddkinSlider;
  await settle(el);
  const part = (name: string) => el.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;
  const log: string[] = [];
  el.addEventListener('input', () => log.push(`input ${el.value}`));
  el.addEventListener('change', () => log.push(`change ${el.value}`));
  return { el, part, thumb: part('thumb'), log, form: container.querySelector('form') };
}

// Synthetic pointer events at a fraction of the slider area's usable width.
const pointer = (type: string, area: HTMLElement, fraction: number) => {
  const rect = area.getBoundingClientRect();
  const thumb = area.querySelector<HTMLElement>('.thumb')!.offsetWidth;
  const clientX = rect.left + thumb / 2 + fraction * (rect.width - thumb);
  const init = {
    clientX,
    clientY: rect.top + rect.height / 2,
    button: 0,
    isPrimary: true,
    pointerId: 7,
    bubbles: true,
    composed: true,
  };
  (type === 'pointerdown' ? area : document).dispatchEvent(new PointerEvent(type, init));
};

describe('imports', () => {
  it('the foundation and the component entry register nothing new', async () => {
    const foundation = await import('../src/slider/foundation.js');
    expect(Object.keys(foundation).sort()).toEqual(
      [
        'OddkinSlider',
        'changeEvent',
        'fieldStructuralStyles',
        'hostStyles',
        'inputEvent',
        'sliderStructuralStyles',
        'sliderTemplate',
      ].sort(),
    );
    const index = await import('../src/slider/index.js');
    expect(Object.keys(index)).toContain('sliderDefinition');
  });
});

describe('odd-slider', () => {
  it('is a slider named by its label, with the range and value; the visible values are hidden from AT', async () => {
    const { el, part, thumb } = await mount(
      '<odd-slider label="Preview scale" min="25" max="100" step="5" value="60" description="For print."></odd-slider>',
    );
    expect(page.getByRole('slider', { name: 'Preview scale' }).element()).toBe(thumb);
    expect(
      ['aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-describedby'].map((a) =>
        thumb.getAttribute(a),
      ),
    ).toEqual(['25', '100', '60', 'description']);
    expect(thumb.hasAttribute('aria-valuetext')).toBe(false);
    expect([
      part('output').textContent,
      part('min-label').textContent,
      part('max-label').textContent,
    ]).toEqual(['60', '25', '100']);
    expect(part('output').getAttribute('aria-hidden')).toBe('true');
    el.renderValue = (value) => `${value}%`;
    await settle(el);
    expect([
      thumb.getAttribute('aria-valuetext'),
      part('output').textContent,
      part('max-label').textContent,
    ]).toEqual(['60%', '60%', '100%']);
  });

  it('keeps values as a native range does: snapped to the step from min, clamped, halfway by default', async () => {
    const { el } = await mount(
      '<odd-slider label="A" min="25" max="100" step="5" value="63"></odd-slider>',
    );
    expect([el.value, el.valueAsNumber]).toEqual(['65', 65]);
    el.value = '400';
    expect(el.value).toBe('100');
    el.valueAsNumber = -3;
    expect(el.value).toBe('25');
    const native = document.createElement('input');
    native.type = 'range';
    for (const [min, max, step] of [
      ['0', '100', '1'],
      ['0', '10', '3'],
      ['0', '1', '0.1'],
      ['5', '2', '1'],
      ['0', '10', '-2'],
    ] as const) {
      const { el: other } = await mount(
        `<odd-slider label="B" min="${min}" max="${max}" step="${step}"></odd-slider>`,
      );
      Object.assign(native, { min, max, step });
      native.value = '';
      native.removeAttribute('value');
      expect(other.value).toBe(native.value);
      other.value = '99';
      native.value = '99';
      expect(other.value).toBe(native.value);
    }
  });

  it('moves with the keys as the APG slider, each key an input and a change, mirrored right to left', async () => {
    const { el, thumb, log } = await mount(
      '<odd-slider label="A" min="0" max="50" step="2" value="20"></odd-slider>',
    );
    thumb.focus();
    for (const key of [
      'ArrowRight',
      'ArrowUp',
      'ArrowLeft',
      'ArrowDown',
      'PageUp',
      'PageDown',
      'End',
      'Home',
      'Home',
    ])
      await userEvent.keyboard(`{${key}}`);
    expect(log).toEqual([
      'input 22',
      'change 22',
      'input 24',
      'change 24',
      'input 22',
      'change 22',
      'input 20',
      'change 20',
      'input 26',
      'change 26',
      'input 20',
      'change 20',
      'input 50',
      'change 50',
      'input 0',
      'change 0',
    ]);
    el.dir = 'rtl';
    await settle(el);
    await userEvent.keyboard('{ArrowLeft}');
    expect(el.value).toBe('2');
    await userEvent.keyboard('{ArrowRight}');
    expect(el.value).toBe('0');
    // Shortcuts with modifiers (Alt+Left: back) are not the slider's.
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    expect(el.value).toBe('0');
  });

  it('moves to a press on the track and follows a drag, with one change when the drag ends', async () => {
    const { el, part, thumb, log } = await mount('<odd-slider label="A" value="10"></odd-slider>');
    const area = part('control');
    // A press and release where the value already is changes nothing.
    pointer('pointerdown', area, 0.1);
    pointer('pointerup', area, 0.1);
    expect(log).toEqual([]);
    pointer('pointerdown', area, 0.5);
    expect(el.value).toBe('50');
    expect(el.shadowRoot!.activeElement).toBe(thumb);
    pointer('pointermove', area, 0.75);
    pointer('pointermove', area, 1.4);
    pointer('pointerup', area, 1.4);
    expect(log).toEqual(['input 50', 'input 75', 'input 100', 'change 100']);
    await settle(el);
    const fill = part('fill').getBoundingClientRect();
    const track = part('track').getBoundingClientRect();
    const knob = thumb.getBoundingClientRect();
    expect(Math.round(fill.width)).toBe(Math.round(track.width));
    expect(Math.round(knob.left + knob.width / 2)).toBe(Math.round(track.right));
    el.dir = 'rtl';
    await settle(el);
    pointer('pointerdown', area, 0.25);
    pointer('pointerup', area, 0.25);
    expect(el.value).toBe('75');
  });

  it('ignores keys and presses while disabled and leaves the Tab order', async () => {
    const { el, part, thumb, log } = await mount(
      '<odd-slider label="A" value="10" disabled></odd-slider>',
    );
    expect([thumb.tabIndex, thumb.getAttribute('aria-disabled')]).toEqual([-1, 'true']);
    expect(part('field').getAttribute('aria-disabled')).toBe('true');
    thumb.focus();
    await userEvent.keyboard('{End}');
    pointer('pointerdown', part('control'), 1);
    pointer('pointerup', part('control'), 1);
    expect([el.value, log]).toEqual(['10', []]);
    expect(getComputedStyle(part('fill')).backgroundColor).toBe(
      themeValue('background-color', '--odd-color-text-disabled'),
    );
  });
});

describe('forms', () => {
  it('submits the value under its name; reset returns to the value attribute; disabled submits nothing', async () => {
    const { el, thumb, form } = await mount(
      '<form><odd-slider label="A" name="scale" min="25" max="100" step="5" value="60"></odd-slider></form>',
    );
    expect([...new FormData(form!)]).toEqual([['scale', '60']]);
    thumb.focus();
    await userEvent.keyboard('{End}');
    expect([...new FormData(form!)]).toEqual([['scale', '100']]);
    form!.reset();
    await settle(el);
    expect(el.value).toBe('60');
    el.disabled = true;
    await settle(el);
    expect([...new FormData(form!)]).toEqual([]);
  });

  it('error marks it invalid and points the browser at the thumb', async () => {
    const { el, thumb, form } = await mount(
      '<form><odd-slider label="A" name="scale" error="Too high."></odd-slider></form>',
    );
    expect([el.validity.customError, el.validationMessage, form!.checkValidity()]).toEqual([
      true,
      'Too high.',
      false,
    ]);
    el.reportValidity();
    await settle(el);
    expect(el.shadowRoot!.activeElement).toBe(thumb);
    expect(thumb.getAttribute('aria-invalid')).toBe('true');
    expect(getComputedStyle(thumb).borderTopColor).toBe(
      themeValue('border-top-color', '--odd-color-danger-foreground'),
    );
  });
});

describe('ownership', () => {
  it('returns to baseline after reconnects, also when removed in the middle of a drag', async () => {
    const { el, part } = await mount('<odd-slider label="A"></odd-slider>');
    const before = scopeStats();
    pointer('pointerdown', part('control'), 0.2);
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
