import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// The display elements' layout recipes (layout-recipes.md §14): each region's arrangement as the
// shipped CSS draws it, with the theme's gaps. The recipes' text is pinned by recipes.test.ts; this
// pins what it does in the element.
let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
});
afterAll(() => unload());

let container: HTMLElement;
afterEach(async () => {
  await userEvent.unhover(document.body);
  container?.remove();
  flush();
});

async function mount(markup: string) {
  container = document.createElement('div');
  container.style.inlineSize = '480px';
  container.innerHTML = markup;
  document.body.append(container);
  const el = container.firstElementChild!;
  await settle(el);
  return el;
}

interface Arrangement {
  display: string;
  direction?: string;
  align?: string;
  justify?: string;
  wrap?: string;
  gap: string;
  min?: string;
}
const space = (name: string) => themeValue('column-gap', `--odd-space-${name}`);

function expectArrangement(region: Element, expected: Arrangement) {
  const s = getComputedStyle(region);
  expect({
    display: s.display,
    ...(expected.direction ? { direction: s.flexDirection } : {}),
    ...(expected.align ? { align: s.alignItems } : {}),
    ...(expected.justify ? { justify: s.justifyContent } : {}),
    ...(expected.wrap ? { wrap: s.flexWrap } : {}),
    gap: `${s.rowGap} ${s.columnGap}`,
    ...(expected.min ? { min: s.minInlineSize } : {}),
  }).toEqual({ ...expected, gap: `${expected.gap} ${expected.gap}` });
}
const region = (el: Element, selector: string) => el.shadowRoot!.querySelector(selector)!;

describe('layout recipes of the display elements', () => {
  it('odd-alert: a top-aligned row that wraps; the end content a wrapping row', async () => {
    const el = await mount(
      '<odd-alert label="Saved"><button slot="end">Undo</button><button slot="end">Open</button>Your changes are saved.</odd-alert>',
    );
    expectArrangement(region(el, '.alert'), {
      display: 'flex',
      direction: 'row',
      align: 'start',
      wrap: 'wrap',
      gap: space('sm'),
      min: '0px',
    });
    expectArrangement(region(el, '.end'), {
      display: 'flex',
      direction: 'row',
      align: 'center',
      wrap: 'wrap',
      gap: space('xs'),
      min: '0px',
    });
  });

  it('odd-card: a column with the gap, which --odd-card-gap overrides', async () => {
    const el = await mount('<odd-card><h2 slot="header">Plan</h2><p>Team</p></odd-card>');
    expectArrangement(region(el, '.card'), {
      display: 'flex',
      direction: 'column',
      gap: space('sm'),
      min: '0px',
    });
    (el as HTMLElement).style.setProperty('--odd-card-gap', '7px');
    expect(getComputedStyle(region(el, '.card')).rowGap).toBe('7px');
  });

  it('odd-empty-state: a centred column; the footer a centred row of actions that wraps', async () => {
    const el = await mount(
      '<odd-empty-state label="No results"><button slot="footer">Clear</button><button slot="footer">Retry</button></odd-empty-state>',
    );
    expectArrangement(region(el, '.empty'), {
      display: 'flex',
      direction: 'column',
      align: 'center',
      gap: space('sm'),
      min: '0px',
    });
    expectArrangement(region(el, '.footer'), {
      display: 'flex',
      direction: 'row',
      align: 'stretch',
      justify: 'center',
      wrap: 'wrap',
      gap: space('xs'),
      min: '0px',
    });
  });

  it('odd-progress: the label and the value at the two ends of one baseline row', async () => {
    const el = await mount('<odd-progress label="Upload" value="40" show-value></odd-progress>');
    expectArrangement(region(el, '.head'), {
      display: 'flex',
      direction: 'row',
      align: 'baseline',
      justify: 'space-between',
      wrap: 'nowrap',
      gap: '0px',
      min: '0px',
    });
  });

  it('odd-stat: a column; the context a centred row that does not wrap', async () => {
    const el = await mount(
      '<odd-stat label="Members" value="1,284" trend="increase">+8%</odd-stat>',
    );
    expectArrangement(region(el, '.base'), {
      display: 'flex',
      direction: 'column',
      gap: space('xs'),
      min: '0px',
    });
    expectArrangement(region(el, '.context'), {
      display: 'flex',
      direction: 'row',
      align: 'center',
      wrap: 'nowrap',
      gap: space('xs'),
      min: '0px',
    });
  });

  it('odd-combobox multiple: the chips in a centred row that wraps once focus is in', async () => {
    const el = await mount(
      '<odd-combobox label="Fruit" multiple><option value="a" selected>Apple</option><option value="b" selected>Banana</option></odd-combobox>',
    );
    // Collapsed (focus outside), the chips stay on one line; with focus in, they wrap.
    expect(getComputedStyle(region(el, '.chips')).flexWrap).toBe('nowrap');
    el.shadowRoot!.querySelector<HTMLElement>('.combobox')!.focus();
    await settle(el);
    expectArrangement(region(el, '.chips'), {
      display: 'flex',
      direction: 'row',
      align: 'center',
      wrap: 'wrap',
      gap: themeValue('column-gap', '--odd-control-gap'),
      min: '0px',
    });
  });
});
