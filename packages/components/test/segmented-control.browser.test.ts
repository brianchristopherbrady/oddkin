import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinSegmentedControl } from '../src/segmented-control/segmented-control.js';
import { loadTheme, themeValue } from './probe.js';

let container: HTMLElement;
beforeAll(async () => {
  await loadTheme();
  await import('../src/segmented-control/segmented-control.define.js');
});
beforeEach(() => {
  container = document.createElement('div');
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
const SIZES =
  '<option value="sm" title="Fits more">Small</option><option value="md" selected>Medium</option><option value="lg">Large</option>';
const dot =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"%3E%3Ccircle cx="10" cy="10" r="6"/%3E%3C/svg%3E';

async function mount(markup: string) {
  container.innerHTML = markup;
  const control = container.querySelector('odd-segmented-control') as OddkinSegmentedControl;
  await settle(control);
  const part = (name: string) =>
    control.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;
  const radios = () => [
    ...control.shadowRoot!.querySelectorAll<HTMLInputElement>('input:not(.flag)'),
  ];
  const radio = (value: string) => radios().find((r) => r.value === value)!;
  return { control, part, radios, radio, form: container.querySelector('form') };
}

describe('imports', () => {
  it('the foundation and the component entry register nothing new', async () => {
    const foundation = await import('../src/segmented-control/foundation.js');
    expect(Object.keys(foundation).sort()).toEqual(
      [
        'OddkinSegmentedControl',
        'changeEvent',
        'fieldStructuralStyles',
        'hostStyles',
        'inputEvent',
        'segmentedControlStructuralStyles',
        'segmentedControlTemplate',
        'visuallyHiddenStyles',
      ].sort(),
    );
    const index = await import('../src/segmented-control/index.js');
    expect(Object.keys(index)).toContain('segmentedControlDefinition');
  });
});

describe('odd-segmented-control', () => {
  it('is a radiogroup of native radios named by their options, described by title', async () => {
    const { control, part, radio } = await mount(
      `<odd-segmented-control label="Preview size">${SIZES}</odd-segmented-control>`,
    );
    expect(page.getByRole('radiogroup', { name: 'Preview size' }).element()).toBe(part('field'));
    expect(page.getByRole('radio', { name: 'Small' }).element()).toBe(radio('sm'));
    expect([control.value, radio('md').checked, radio('sm').title]).toEqual([
      'md',
      true,
      'Fits more',
    ]);
  });

  it('names icon-only options by their label', async () => {
    const { control, part } = await mount(
      `<odd-segmented-control label="View"></odd-segmented-control>`,
    );
    control.options = [
      { value: 'list', label: 'List', icon: dot },
      { value: 'grid', label: 'Grid', icon: dot },
    ];
    await settle(control);
    const grid = page.getByRole('radio', { name: 'Grid' }).element() as HTMLInputElement;
    const segment = grid.closest<HTMLElement>('[part="option"]')!;
    expect(segment.querySelector('odd-icon')!.getAttribute('src')).toBe(dot);
    expect(
      segment.querySelector('.visually-hidden')!.getBoundingClientRect().width,
    ).toBeLessThanOrEqual(1);
    expect(part('control').querySelectorAll('[part="option"]')).toHaveLength(2);
  });

  it('moves and checks with the arrow keys from one Tab stop', async () => {
    const { control } = await mount(
      `<button id="before">Before</button><odd-segmented-control label="Size">${SIZES}</odd-segmented-control><button id="after">After</button>`,
    );
    const changes: string[] = [];
    control.addEventListener('change', () => changes.push(control.value));
    container.querySelector<HTMLButtonElement>('#before')!.focus();
    await userEvent.keyboard('{Tab}');
    expect((control.shadowRoot!.activeElement as HTMLInputElement).value).toBe('md');
    // Not past either end: WebKit, like its native radios, does not wrap.
    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{Tab}');
    expect([changes, document.activeElement!.id]).toEqual([['sm', 'md'], 'after']);
  });

  it('fills the checked segment with the selection colours and steps the segment height with size', async () => {
    const { control, radio } = await mount(
      `<odd-segmented-control label="Size">${SIZES}</odd-segmented-control>`,
    );
    const label = (value: string) => radio(value).nextElementSibling!;
    expect([
      getComputedStyle(radio('md')).backgroundColor,
      getComputedStyle(label('md')).color,
      getComputedStyle(label('sm')).color,
    ]).toEqual([
      themeValue('background-color', '--odd-color-selection-background'),
      themeValue('color', '--odd-color-selection-foreground'),
      themeValue('color', '--odd-color-text-primary'),
    ]);
    const heights: number[] = [];
    for (const size of ['sm', 'md', 'lg'] as const) {
      control.size = size;
      await settle(control);
      heights.push(radio('sm').getBoundingClientRect().height);
    }
    expect(heights).toEqual(
      ['--odd-target-min', '--odd-control-height-sm', '--odd-control-height-md'].map((v) =>
        parseFloat(themeValue('min-height', v)),
      ),
    );
    const widths = ['sm', 'md', 'lg'].map((v) =>
      Math.round(radio(v).getBoundingClientRect().width),
    );
    expect(new Set(widths).size).toBe(1);
  });

  it('dims the label and the unchecked segments while disabled; the checked one keeps its colours', async () => {
    const { control, part, radio, radios } = await mount(
      `<odd-segmented-control label="Size" disabled>${SIZES}</odd-segmented-control>`,
    );
    expect(radios().every((r) => r.disabled)).toBe(true);
    expect([
      getComputedStyle(part('label')).color,
      getComputedStyle(radio('sm').nextElementSibling!).color,
      getComputedStyle(radio('md').nextElementSibling!).color,
    ]).toEqual([
      themeValue('color', '--odd-color-text-disabled'),
      themeValue('color', '--odd-color-text-disabled'),
      themeValue('color', '--odd-color-selection-foreground'),
    ]);
    control.disabled = false;
    await settle(control);
    expect(radios().some((r) => r.disabled)).toBe(false);
  });
});

describe('forms', () => {
  it('submits the checked value; required blocks an empty submission and marks the track', async () => {
    const { control, part, radio, form } = await mount(
      `<form><odd-segmented-control label="Size" name="size" required>${SIZES.replace(' selected', '')}</odd-segmented-control></form>`,
    );
    expect([control.validity.valueMissing, form!.checkValidity()]).toEqual([true, false]);
    // The failed check marks the control touched, so it shows the invalid border.
    await settle(control);
    expect(getComputedStyle(part('control')).borderTopColor).toBe(
      themeValue('border-top-color', '--odd-color-danger-foreground'),
    );
    await userEvent.click(radio('lg'));
    expect([...new FormData(form!)]).toEqual([['size', 'lg']]);
    expect(control.matches(':state(user-invalid)')).toBe(false);
  });
});

describe('ownership', () => {
  it('returns to baseline after reconnects', async () => {
    const { control } = await mount(
      `<odd-segmented-control label="Size">${SIZES}</odd-segmented-control>`,
    );
    const before = scopeStats();
    for (let i = 0; i < 10; i++) {
      control.remove();
      container.append(control);
      await settle(control);
    }
    expect(scopeStats()).toEqual(before);
  });
});
