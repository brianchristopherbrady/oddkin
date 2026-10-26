import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cdp, page, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinRating } from '../src/rating/rating.js';
import { loadTheme, themeValue } from './probe.js';

let container: HTMLElement;
beforeAll(async () => {
  await loadTheme();
  await import('../src/rating/rating.define.js');
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

async function mount(markup: string) {
  container.innerHTML = markup;
  const rating = container.querySelector('odd-rating') as OddkinRating;
  await settle(rating);
  const part = (name: string) => rating.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;
  const radios = () => [
    ...rating.shadowRoot!.querySelectorAll<HTMLInputElement>('input:not(.flag)'),
  ];
  const stars = () => [...rating.shadowRoot!.querySelectorAll<HTMLElement>('[part="option"]')];
  const states = () => stars().map((star) => star.dataset['state']);
  return { rating, part, radios, stars, states, form: container.querySelector('form') };
}

describe('imports', () => {
  it('the foundation and the component entry register nothing new', async () => {
    const foundation = await import('../src/rating/foundation.js');
    expect(Object.keys(foundation).sort()).toEqual(
      [
        'OddkinRating',
        'RATING_STRINGS',
        'changeEvent',
        'fieldStructuralStyles',
        'glyphStyles',
        'hostStyles',
        'inputEvent',
        'ratingStructuralStyles',
        'ratingTemplate',
        'visuallyHiddenStyles',
      ].sort(),
    );
    const index = await import('../src/rating/index.js');
    expect(Object.keys(index)).toContain('ratingDefinition');
  });
});

describe('odd-rating', () => {
  it('is a radiogroup of five native radios named "1 star" to "5 stars"; the value part counts', async () => {
    const { rating, part, radios, states } = await mount(
      '<odd-rating label="Your rating" description="Choose one to five stars."></odd-rating>',
    );
    expect(page.getByRole('radiogroup', { name: 'Your rating' }).element()).toBe(part('field'));
    expect(radios().map((radio) => [radio.value, radio.checked])).toEqual(
      ['1', '2', '3', '4', '5'].map((value) => [value, false]),
    );
    expect(page.getByRole('radio', { name: '1 star', exact: true }).element()).toBe(radios()[0]);
    expect(page.getByRole('radio', { name: '5 stars', exact: true }).element()).toBe(radios()[4]);
    expect([part('value').textContent, states()]).toEqual(['Not rated', Array(5).fill('off')]);
    rating.value = '3';
    await settle(rating);
    expect([radios()[2]!.checked, part('value').textContent, states()]).toEqual([
      true,
      '3 of 5',
      ['on', 'on', 'on', 'off', 'off'],
    ]);
  });

  it('chooses with the arrow keys from one Tab stop, as native radios do', async () => {
    container.innerHTML = `<button id="before">Before</button>
      <odd-rating label="Your rating" value="3"></odd-rating>
      <div id="native">${[1, 2, 3, 4, 5]
        .map((n) => `<input type="radio" name="native" value="${n}"${n === 3 ? ' checked' : ''} />`)
        .join('')}</div>
      <button id="after">After</button>`;
    const rating = container.querySelector('odd-rating') as OddkinRating;
    await settle(rating);
    const events: string[] = [];
    rating.addEventListener('input', () => events.push(`input ${rating.value}`));
    rating.addEventListener('change', () => events.push(`change ${rating.value}`));
    container.querySelector<HTMLButtonElement>('#before')!.focus();
    await userEvent.keyboard('{Tab}');
    expect((rating.shadowRoot!.activeElement as HTMLInputElement).value).toBe('3');
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.keyboard('{Tab}');
    const native = document.activeElement as HTMLInputElement;
    expect([events, native.value]).toEqual([
      ['input 4', 'change 4', 'input 5', 'change 5', 'input 4', 'change 4'],
      '3',
    ]);
    // The native group takes the same keys to the same value.
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowLeft}');
    expect((document.activeElement as HTMLInputElement).value).toBe(rating.value);
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement!.id).toBe('after');
  });

  it('draws 20 px stars on 32 px targets: the strong border colour, filled in the selection colour up to the chosen one', async () => {
    const { stars, radios } = await mount(
      '<odd-rating label="Your rating" value="2"></odd-rating>',
    );
    const [on, , off] = stars();
    const glyph = (star: HTMLElement) => star.querySelector('svg')!;
    expect([
      getComputedStyle(off!).color,
      getComputedStyle(glyph(off!)).fill,
      getComputedStyle(on!).color,
      getComputedStyle(glyph(on!)).fill,
    ]).toEqual([
      themeValue('color', '--odd-color-border-strong'),
      'none',
      themeValue('color', '--odd-color-selection-background'),
      themeValue('color', '--odd-color-selection-background'),
    ]);
    const box = radios()[0]!.getBoundingClientRect();
    const size = parseFloat(themeValue('width', '--odd-control-height-sm'));
    expect([box.width, box.height]).toEqual([size, size]);
    expect(glyph(on!).getBoundingClientRect().width).toBe(
      parseFloat(themeValue('width', '--odd-icon-size-md')),
    );
  });

  it('a click chooses the star; the stars before it fill', async () => {
    const { rating, radios, states } = await mount('<odd-rating label="Your rating"></odd-rating>');
    await userEvent.click(radios()[3]!);
    expect([rating.value, states()]).toEqual(['4', ['on', 'on', 'on', 'on', 'off']]);
  });

  it('a pointer over an editable star shows the hover surface; not while read only', async () => {
    const { rating, radios } = await mount('<odd-rating label="Your rating"></odd-rating>');
    const background = async (radio: HTMLInputElement) => {
      await Promise.all(radio.getAnimations().map((animation) => animation.finished));
      return getComputedStyle(radio).backgroundColor;
    };
    await userEvent.hover(radios()[1]!);
    expect(await background(radios()[1]!)).toBe(
      themeValue('background-color', '--odd-color-surface-hover'),
    );
    rating.readonly = true;
    await settle(rating);
    expect(await background(radios()[1]!)).toBe('rgba(0, 0, 0, 0)');
  });

  it('dims the label and every star while disabled', async () => {
    const { part, radios } = await mount(
      '<odd-rating label="Your rating" value="3" disabled></odd-rating>',
    );
    expect(radios().every((radio) => radio.disabled)).toBe(true);
    expect(part('field').getAttribute('aria-disabled')).toBe('true');
    const glyphs = [...part('control').querySelectorAll('svg')];
    expect([
      getComputedStyle(part('label')).color,
      getComputedStyle(glyphs[0]!).color,
      getComputedStyle(glyphs[4]!).color,
      getComputedStyle(glyphs[0]!).fill,
    ]).toEqual([
      themeValue('color', '--odd-color-text-disabled'),
      themeValue('color', '--odd-color-text-disabled'),
      themeValue('color', '--odd-color-text-disabled'),
      themeValue('color', '--odd-color-text-disabled'),
    ]);
  });

  it('read only: focusable, but clicks and keys change nothing; aria-readonly', async () => {
    const { rating, part, radios } = await mount(
      '<button id="before">Before</button><odd-rating label="Your rating" value="3" readonly></odd-rating>',
    );
    const changes: string[] = [];
    rating.addEventListener('input', () => changes.push(rating.value));
    expect(part('field').getAttribute('aria-readonly')).toBe('true');
    await userEvent.click(radios()[4]!);
    container.querySelector<HTMLButtonElement>('#before')!.focus();
    await userEvent.keyboard('{Tab}');
    expect((rating.shadowRoot!.activeElement as HTMLInputElement).value).toBe('3');
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowLeft}');
    await settle(rating);
    expect([rating.value, radios()[2]!.checked, radios()[4]!.checked, changes]).toEqual([
      '3',
      true,
      false,
      [],
    ]);
  });

  it('max sets how many stars; options name them instead', async () => {
    const { rating, radios, part } = await mount(
      '<odd-rating label="Recommend" max="10" value="8"></odd-rating>',
    );
    expect([radios().length, part('value').textContent]).toEqual([10, '8 of 10']);
    rating.max = 3;
    await settle(rating);
    expect([radios().length, part('value').textContent]).toEqual([3, 'Not rated']);
    const named = await mount(
      '<odd-rating label="Your rating"><option value="poor">Poor</option><option value="fair">Fair</option><option value="good" selected>Good</option><option value="great">Great</option></odd-rating>',
    );
    expect(page.getByRole('radio', { name: 'Good', exact: true }).element()).toBe(
      named.radios()[2],
    );
    expect([named.rating.value, named.part('value').textContent]).toEqual(['good', '3 of 4']);
  });

  it('takes its words from strings and its plural forms from lang', async () => {
    const { rating, part } = await mount(
      '<div lang="fr"><odd-rating label="Votre note" value="1"></odd-rating></div>',
    );
    rating.strings = {
      star: '{count} étoiles',
      starOne: '{count} étoile',
      summary: '{value} sur {max}',
    };
    await settle(rating);
    // French uses the singular form for 0 and 1.
    expect(page.getByRole('radio', { name: '1 étoile', exact: true }).element()).toBeTruthy();
    expect(page.getByRole('radio', { name: '2 étoiles', exact: true }).element()).toBeTruthy();
    expect(part('value').textContent).toBe('1 sur 5');
  });

  it.runIf(server.browser === 'chromium')(
    'keeps the stars visible in forced colours: CanvasText, the chosen ones Highlight',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const { part } = await mount('<odd-rating label="Your rating" value="1"></odd-rating>');
        expect(matchMedia('(forced-colors: active)').matches).toBe(true);
        const system = (color: string) => {
          const probe = document.createElement('span');
          probe.style.color = color;
          container.append(probe);
          return getComputedStyle(probe).color;
        };
        const glyphs = [...part('control').querySelectorAll('svg')];
        expect([getComputedStyle(glyphs[0]!).color, getComputedStyle(glyphs[1]!).color]).toEqual([
          system('Highlight'),
          system('CanvasText'),
        ]);
        const disabled = await mount('<odd-rating label="Locked" value="1" disabled></odd-rating>');
        const dimmed = disabled.part('control').querySelector('svg')!;
        expect(getComputedStyle(dimmed).color).toBe(system('GrayText'));
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );
});

describe('layout', () => {
  it('puts the value beside the stars, and under them when the row does not fit', async () => {
    const { rating, part } = await mount('<odd-rating label="Rating" value="3"></odd-rating>');
    const stars = rating.shadowRoot!.querySelector('.stars')!.getBoundingClientRect();
    expect(part('value').getBoundingClientRect().left).toBeGreaterThan(stars.right);
    container.style.inlineSize = '120px';
    await settle(rating);
    expect(part('value').getBoundingClientRect().top).toBeGreaterThanOrEqual(
      rating.shadowRoot!.querySelector('.stars')!.getBoundingClientRect().bottom,
    );
  });
});

describe('forms', () => {
  it('submits the chosen value as a native radio group; required blocks an empty submission', async () => {
    const { rating, radios, form } = await mount(
      '<form><odd-rating label="Your rating" name="rating" required></odd-rating></form>',
    );
    const native = document.createElement('input');
    native.type = 'radio';
    native.name = 'native';
    native.required = true;
    form!.append(native);
    expect([rating.validity.valueMissing, rating.validationMessage]).toEqual([
      true,
      native.validationMessage,
    ]);
    native.remove();
    expect(form!.checkValidity()).toBe(false);
    await settle(rating);
    expect(rating.matches(':state(user-invalid)')).toBe(true);
    await userEvent.click(radios()[1]!);
    expect([...new FormData(form!)]).toEqual([['rating', '2']]);
    expect(rating.matches(':state(user-invalid)')).toBe(false);
  });

  it('read only is submitted and barred from validation; reset restores the declared value', async () => {
    const { rating, form } = await mount(
      '<form><odd-rating label="Your rating" name="score" value="4" readonly required></odd-rating><odd-rating label="Other" name="other" required readonly></odd-rating></form>',
    );
    const other = form!.querySelectorAll('odd-rating')[1] as OddkinRating;
    await settle(other);
    expect([...new FormData(form!)]).toEqual([['score', '4']]);
    expect(form!.checkValidity()).toBe(true);
    other.readonly = false;
    await settle(other);
    expect([other.validity.valueMissing, form!.checkValidity()]).toEqual([true, false]);
    rating.readonly = false;
    rating.value = '1';
    await settle(rating);
    form!.reset();
    await settle(rating);
    expect(rating.value).toBe('4');
  });
});

describe('ownership', () => {
  it('returns to baseline after reconnects', async () => {
    const { rating } = await mount('<odd-rating label="Your rating" value="2"></odd-rating>');
    const before = scopeStats();
    for (let i = 0; i < 10; i++) {
      rating.remove();
      container.append(rating);
      await settle(rating);
    }
    expect(scopeStats()).toEqual(before);
  });
});
