/**
 * The API vocabulary of ADR 0045 and a check of published custom-element manifests against it.
 * One name, one meaning, one type: controlled names must have their type and values; replaced
 * names are reported with the canonical one; custom events carry the `odd-` prefix.
 */

/** Controlled attribute names: `type` for scalars, `values` (a set, or families of sets) for enums. */
export const ATTRIBUTES = {
  appearance: {
    families: {
      actions: ['primary', 'secondary', 'ghost'],
      surfaces: ['outlined', 'filled', 'elevated'],
      fields: ['outlined', 'filled'],
    },
  },
  tone: { values: ['neutral', 'info', 'success', 'warning', 'danger'] },
  size: { values: ['sm', 'md', 'lg'] },
  padding: { values: ['none', 'sm', 'md', 'lg'] },
  status: {
    values: ['idle', 'pending', 'streaming', 'complete', 'failed', 'cancelled', 'interrupted'],
  },
  orientation: { values: ['horizontal', 'vertical'] },
  activation: { values: ['automatic', 'manual'] },
  announce: { values: ['none', 'important', 'all'] },
  label: { type: 'string' },
  description: { type: 'string' },
  error: { type: 'string' },
  current: { type: 'string' },
  name: { type: 'string' },
  // A string as on <input>; a number on odd-progress, as on <progress> (ADR 0045 §2).
  value: { type: 'string', native: { 'odd-progress': 'number' } },
  loading: { type: 'boolean' },
  open: { type: 'boolean' },
  checked: { type: 'boolean' },
  indeterminate: { type: 'boolean' },
  disabled: { type: 'boolean' },
  readonly: { type: 'boolean' },
  required: { type: 'boolean' },
  multiple: { type: 'boolean' },
  pressed: { type: 'boolean' },
  toggle: { type: 'boolean' },
  // Constraints as on <input>: strings, since date and time types use them. Numbers where the
  // element's counterpart is numeric: <progress>, and odd-split-panel's percentages.
  min: { type: 'string', native: { 'odd-split-panel': 'number' } },
  max: { type: 'string', native: { 'odd-progress': 'number', 'odd-split-panel': 'number' } },
  step: { type: 'string' },
  minlength: { type: 'number' },
  maxlength: { type: 'number' },
  pattern: { type: 'string' },
  collapsed: { type: 'boolean' },
  // The start pane's size in percent (odd-split-panel).
  position: { type: 'number' },
  // Overlays (component-contracts.md §2.6): the position controller's logical vocabulary.
  anchor: { type: 'string' },
  side: { values: ['block-start', 'block-end', 'inline-start', 'inline-end'] },
  align: { values: ['start', 'center', 'end'] },
};

/** Replaced attribute and property names → the canonical name (ADR 0045 §3). */
export const SYNONYMS = {
  variant: 'appearance (treatment) or tone (meaning colour)',
  kind: 'appearance',
  treatment: 'appearance',
  outline: 'appearance',
  color: 'tone',
  intent: 'tone',
  severity: 'tone',
  heading: 'label',
  caption: 'label',
  hint: 'description',
  'help-text': 'description',
  'supporting-text': 'description',
  'error-text': 'error',
  'error-message': 'error',
  'validation-message': 'error',
  invalid: 'error (and :state(user-invalid))',
  busy: 'loading',
  pending: 'loading',
  opened: 'open',
  visible: 'open',
  show: 'open',
  active: 'current',
  'active-id': 'current',
  'selected-id': 'value',
  'selected-value': 'value',
  on: 'checked or pressed',
  toggled: 'pressed',
  mode: 'view (content presentation; colour mode is data-odd-mode)',
  mixed: 'indeterminate',
  direction: 'orientation',
  vertical: 'orientation',
  announcements: 'announce',
  labels: 'strings',
  messages: 'strings',
  i18n: 'strings',
  placement: 'side and align',
};

/** Replaced slot names (ADR 0045 §4). */
export const SLOT_SYNONYMS = {
  prefix: 'start',
  suffix: 'end',
  leading: 'start',
  trailing: 'end',
  before: 'start',
  after: 'end',
  above: 'header',
  below: 'footer',
};

/** Native event names an element may re-dispatch with native meaning (ADR 0045 §5.1). */
export const NATIVE_EVENTS = [
  'input',
  'change',
  'toggle',
  'beforetoggle',
  'close',
  'cancel',
  'invalid',
];

/** Native element members keep their names even when a synonym matches (ADR 0045 §2). */
export const NATIVE_MEMBERS = [
  'form',
  'labels',
  'validity',
  'validationMessage',
  'willValidate',
  'defaultValue',
  'selectedOptions',
  'selectionStart',
  'selectionEnd',
  'selectionDirection',
];

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const literals = (text) => [...(text ?? '').matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
const typeOf = (text = '') =>
  /^boolean$/.test(text.trim())
    ? 'boolean'
    : /^string(\s*\|\s*undefined)?$/.test(text.trim())
      ? 'string'
      : /^number/.test(text.trim())
        ? 'number'
        : literals(text).length
          ? 'enum'
          : 'other';

/**
 * Findings for one custom-element declaration from a Custom Elements Manifest.
 * @returns {{ code: string, tag: string, name: string, message: string }[]}
 */
export function checkDeclaration(declaration) {
  const tag = declaration.tagName;
  const findings = [];
  const report = (code, name, message) => findings.push({ code, tag, name, message });
  const attributeFields = new Set();

  for (const attribute of declaration.attributes ?? []) {
    const name = attribute.name;
    if (attribute.fieldName) attributeFields.add(attribute.fieldName);
    const type = attribute.type?.text;
    if (Object.hasOwn(SYNONYMS, name))
      report('vocabulary.synonym', name, `use ${SYNONYMS[name]} instead of "${name}"`);
    const rule = ATTRIBUTES[name];
    const expected = rule?.native?.[tag] ?? rule?.type;
    if (expected && typeOf(type) !== expected)
      report('vocabulary.type', name, `"${name}" is a ${expected}, not ${type ?? 'untyped'}`);
    if (rule?.values || rule?.families) {
      const values = literals(type);
      const sets = rule.values ? [rule.values] : Object.values(rule.families);
      if (!values.length)
        report('vocabulary.type', name, `"${name}" is an enumeration, not ${type ?? 'untyped'}`);
      else if (!sets.some((set) => values.every((value) => set.includes(value))))
        report(
          'vocabulary.values',
          name,
          `"${name}" values ${values.join(' | ')} are outside ${sets.map((set) => set.join(' | ')).join(' or ')}`,
        );
    }
    if (typeOf(type) === 'boolean' && String(attribute.default).trim() === 'true')
      report(
        'vocabulary.boolean.default',
        name,
        `boolean "${name}" defaults to true; name the opt-out no-${name}`,
      );
  }

  for (const member of declaration.members ?? []) {
    if (member.kind !== 'field' || member.static || member.privacy === 'private') continue;
    const name = member.name;
    if (name.startsWith('_') || attributeFields.has(name) || NATIVE_MEMBERS.includes(name))
      continue;
    const type = member.type?.text ?? '';
    if (Object.hasOwn(SYNONYMS, kebab(name)) && !ATTRIBUTES[kebab(name)])
      report('vocabulary.synonym', name, `use ${SYNONYMS[kebab(name)]} instead of "${name}"`);
    if (/^[a-z]\w*Renderer$/.test(name))
      report(
        'vocabulary.synonym',
        name,
        `a single renderer is render<Thing> (render${name[0].toUpperCase()}${name.slice(1, -'Renderer'.length)})`,
      );
    if (name === 'source' && /ExternalSource|Controller/.test(type))
      report(
        'vocabulary.synonym',
        name,
        'a state owner is "store" (or "controller"); "source" is a cited source',
      );
    if (name === 'current' && member.readonly && typeOf(type) === 'other')
      report(
        'vocabulary.synonym',
        name,
        'a rendered snapshot is "snapshot"; "current" is an item id',
      );
  }

  for (const slot of declaration.slots ?? []) {
    if (Object.hasOwn(SLOT_SYNONYMS, slot.name))
      report(
        'vocabulary.synonym',
        `slot:${slot.name}`,
        `use the "${SLOT_SYNONYMS[slot.name]}" slot instead of "${slot.name}"`,
      );
  }

  for (const event of declaration.events ?? []) {
    const name = event.name;
    if (!name || name.startsWith('odd-') || NATIVE_EVENTS.includes(name)) continue;
    report(
      'vocabulary.event.name',
      `event:${name}`,
      `custom events are odd-<subject>-<verb>; rename "${name}" (e.g. "odd-${name.replace(/^ai-/, '')}")`,
    );
  }
  return findings;
}

/** Findings for every custom element in a manifest. */
export function checkManifest(manifest) {
  return (manifest.modules ?? []).flatMap((module) =>
    (module.declarations ?? []).filter((d) => d.tagName).flatMap(checkDeclaration),
  );
}
