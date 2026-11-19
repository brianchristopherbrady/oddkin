import { describe, expect, it } from 'vitest';
import { server } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import {
  compare,
  deliberate,
  expectNone,
  figma,
  interact,
  layersOf,
  mount,
  release,
  settle,
  shadowPart,
  transitions,
  useParity,
  useRecipeStyles,
  variantIndex,
  type Target,
} from './parity.js';

// Figma parity of the existing elements and recipes; the helpers and their rules are in parity.ts.
// Other element groups keep their parity tests in figma-parity.<group>.browser.test.ts.
useParity();

const BUTTONS = ['button', 'button/sm', 'button/lg'];
const BUTTON_STATES = ['Default', 'Disabled', 'Loading', 'Hover', 'Pressed', 'Focus'];

describe('Figma parity: odd-button (button, button/sm, button/lg)', () => {
  for (const set of BUTTONS)
    for (const appearance of ['primary', 'secondary', 'ghost'])
      for (const state of BUTTON_STATES)
        it(`${set} ${appearance} ${state}`, async (context) => {
          // Firefox applies no :active while Space is held, so the pressed state cannot be reached there.
          if (state === 'Pressed' && server.browser === 'firefox') context.skip();
          const family = figma.get(`Oddkin/Common/${set}`)!;
          const size = family.variants[0]!.values['Size']!;
          const values = { Appearance: appearance, Size: size, State: state };
          const attributes = [
            `appearance="${appearance}"`,
            `size="${size}"`,
            state === 'Disabled' ? 'disabled' : '',
            state === 'Loading' ? 'loading' : '',
          ].join(' ');
          // Loading keeps both icons in their places, undrawn (Figma's Leading and End icon slots).
          const icons =
            state === 'Loading'
              ? ['start', 'end'].map(
                  (slot) =>
                    `<odd-icon slot="${slot}"><svg viewBox="0 0 20 20"><path d="M10 4v12M4 10h12" /></svg></odd-icon>`,
                )
              : ['', ''];
          const el = mount(`<odd-button ${attributes}>${icons[0]}Label${icons[1]}</odd-button>`);
          await settle(el);
          const control = el.shadowRoot!.querySelector<HTMLElement>('[part="control"]')!;
          const label = el.shadowRoot!.querySelector<HTMLElement>('.label')!;
          const index = variantIndex(family, values);
          const frame = layersOf(family, index).find((l) => l.path.length === 1)!.path;
          // Disabled mutes the whole control; Loading draws the spinner over a transparent label.
          const targets: Target[] = [
            { layer: frame, el: control, kind: 'frame', gap: 'column-gap', opacityOf: control },
            { layer: [...frame, 'Label'], el: control, kind: 'text', opacityOf: label },
          ];
          if (state === 'Loading')
            for (const [slot, layer] of [
              ['start', 'Leading icon slot'],
              ['end', 'End icon slot'],
            ] as const) {
              const icon = el.querySelector(`[slot="${slot}"]`)!;
              targets.push({ layer: [...frame, layer], el: icon, kind: 'frame', opacityOf: icon });
            }
          if (state === 'Focus')
            targets.push({
              layer: [...frame, 'Focus ring \u00b7 decorative'],
              el: control,
              kind: 'ring',
            });
          await interact(state, control);
          await transitions(targets);
          const differences = compare(`Oddkin/Common/${set}`, values, targets);
          await release(state);
          expectNone(differences);
        });
});

// One icon alone (odd-button's icon-only state, Figma page 1398:2): the square's fill, border,
// radius, padding, and minimum width and height, the focus ring, and the icon kept undrawn while
// loading; On is a pressed toggle.
const ICON_BUTTONS = ['iconButton', 'iconButton/sm', 'iconButton/lg'];
const ICON_STATES = [...BUTTON_STATES, 'On'];
const ICON = '<odd-icon><svg viewBox="0 0 20 20"><path d="M10 4v12M4 10h12" /></svg></odd-icon>';

describe('Figma parity: odd-button icon-only (iconButton, iconButton/sm, iconButton/lg)', () => {
  for (const set of ICON_BUTTONS)
    for (const appearance of ['primary', 'secondary', 'ghost'])
      for (const state of ICON_STATES)
        it(`${set} ${appearance} ${state}`, async (context) => {
          if (state === 'Pressed' && server.browser === 'firefox') context.skip();
          const family = figma.get(`Oddkin/Common/${set}`)!;
          const size = family.variants[0]!.values['Size']!;
          const values = { Appearance: appearance, Size: size, State: state };
          const attributes = [
            `appearance="${appearance}"`,
            `size="${size}"`,
            'label="Add"',
            state === 'Disabled' ? 'disabled' : '',
            state === 'Loading' ? 'loading' : '',
            state === 'On' ? 'toggle pressed' : '',
          ].join(' ');
          const el = mount(`<odd-button ${attributes}>${ICON}</odd-button>`);
          const icon = el.querySelector('odd-icon')!;
          await settle(icon);
          await settle(el);
          expect(el.matches(':state(icon-only)')).toBe(true);
          const control = shadowPart(el, 'control');
          const frame = layersOf(family, variantIndex(family, values)).find(
            (l) => l.path.length === 1,
          )!.path;
          const targets: Target[] = [
            {
              layer: frame,
              el: control,
              kind: 'frame',
              gap: 'column-gap',
              opacityOf: control,
              fields: [
                ['minHeight', 'min-height'],
                ['minWidth', 'min-width'],
              ],
            },
          ];
          if (state === 'Focus')
            targets.push({
              layer: [...frame, 'Focus ring \u00b7 decorative'],
              el: control,
              kind: 'ring',
            });
          if (state === 'Loading')
            targets.push({
              layer: [...frame, 'Icon slot'],
              el: icon,
              kind: 'frame',
              opacityOf: icon,
            });
          await interact(state, control);
          await transitions(targets);
          const differences = compare(`Oddkin/Common/${set}`, values, targets);
          await release(state);
          expectNone(differences);
        });
});

const SHARE = 'We never share your email.';
const INPUT: Record<string, { attributes: string; label: string; description: string }> = {
  Empty: {
    attributes: 'placeholder="you@example.com"',
    label: 'Email address',
    description: SHARE,
  },
  Filled: { attributes: 'value="alex@example.com"', label: 'Email address', description: SHARE },
  Focus: { attributes: 'value="alex@example.com"', label: 'Email address', description: SHARE },
  Hover: { attributes: 'value="alex@example.com"', label: 'Email address', description: SHARE },
  Invalid: {
    attributes: 'value="alex@" error="Enter a valid email address."',
    label: 'Email address',
    description: '',
  },
  Disabled: {
    attributes: 'value="alex@example.com" disabled',
    label: 'Email address',
    description: SHARE,
  },
  'Read only': {
    attributes: 'value="alex@example.com" readonly',
    label: 'Email address',
    description: 'Managed by your workspace.',
  },
  Password: {
    attributes: 'type="password" value="secret-pass"',
    label: 'Password',
    description: SHARE,
  },
};

describe('Figma parity: odd-input (input)', () => {
  for (const [state, spec] of Object.entries(INPUT))
    it(state, async () => {
      const el = mount(
        `<odd-input label="${spec.label}" ${spec.description ? `description="${spec.description}"` : ''} ${spec.attributes}></odd-input>`,
      );
      await settle(el);
      const part = (name: string) => el.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;
      const frame = [`Text input / ${state}`];
      const surface = [...frame, 'Surface'];
      const targets: Target[] = [
        { layer: frame, el: part('field'), kind: 'frame', gap: 'row-gap' },
        { layer: [...frame, spec.label], el: part('label'), kind: 'text' },
        { layer: surface, el: part('control'), kind: 'frame' },
      ];
      if (spec.description)
        targets.push({
          layer: [...frame, spec.description],
          el: part('description'),
          kind: 'text',
        });
      if (state === 'Invalid')
        targets.push({
          layer: [...frame, 'Enter a valid email address.'],
          el: part('error'),
          kind: 'text',
        });
      const family = figma.get('Oddkin/Common/input')!;
      const value = layersOf(family, variantIndex(family, { State: state })).find(
        (l) => l.path.length === 3 && l.path[1] === 'Surface' && l.types.includes('TEXT'),
      )!.path;
      const pseudo = state === 'Empty' ? '::placeholder' : undefined;
      targets.push({
        layer: value,
        el: part('control'),
        kind: 'text',
        ...(pseudo ? { pseudo } : {}),
      });
      if (state === 'Focus')
        targets.push({ layer: [...surface, 'Surface'], el: part('control'), kind: 'ring' });
      // Read-only and disabled fields keep their Figma fill under the pointer.
      await interact(['Read only', 'Disabled'].includes(state) ? 'Hover' : state, part('control'));
      await transitions(targets);
      expectNone(compare('Oddkin/Common/input', { State: state }, targets));
    });
});

describe('Figma parity: odd-card (card)', () => {
  for (const [state, appearance] of [
    ['Default', 'outlined'],
    ['Filled', 'filled'],
  ] as const)
    it(state, async () => {
      const el = mount(
        `<odd-card appearance="${appearance}"><h3 slot="header">Workspace</h3><p>Keep projects.</p></odd-card>`,
      );
      await settle(el);
      const frame = [`Card / ${state}`];
      const targets: Target[] = [
        {
          layer: [...frame, 'Surface'],
          el: el.shadowRoot!.querySelector('[part="base"]')!,
          kind: 'frame',
        },
        { layer: [...frame, 'Workspace'], el: el.querySelector('h3')!, kind: 'text' },
      ];
      expectNone(compare('Oddkin/Common/card', { State: state }, targets));
    });
});

// Page 1395:2: Tone is `tone`; Show marker is `!noMarker` (a property, not a variant); Label is the
// slotted text. The words are the page's specimens.
const BADGES: Record<string, string> = {
  neutral: 'Draft',
  info: 'In review',
  success: 'Ready',
  warning: 'Needs review',
  danger: 'Failed',
};

describe('Figma parity: odd-badge (badge, Count content)', () => {
  for (const [tone, text] of Object.entries(BADGES))
    for (const marker of [true, false])
      it(`${tone}${marker ? '' : ', no marker'}`, async () => {
        const el = mount(
          `<odd-badge tone="${tone}"${marker ? '' : ' no-marker'}>${text}</odd-badge>`,
        );
        await settle(el);
        const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
        const targets: Target[] = [
          {
            layer: [],
            el: base,
            kind: 'frame',
            gap: 'column-gap',
            fields: [
              ['paddingRight', 'padding-inline-end'],
              ['paddingBottom', 'padding-block-end'],
            ],
          },
          { layer: ['Draft'], el: base, kind: 'text' },
        ];
        expectNone(compare('Oddkin/Common/badge', { Tone: tone }, targets));
      });

  // The count composition the page keeps beside the set (159:581): a count is slot content.
  it('Count content', async () => {
    const el = mount('<odd-badge no-marker>12</odd-badge>');
    await settle(el);
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const surface = ['Badge / Count', 'Surface'];
    const targets: Target[] = [
      { layer: surface, el: base, kind: 'frame' },
      { layer: [...surface, '12'], el: base, kind: 'text' },
    ];
    expectNone(compare('Count content \u00b7 historical composition', {}, targets));
  });
});

const ALERTS: Record<string, { tone: string; title: string; message: string }> = {
  Neutral: {
    tone: 'neutral',
    title: 'A new version is available',
    message: 'Refresh when you are ready to continue.',
  },
  Success: {
    tone: 'success',
    title: 'Changes saved',
    message: 'Your workspace is up to date.',
  },
  Warning: {
    tone: 'warning',
    title: 'You are working offline',
    message: 'Changes will sync when the connection returns.',
  },
  Danger: {
    tone: 'danger',
    title: 'Changes could not be saved',
    message: 'Your draft is safe. Check your connection and retry.',
  },
};

describe('Figma parity: odd-alert (alert)', () => {
  for (const [state, spec] of Object.entries(ALERTS))
    it(state, async () => {
      const el = mount(
        `<odd-alert tone="${spec.tone}" label="${spec.title}">${spec.message}</odd-alert>`,
      );
      await settle(el);
      const frame = [`Alert / ${state}`];
      const targets: Target[] = [
        { layer: [...frame, 'Surface'], el: shadowPart(el, 'base'), kind: 'frame' },
        { layer: [...frame, 'Header', spec.title], el: shadowPart(el, 'label'), kind: 'text' },
        {
          layer: [...frame, spec.message],
          el: el.shadowRoot!.querySelector('.message')!,
          kind: 'text',
        },
      ];
      expectNone(compare('Oddkin/Common/alert', { State: state }, targets));
    });
});

describe('Figma parity: odd-chip (chip)', () => {
  const ATTRIBUTES: Record<string, string> = {
    Default: '',
    Disabled: 'disabled',
    Focus: '',
    Selected: 'selected',
  };
  for (const [state, attributes] of Object.entries(ATTRIBUTES))
    it(state, async () => {
      const el = mount(`<odd-chip removable ${attributes}>Design systems</odd-chip>`);
      await settle(el);
      const base = shadowPart(el, 'base');
      const surface = [`Removable chip / ${state}`, 'Surface'];
      const targets: Target[] = [
        { layer: surface, el: base, kind: 'frame', gap: 'column-gap' },
        { layer: [...surface, 'Design systems'], el: base, kind: 'text' },
      ];
      if (state === 'Focus') {
        targets.push({ layer: [...surface, 'Surface'], el: base, kind: 'ring' });
        await interact('Focus', shadowPart(el, 'remove'));
      }
      await transitions(targets);
      expectNone(compare('Oddkin/Common/chip', { State: state }, targets));
    });
});

describe('Figma parity: odd-progress (progress)', () => {
  it('Determinate', async () => {
    const el = mount(
      '<odd-progress label="Uploading files" value="0.64" description="8 of 12 files"></odd-progress>',
    );
    await settle(el);
    const frame = ['Progress / Determinate'];
    const targets: Target[] = [
      { layer: [...frame, 'Surface'], el: shadowPart(el, 'track'), kind: 'frame' },
      { layer: [...frame, 'Surface [2]'], el: shadowPart(el, 'indicator'), kind: 'frame' },
      { layer: [...frame, 'Uploading files'], el: shadowPart(el, 'label'), kind: 'text' },
      { layer: [...frame, '64%'], el: shadowPart(el, 'value-text'), kind: 'text' },
      { layer: [...frame, '8 of 12 files'], el: shadowPart(el, 'description'), kind: 'text' },
    ];
    expectNone(compare('Oddkin/Common/progress', { State: 'Determinate' }, targets));
  });

  it('Indeterminate', async () => {
    const el = mount(
      '<odd-progress label="Preparing upload" description="Please wait…"></odd-progress>',
    );
    await settle(el);
    const frame = ['Progress / Indeterminate'];
    const targets: Target[] = [
      { layer: [...frame, 'Surface'], el: shadowPart(el, 'track'), kind: 'frame' },
      { layer: [...frame, 'Surface [2]'], el: shadowPart(el, 'indicator'), kind: 'frame' },
      { layer: [...frame, 'Preparing upload'], el: shadowPart(el, 'label'), kind: 'text' },
      { layer: [...frame, 'Please wait…'], el: shadowPart(el, 'description'), kind: 'text' },
    ];
    expectNone(compare('Oddkin/Common/progress', { State: 'Indeterminate' }, targets));
    // Unknown progress never shows a percentage (Figma's review row).
    expect(shadowPart(el, 'value-text').textContent!.trim()).toBe('');
  });
});

describe('Figma parity: odd-spinner (spinner)', () => {
  it('Default', async () => {
    const el = mount('<odd-spinner>Loading workspace…</odd-spinner>');
    await settle(el);
    const base = shadowPart(el, 'base');
    const frame = ['Spinner / Default'];
    const targets: Target[] = [
      { layer: frame, el: base, kind: 'frame', gap: 'column-gap' },
      { layer: [...frame, 'Loading workspace…'], el: base, kind: 'text' },
    ];
    expectNone(compare('Oddkin/Common/spinner', { State: 'Default' }, targets));
  });
});

describe('Figma parity: odd-skeleton (skeleton)', () => {
  it('Default', async () => {
    const el = mount('<odd-skeleton lines="3"></odd-skeleton>');
    await settle(el);
    const targets: Target[] = [
      { layer: ['Skeleton / Default', 'Surface'], el: shadowPart(el, 'line'), kind: 'frame' },
    ];
    expectNone(compare('Oddkin/Common/skeleton', { State: 'Default' }, targets));
  });
});

describe('Figma parity: odd-empty-state (emptyState)', () => {
  it('No results', async () => {
    const el = mount(
      '<odd-empty-state label="No matching projects">Try a different search or clear your filters.</odd-empty-state>',
    );
    await settle(el);
    const frame = ['Empty state / No results'];
    const targets: Target[] = [
      { layer: [...frame, 'No matching projects'], el: shadowPart(el, 'label'), kind: 'text' },
      {
        layer: [...frame, 'Try a different search or clear your filters.'],
        el: el.shadowRoot!.querySelector('.body')!,
        kind: 'text',
      },
    ];
    expectNone(compare('Oddkin/Common/emptyState', { State: 'No results' }, targets));
  });
});

// Page 1388:2: Size is `size`; State is coverage, reached through label, slot, and src. Loading,
// Error, and Decorative draw the same initials as Fallback; Empty is the bare circle.
deliberate([
  /^Oddkin\/Primitives\/Avatar .* (top|bottom)(Left|Right)Radius \(--odd-radius-full\): border-(start|end)-(start|end)-radius 50%/,
  'odd-avatar draws its circle with 50% of its own size; radius.full (9999px) draws the same circle.',
]);

const AVATAR_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"%3E%3Crect width="40" height="40" fill="%23b8c4d9"/%3E%3C/svg%3E';

describe('Figma parity: odd-avatar (Primitives/Avatar)', () => {
  const MARKUP: Record<string, string> = {
    Fallback: 'label="Amelia Morgan"',
    Loading: `label="Amelia Morgan" src='${AVATAR_IMAGE}'`,
    Image: `label="Amelia Morgan" src='${AVATAR_IMAGE}'`,
    Error: 'label="Amelia Morgan" src="data:image/png;base64,broken"',
    Decorative: '',
    Empty: '',
  };
  for (const size of ['sm', 'md', 'lg'])
    for (const [state, attributes] of Object.entries(MARKUP))
      it(`${size} ${state}`, async () => {
        const content = state === 'Decorative' ? 'AM' : '';
        const el = mount(`<odd-avatar size="${size}" ${attributes}>${content}</odd-avatar>`);
        const base = shadowPart(el, 'base');
        const image = () => el.shadowRoot!.querySelector<HTMLImageElement>('[part="image"]');
        // Loading is read in the task that renders it: no load event can have run yet.
        if (state === 'Loading') flush();
        else await settle(el);
        if (state === 'Image') await expect.poll(() => image()?.hidden).toBe(false);
        if (state === 'Error') await expect.poll(() => image()).toBe(null);
        const targets: Target[] = [{ layer: [], el: base, kind: 'frame' }];
        if (state === 'Image')
          targets.push({
            layer: ['image \u00b7 authored SVG fixture'],
            el: image()!,
            kind: 'frame',
          });
        else if (state !== 'Empty') targets.push({ layer: ['AM'], el: base, kind: 'text' });
        const differences = compare(
          'Oddkin/Primitives/Avatar',
          { Size: size, State: state },
          targets,
        );
        if (state === 'Loading') expect(image()?.hidden, 'the picture waits, hidden').toBe(true);
        expect(el.shadowRoot!.querySelector('.initials') !== null, 'initials').toBe(
          state !== 'Image',
        );
        expectNone(differences);
      });
});

describe('Figma parity: CSS recipes (typography, keyboardKey, link, List)', () => {
  // base.css gives the page its primary text colour, which primary type roles inherit.
  useRecipeStyles(['base', 'typography', 'kbd', 'link', 'list']);

  for (const state of ['Default', 'Hover', 'Focus'])
    it(`link ${state}`, async () => {
      const root = mount('<div><a class="odd-link" href="#docs">Read the documentation</a></div>');
      const link = root.querySelector('a')!;
      await interact(state, link);
      const frame = [`Link / ${state}`];
      const targets: Target[] = [
        { layer: [...frame, 'Read the documentation'], el: link, kind: 'text' },
      ];
      if (state === 'Focus') targets.push({ layer: [...frame, 'Surface'], el: link, kind: 'ring' });
      await transitions(targets);
      expectNone(compare('Oddkin/Common/link', { State: state }, targets));
      // Figma underlines the link on hover and keyboard focus only.
      expect(getComputedStyle(link).textDecorationLine).toBe(
        state === 'Default' ? 'none' : 'underline',
      );
    });

  const TYPE: [string, string][] = [
    ['display', 'Made for the browser.'],
    ['title', 'A practical title'],
    ['section', 'Clear structure, shared foundations'],
    ['body', 'Body text keeps reading comfortable.'],
    ['ui', 'Interface labels remain clear'],
    ['small', 'Supporting detail and helpful hints.'],
    ['eyebrow', 'FOUNDATIONS / TYPE'],
  ];
  it('typography', () => {
    const root = mount(
      `<div>${TYPE.map(([role, text]) => `<p class="odd-type-${role}">${text}</p>`).join('')}</div>`,
    );
    const targets: Target[] = TYPE.map(([role, text]) => ({
      layer: ['Typography / Default', text],
      el: root.querySelector(`.odd-type-${role}`)!,
      kind: 'text',
    }));
    expectNone(compare('Oddkin/Common/typography', { State: 'Default' }, targets));
  });

  it('keyboardKey', () => {
    const root = mount('<p><kbd class="odd-kbd">Ctrl</kbd> + <kbd class="odd-kbd">K</kbd></p>');
    const [ctrl, k] = root.querySelectorAll('kbd');
    const frame = ['Keyboard key / Default'];
    const targets: Target[] = [
      { layer: [...frame, 'Surface'], el: ctrl!, kind: 'frame' },
      { layer: [...frame, 'Ctrl'], el: ctrl!, kind: 'text' },
      { layer: [...frame, 'K'], el: k!, kind: 'text' },
    ];
    expectNone(compare('Oddkin/Common/keyboardKey', { State: 'Default' }, targets));
  });

  it('List', () => {
    const list = mount(`<ul class="odd-list">
      <li>Components <span class="odd-list-meta">Reusable controls and patterns</span></li>
    </ul>`);
    const surface = ['List / Default', 'Surface'];
    const targets: Target[] = [
      { layer: surface, el: list, kind: 'frame' },
      { layer: [...surface, 'Components'], el: list.querySelector('li')!, kind: 'text' },
      {
        layer: [...surface, 'Reusable controls and patterns'],
        el: list.querySelector('.odd-list-meta')!,
        kind: 'text',
      },
    ];
    expectNone(compare('Oddkin/Common/List', { State: 'Default' }, targets));
  });
});

describe('Figma parity: odd-side-nav entries (NavigationItem)', () => {
  for (const state of ['Default', 'Current', 'Disabled', 'Focus'])
    it(state, async () => {
      const el = mount('<odd-side-nav label="Main"></odd-side-nav>') as HTMLElement & {
        items: unknown[];
        current: string;
      };
      el.items = [
        state === 'Disabled'
          ? {
              id: 'components',
              kind: 'action',
              label: 'Components',
              action: 'open',
              disabled: true,
            }
          : { id: 'components', kind: 'link', label: 'Components', href: '#components' },
      ];
      if (state === 'Current') el.current = 'components';
      await settle(el);
      const entry = el.shadowRoot!.querySelector<HTMLElement>('.entry')!;
      const frame = [`NavigationItem / ${state}`, 'Surface'];
      const targets: Target[] = [
        { layer: frame, el: entry, kind: 'frame', gap: 'column-gap' },
        { layer: [...frame, 'Components'], el: entry, kind: 'text' },
      ];
      if (state === 'Current')
        targets.push({ layer: [...frame, 'Surface'], el: entry, kind: 'marker' });
      if (state === 'Focus')
        targets.push({ layer: [...frame, 'Surface'], el: entry, kind: 'ring' });
      await interact(state, entry);
      await transitions(targets);
      expectNone(compare('Oddkin/Common/NavigationItem', { State: state }, targets));
    });
});
