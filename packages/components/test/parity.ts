import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { commands, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';

// Figma parity helpers shared by the figma-parity*.browser.test.ts files: each Figma variant on page
// 158:22 maps to attributes and an interaction; each layer that Figma binds maps to a part, and its
// computed style equals the token Figma binds (read from the committed snapshot
// design/figma/components.json, never Figma live). Text styles compare size, weight, and line height
// with design/figma/variables.json; Figma's Roboto stands in for the system stack, so font families
// and text widths are not compared. DELIBERATE lists each accepted difference with its reason.

type Bound = string | { value: string; variants: number[] };
interface Layer {
  path: string[];
  types: string[];
  in?: number[];
  bound?: Record<string, Bound[]>;
}
export interface Family {
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
export interface Target {
  layer: string[];
  el: Element;
  kind: Kind;
  pseudo?: string;
  gap?: 'column-gap' | 'row-gap';
  /** More bound fields to compare, as [Figma field, CSS property] (layout: `counterAxisSpacing`, …). */
  fields?: [string, string][];
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
/** Adds accepted differences for the calling test file, each with its reason. */
export const deliberate = (...entries: [RegExp, string][]) => DELIBERATE.push(...entries);

export let figma: Map<string, Family>;
let textStyles: Map<string, TextStyle>;
let tokens: HTMLLinkElement;
let container: HTMLElement;

// Paths relative to the repository root (the Vitest root).
const json = async (path: string) => JSON.parse(await commands.readFile(path));

/** Registers the hooks every parity file needs: elements, the snapshot, the default theme, cleanup. */
export function useParity() {
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
    expect(
      getComputedStyle(document.documentElement).getPropertyValue('--odd-space-md').trim(),
    ).toBe('1rem');
    // The pointer may rest where an earlier test file left it, over the first mounted element.
    await userEvent.unhover(document.body);
  });
  afterAll(() => tokens.remove());
  afterEach(async () => {
    await userEvent.unhover(document.body);
    container?.remove();
    flush();
  });
}

/** Loads built recipe stylesheets (`dist/css/<name>.css`) for the calling describe block. */
export function useRecipeStyles(names: string[]) {
  let links: HTMLLinkElement[] = [];
  beforeAll(async () => {
    links = await Promise.all(
      names.map(
        (name) =>
          new Promise<HTMLLinkElement>((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = new URL(`../dist/css/${name}.css`, import.meta.url).href;
            link.onload = () => resolve(link);
            link.onerror = reject;
            document.head.append(link);
          }),
      ),
    );
  });
  afterAll(() => {
    for (const link of links) link.remove();
  });
}

export const variantIndex = (family: Family, values: Record<string, string>) => {
  const index = family.variants.findIndex((v) =>
    Object.entries(values).every(([k, value]) => v.values[k] === value),
  );
  if (index < 0) throw new Error(`${family.name}: no variant ${JSON.stringify(values)}`);
  return index;
};
export const layersOf = (family: Family, index: number) =>
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
export function compare(familyName: string, values: Record<string, string>, targets: Target[]) {
  const family = figma.get(familyName)!;
  const index = variantIndex(family, values);
  const layers = layersOf(family, index);
  const out: string[] = [];
  const where = `${familyName.replace('Oddkin/Common/', '')} ${Object.values(values).join('/')}`;
  for (const t of targets) {
    // `layer: []` is the component's own frame (layout families bind their padding there).
    const layer = t.layer.length
      ? layers.find((l) => l.path.join(' > ') === t.layer.join(' > '))
      : family.layers.find((l) => !l.path.length);
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
      for (const [field, property] of t.fields ?? [])
        check(field, property, style.getPropertyValue(property));
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
    if (t.kind === 'marker') {
      // The current-row bar is the row's ::before (Figma's inner "Surface" layer).
      const bar = getComputedStyle(t.el, '::before');
      check('fills', 'background-color', bar.backgroundColor);
    }
  }
  return out.filter((line) => !DELIBERATE.some(([pattern]) => pattern.test(line)));
}

export async function settle(el: Element) {
  flush();
  await (el as unknown as { updateComplete?: Promise<void> }).updateComplete;
  await new Promise(requestAnimationFrame);
}
/** Waits for running transitions on the targets (the busy spinner animates forever and is skipped). */
export async function transitions(targets: Target[]) {
  await Promise.all(
    targets.flatMap((t) =>
      t.el
        .getAnimations()
        .filter((a) => a instanceof CSSTransition)
        .map((a) => a.finished),
    ),
  );
}
export async function interact(state: string, control: HTMLElement) {
  if (state === 'Hover') await userEvent.hover(control);
  if (state === 'Focus') {
    const before = document.createElement('button');
    before.textContent = 'before';
    container.prepend(before);
    before.focus();
    await userEvent.tab();
    const tabbed = (control.getRootNode() as ShadowRoot).activeElement === control;
    // WebKit's Tab skips links unless the user turns that on; focus after the key press instead.
    if (!tabbed) control.focus();
    // WebKit focuses a date or time field's own segments: the input matches :focus only.
    const segmented = /^(date|time|datetime-local|month|week)$/.test(
      (control as HTMLInputElement).type,
    );
    expect(
      control.matches(segmented ? ':focus' : ':focus-visible'),
      `:focus-visible after ${tabbed ? 'Tab' : 'Tab and focus()'} (:focus ${control.matches(':focus')}, ${control.localName} ${(control as HTMLInputElement).type ?? ''})`,
    ).toBe(true);
  }
  if (state === 'Pressed') {
    control.focus();
    await userEvent.keyboard('[Space>]');
  }
}
export const mount = (markup: string) => {
  container = document.createElement('div');
  container.innerHTML = markup;
  document.body.append(container);
  return container.firstElementChild as HTMLElement;
};
export const release = async (state: string) => {
  if (state === 'Pressed') await userEvent.keyboard('[/Space]');
};
/** Fails with every difference listed, one per line. */
export const expectNone = (differences: string[]) => expect(differences.join('\n')).toBe('');

export const shadowPart = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
