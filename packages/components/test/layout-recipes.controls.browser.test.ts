import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// The layout recipes of odd-breadcrumbs, odd-calendar, odd-dialog, odd-pagination, odd-toolbar, and
// odd-validation-summary (layout-recipes.md §14): each region's arrangement as the shipped CSS draws
// it, with the theme's gaps. recipes.test.ts pins the recipes' text; this pins what it does in the
// element, where mutation probes found no other test that would notice a change.
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
  }).toEqual({ ...expected, gap: `${expected.gap} ${expected.gap}` });
}
const region = (el: Element, selector: string) => el.shadowRoot!.querySelector(selector)!;

describe('layout recipes of the navigation, overlay, and form elements', () => {
  it('odd-breadcrumbs: the trail in a centred row that wraps', async () => {
    const el = await mount(
      '<odd-breadcrumbs><ol><li><a href="#home">Home</a></li><li><a href="#docs">Docs</a></li><li><a href="#page">Page</a></li></ol></odd-breadcrumbs>',
    );
    expectArrangement(region(el, '.list'), {
      display: 'flex',
      direction: 'row',
      align: 'center',
      wrap: 'wrap',
      gap: space('sm'),
    });
  });

  it('odd-calendar: a column; the header a centred row that keeps to one line; the actions apart', async () => {
    const el = await mount('<odd-calendar value="2026-10-26" first-day="1"></odd-calendar>');
    expectArrangement(region(el, '.calendar'), {
      display: 'flex',
      direction: 'column',
      gap: space('sm'),
    });
    expectArrangement(region(el, '.header'), {
      display: 'flex',
      direction: 'row',
      align: 'center',
      wrap: 'nowrap',
      gap: space('xs'),
    });
    expectArrangement(region(el, '.actions'), {
      display: 'flex',
      direction: 'row',
      align: 'center',
      justify: 'space-between',
      wrap: 'nowrap',
      gap: space('xs'),
    });
  });

  it('odd-dialog: the header a top-aligned row; the footer a stretched row at the end that wraps', async () => {
    const el = await mount(
      '<odd-dialog label="Rename workspace"><p>Choose a clear name.</p><button slot="footer">Save</button></odd-dialog>',
    );
    expectArrangement(region(el, '.header'), {
      display: 'flex',
      direction: 'row',
      align: 'start',
      wrap: 'nowrap',
      gap: space('sm'),
    });
    expectArrangement(region(el, '.footer'), {
      display: 'flex',
      direction: 'row',
      align: 'stretch',
      justify: 'end',
      wrap: 'wrap',
      gap: space('sm'),
    });
  });

  it('odd-pagination: the position and the pages apart in a row that wraps; the pages a row that wraps', async () => {
    const el = await mount('<odd-pagination current="3" page-count="12"></odd-pagination>');
    expectArrangement(region(el, '.pagination'), {
      display: 'flex',
      direction: 'row',
      align: 'center',
      justify: 'space-between',
      wrap: 'wrap',
      gap: space('sm'),
    });
    expectArrangement(region(el, '.list'), {
      display: 'flex',
      direction: 'row',
      align: 'center',
      wrap: 'wrap',
      gap: space('xs'),
    });
  });

  it('odd-toolbar: a centred row that wraps; vertical, a stretched column that does not', async () => {
    const el = await mount(
      '<odd-toolbar label="Actions"><button>Filter</button><button>Export</button></odd-toolbar>',
    );
    expectArrangement(region(el, '.toolbar'), {
      display: 'flex',
      direction: 'row',
      align: 'center',
      wrap: 'wrap',
      gap: space('sm'),
    });
    el.setAttribute('orientation', 'vertical');
    await settle(el);
    expectArrangement(region(el, '.toolbar'), {
      display: 'flex',
      direction: 'column',
      align: 'stretch',
      wrap: 'nowrap',
      gap: space('sm'),
    });
  });

  it('odd-validation-summary: a column; the header a top-aligned row; the list a column', async () => {
    // The summary shows once a submission is blocked.
    const form = (await mount(
      '<form><odd-validation-summary></odd-validation-summary><label>Email <input name="email" required></label><button type="submit">Save</button></form>',
    )) as HTMLFormElement;
    form.querySelector('input')!.value = '';
    await userEvent.click(form.querySelector('button')!);
    const el = form.querySelector('odd-validation-summary')!;
    await settle(el);
    expectArrangement(region(el, '.summary'), {
      display: 'flex',
      direction: 'column',
      gap: space('sm'),
    });
    expectArrangement(region(el, '.header'), {
      display: 'flex',
      direction: 'row',
      align: 'start',
      wrap: 'nowrap',
      gap: space('xs'),
    });
    expectArrangement(region(el, '.list'), {
      display: 'flex',
      direction: 'column',
      gap: space('sm'),
    });
  });
});
