import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { commands, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';

// Figma parity of the existing @oddkin/components elements (round 5, step 4a): each Figma variant
// on page 158:22 maps to attributes and an interaction; each layer that Figma binds maps to a part,
// and its computed style equals the token Figma binds (read from the committed snapshot
// design/figma/components.json, never Figma live). Text styles compare size, weight, and line
// height with design/figma/variables.json; Figma's Roboto stands in for the system stack, so font
// families and text widths are not compared. DELIBERATE lists each accepted difference with its reason.

type Bound = string | { value: string; variants: number[] };
interface Layer {
  path: string[];
  types: string[];
  in?: number[];
  bound?: Record<string, Bound[]>;
}
interface Family {
  name: string;
  variants: { values: Record<string, string> }[];
  layers: Layer[];
}
interface TextStyle {
  name: string;
  fontStyle: string;
  fontSize: number;
  lineHeight: { unit: string; value?: number };
}
type Kind = 'frame' | 'text' | 'ring' | 'marker';
interface Target {
  layer: string[];
  el: Element;
  kind: Kind;
  pseudo?: string;
  gap?: 'column-gap' | 'row-gap';
}

/** Accepted differences, each with its reason (also listed in component-catalog.md §7). */
const DELIBERATE: [RegExp, string][] = [
  [
    /^button\S* \S+ Button \/ Loading paddingLeft \(--odd-space-md\)/,
    'Figma pads the loading state with space/md at every size; the code keeps the size padding, so a button keeps its width when it starts loading.',
  ],
  [
    /^input .+ Text input \/ [^>]+ paddingLeft \(--odd-space-2xs\)/,
    'Figma insets the field frame by space/2xs to make room for its focus ring; the shared focus ring is an outline that takes no layout space.',
  ],
  [
    /^spinner Default Spinner \/ Default paddingLeft \(--odd-space-sm\)/,
    'Figma pads the spinner specimen frame; the element adds no padding, so it lines up with the text and controls around it.',
  ],
];

let figma: Map<string, Family>;
let textStyles: Map<string, TextStyle>;
let tokens: HTMLLinkElement;
let container: HTMLElement;

// Paths relative to the repository root (the Vitest root).
const json = async (path: string) => JSON.parse(await commands.readFile(path));

beforeAll(async () => {
  await import('./register.js');
  const [components, variables] = await Promise.all([
    json('design/figma/components.json'),
    json('design/figma/variables.json'),
  ]);
  figma = new Map(components.families.map((f: Family) => [f.name, f]));
  textStyles = new Map(variables.textStyles.map((s: TextStyle) => [s.name, s]));
  tokens = document.createElement('link');
  tokens.rel = 'stylesheet';
  tokens.href = new URL('../../tokens/dist/css/default.css', import.meta.url).href;
  const loaded = new Promise((resolve, reject) => {
    tokens.onload = resolve;
    tokens.onerror = reject;
  });
  document.head.append(tokens);
  await loaded;
  expect(getComputedStyle(document.documentElement).getPropertyValue('--odd-space-md').trim()).toBe(
    '1rem',
  );
});
afterAll(() => tokens.remove());
afterEach(async () => {
  await userEvent.unhover(document.body);
  container?.remove();
  flush();
});

const variantIndex = (family: Family, values: Record<string, string>) => {
  const index = family.variants.findIndex((v) =>
    Object.entries(values).every(([k, value]) => v.values[k] === value),
  );
  if (index < 0) throw new Error(`${family.name}: no variant ${JSON.stringify(values)}`);
  return index;
};
const layersOf = (family: Family, index: number) =>
  family.layers.filter((l) => l.path.length && (!l.in || l.in.includes(index)));
const boundFor = (layer: Layer, index: number, field: string): string | undefined => {
  for (const b of layer.bound?.[field] ?? []) {
    if (typeof b === 'string') return b;
    if (b.variants.includes(index)) return b.value;
  }
  return undefined;
};
// Collection naming as in packages/tokens/test/figma-parity.test.ts: component roles are token
// paths; repository tokens are `repo/<token path>`.
const tokenVar = (path: string) => {
  const role = /^Oddkin · Component roles\/(.+)$/.exec(path)?.[1];
  const repo = /^Oddkin · Repository tokens\/repo\/(.+)$/.exec(path)?.[1];
  const name = role ?? repo;
  if (!name) throw new Error(`no token mapping for ${path}`);
  return `--odd-${name.replaceAll('/', '-')}`;
};

/** The computed value of `property` set to the token, on a probe in the document. */
function resolved(property: string, variable: string): string {
  const defined = getComputedStyle(document.documentElement).getPropertyValue(variable);
  if (!defined.trim()) return `missing token ${variable}`;
  const probe = document.createElement('div');
  probe.style.cssText = `border-style: solid; outline-style: solid; ${property}: var(${variable})`;
  container.append(probe);
  const value = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return value;
}

const FRAME: [string, string][] = [
  ['fills', 'background-color'],
  ['strokes', 'border-block-start-color'],
  ['strokeTopWeight', 'border-block-start-width'],
  ['topLeftRadius', 'border-start-start-radius'],
  ['paddingLeft', 'padding-inline-start'],
  ['paddingTop', 'padding-block-start'],
];
const WEIGHTS: Record<string, string> = {
  Regular: '400',
  Medium: '500',
  SemiBold: '600',
  Bold: '700',
};

/** Differences between the parts' computed styles and what Figma binds, one line each. */
function compare(familyName: string, values: Record<string, string>, targets: Target[]) {
  const family = figma.get(familyName)!;
  const index = variantIndex(family, values);
  const layers = layersOf(family, index);
  const out: string[] = [];
  const where = `${familyName.replace('Oddkin/Common/', '')} ${Object.values(values).join('/')}`;
  for (const t of targets) {
    const layer = layers.find((l) => l.path.join(' > ') === t.layer.join(' > '));
    if (!layer) throw new Error(`${where}: no layer ${t.layer.join(' > ')}`);
    const style = getComputedStyle(t.el, t.pseudo);
    const at = `${where} ${t.layer.at(-1)}`;
    const check = (field: string, property: string, actual: string) => {
      const path = boundFor(layer, index, field);
      if (!path) return;
      const expected = resolved(property, tokenVar(path));
      if (actual !== expected)
        out.push(`${at} ${field} (${tokenVar(path)}): ${property} ${actual}, token ${expected}`);
    };
    if (t.kind === 'frame') {
      for (const [field, property] of FRAME)
        check(field, property, style.getPropertyValue(property));
      if (!boundFor(layer, index, 'fills') && style.backgroundColor !== 'rgba(0, 0, 0, 0)')
        out.push(`${at} fills (none): background-color ${style.backgroundColor}`);
      const border = parseFloat(style.borderBlockStartWidth);
      const visible = border > 0 && !/rgba\(.*, 0\)$/.test(style.borderBlockStartColor);
      if (!boundFor(layer, index, 'strokes') && visible)
        out.push(`${at} strokes (none): border ${style.borderBlockStartColor}`);
      if (t.gap) check('itemSpacing', t.gap, style.getPropertyValue(t.gap));
      const height = boundFor(layer, index, 'height');
      if (height) {
        const actual = `${t.el.getBoundingClientRect().height}px`;
        const expected = resolved('block-size', tokenVar(height));
        if (actual !== expected)
          out.push(`${at} height (${tokenVar(height)}): ${actual}, token ${expected}`);
      }
    }
    if (t.kind === 'text') {
      check('fills', 'color', style.color);
      const name = boundFor(layer, index, 'textStyle');
      // A placeholder renders in the control's line box; engines report a UA line height for it.
      const text = name && !t.pseudo ? textStyles.get(name) : undefined;
      if (text) {
        const lineHeight =
          text.lineHeight.unit === 'PIXELS' ? `${text.lineHeight.value}px` : style.lineHeight;
        const actual = `${style.fontSize} ${style.fontWeight} ${style.lineHeight}`;
        const expected = `${text.fontSize}px ${WEIGHTS[text.fontStyle]} ${lineHeight}`;
        if (actual !== expected)
          out.push(`${at} textStyle (${name}): ${actual}, Figma ${expected}`);
      }
    }
    if (t.kind === 'ring') {
      check('strokes', 'outline-color', style.outlineColor);
      check('strokeTopWeight', 'outline-width', style.outlineWidth);
    }
    if (t.kind === 'marker')
      check('fills', 'border-inline-start-color', style.borderInlineStartColor);
  }
  return out.filter((line) => !DELIBERATE.some(([pattern]) => pattern.test(line)));
}

async function settle(el: Element) {
  flush();
  await (el as unknown as { updateComplete?: Promise<void> }).updateComplete;
  await new Promise(requestAnimationFrame);
}
/** Waits for running transitions on the targets (the busy spinner animates forever and is skipped). */
async function transitions(targets: Target[]) {
  await Promise.all(
    targets.flatMap((t) =>
      t.el
        .getAnimations()
        .filter((a) => a instanceof CSSTransition)
        .map((a) => a.finished),
    ),
  );
}
async function interact(state: string, control: HTMLElement) {
  if (state === 'Hover') await userEvent.hover(control);
  if (state === 'Focus') {
    const before = document.createElement('button');
    before.textContent = 'before';
    container.prepend(before);
    before.focus();
    await userEvent.tab();
    // WebKit's Tab skips links unless the user turns that on; focus after the key press instead.
    if ((control.getRootNode() as ShadowRoot).activeElement !== control) control.focus();
    expect(control.matches(':focus-visible')).toBe(true);
  }
  if (state === 'Pressed') {
    control.focus();
    await userEvent.keyboard('[Space>]');
  }
}
const mount = (markup: string) => {
  container = document.createElement('div');
  container.innerHTML = markup;
  document.body.append(container);
  return container.firstElementChild as HTMLElement;
};
const release = async (state: string) => {
  if (state === 'Pressed') await userEvent.keyboard('[/Space]');
};
/** Fails with every difference listed, one per line. */
const expectNone = (differences: string[]) => expect(differences.join('\n')).toBe('');

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
          const el = mount(`<odd-button ${attributes}>Label</odd-button>`);
          await settle(el);
          const control = el.shadowRoot!.querySelector<HTMLElement>('[part="control"]')!;
          const index = variantIndex(family, values);
          const frame = layersOf(family, index).find((l) => l.path.length === 1)!.path;
          const targets: Target[] = [
            { layer: frame, el: control, kind: 'frame', gap: 'column-gap' },
            { layer: [...frame, 'Label'], el: control, kind: 'text' },
          ];
          if (state === 'Focus')
            targets.push({ layer: [...frame, 'Surface'], el: control, kind: 'ring' });
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

const BADGES: Record<string, { attributes: string; text: string }> = {
  Neutral: { attributes: '', text: 'Draft' },
  Success: { attributes: 'tone="success"', text: 'Success' },
  Warning: { attributes: 'tone="warning"', text: 'Warning' },
  Danger: { attributes: 'tone="danger"', text: 'Danger' },
  Count: { attributes: 'no-marker', text: '12' },
};

describe('Figma parity: odd-badge (badge)', () => {
  for (const [state, spec] of Object.entries(BADGES))
    it(state, async () => {
      const el = mount(`<odd-badge ${spec.attributes}>${spec.text}</odd-badge>`);
      await settle(el);
      const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      const surface = [`Badge / ${state}`, 'Surface'];
      const targets: Target[] = [
        { layer: surface, el: base, kind: 'frame' },
        { layer: [...surface, spec.text], el: base, kind: 'text' },
      ];
      expectNone(compare('Oddkin/Common/badge', { State: state }, targets));
    });
});

const shadowPart = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;

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
        { layer: [...frame, spec.title], el: shadowPart(el, 'label'), kind: 'text' },
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

describe('Figma parity: odd-avatar (avatar)', () => {
  for (const [initials, size] of [
    ['AM', 'md'],
    ['SK', 'sm'],
  ] as const)
    it(`Initials ${initials} (${size})`, async () => {
      const el = mount(`<odd-avatar size="${size}">${initials}</odd-avatar>`);
      await settle(el);
      const targets: Target[] = [
        { layer: ['Avatar / Initials', initials], el: shadowPart(el, 'base'), kind: 'text' },
      ];
      expectNone(compare('Oddkin/Common/avatar', { State: 'Initials' }, targets));
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
