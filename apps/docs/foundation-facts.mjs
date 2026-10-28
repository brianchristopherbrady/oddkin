// Facts for the Foundations pages, generated from @oddkin/tokens' inspection of the default theme,
// its contrast report, odd-alert's documented examples, and the token architecture document.
// Nothing here is typed by hand: values, names, and table text come from those files.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const cell = (text) => [text];
const code = (text) => [{ code: text }];

/** Markdown inline marks removed. */
const plain = (text) =>
  text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*]/g, '')
    .trim();

/** The first table under a heading of a Markdown document: plain cells, the header row first. */
function markdownTable(markdown, heading) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => /^#{2,4} /.test(line) && line.includes(heading));
  if (start < 0) throw new Error(`theming-and-styling.md has no heading "${heading}".`);
  const rows = [];
  for (let i = start + 1; i < lines.length && !/^#{2,4} /.test(lines[i]); i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) {
      if (rows.length) break;
      continue;
    }
    if (/^\|\s*-/.test(line)) continue;
    rows.push(line.slice(1, -1).split('|').map(plain));
  }
  if (!rows.length) throw new Error(`theming-and-styling.md has no table under "${heading}".`);
  return rows;
}

/** A table block from Markdown rows (header first). */
const docTable = (caption, [head, ...rows]) => ({
  table: { caption, head, rows: rows.map((row) => row.map(cell)) },
});

/** Role names in a cell of the palette table: `a.b / c`, `a, b`, and `color.{x,y}.border`. */
function roleNames(text) {
  const names = [];
  for (const part of text.split(/,\s*(?![^{]*\})/)) {
    const [first = '', ...rest] = part.split(/\s*\/\s*/);
    const brace = /^(.*)\{([^}]+)\}(.*)$/.exec(first.trim());
    names.push(
      ...(brace ? brace[2].split(',').map((x) => `${brace[1]}${x}${brace[3]}`) : [first.trim()]),
    );
    const stem = first.trim().split('.').slice(0, -1).join('.');
    for (const tail of rest) names.push(`${stem}.${tail.trim()}`);
  }
  return names;
}

/** Scale steps in size order; the inspection lists tokens alphabetically. */
const STEPS = ['none', '3xs', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'full'];

/** A family in scale order: by step name when every step is named, else by numeric value. */
function ordered(list) {
  const step = (t) => STEPS.indexOf(t.name.split('.').at(-1));
  if (list.every((t) => step(t) >= 0)) return [...list].sort((a, b) => step(a) - step(b));
  const number = (t) => parseFloat(typeof t.value === 'string' ? t.value : '');
  if (list.every((t) => !Number.isNaN(number(t))))
    return [...list].sort((a, b) => number(a) - number(b));
  return list;
}

export async function foundationFacts(root) {
  const inspect = join(root, 'packages/tokens/dist/inspect');
  const inspection = await json(join(inspect, 'default.inspect.json'));
  const contrast = await json(join(inspect, 'default.contrast.json'));
  const theming = await readFile(join(root, 'docs/architecture/theming-and-styling.md'), 'utf8');
  const alertExamples = await readFile(
    join(root, 'packages/components/src/alert/alert.examples.ts'),
    'utf8',
  );

  const tokens = new Map(inspection.tokens.map((token) => [token.name, token]));
  const token = (name) => {
    const found = tokens.get(name);
    if (!found) throw new Error(`The default theme has no token "${name}".`);
    return found;
  };
  const family = (prefix) => ordered(inspection.tokens.filter((t) => t.name.startsWith(prefix)));
  const { modes } = inspection;
  const valueIn = (t, mode) => (typeof t.value === 'string' ? t.value : t.value[mode]);
  const definition = (t) => (typeof t.definition === 'string' ? t.definition : 'per mode');
  const colour = (t, mode) => [
    { preview: 'color', token: t.cssVariable, mode },
    ' ',
    { code: valueIn(t, mode) },
  ];

  // What each colour role is for, from the approved palette table (§10.1): its first sentence.
  const uses = new Map();
  for (const [role, , , use = ''] of markdownTable(theming, '10.1 Approved').slice(1))
    for (const name of roleNames(role)) uses.set(name, use.split(/(?<=\.)\s/)[0]);
  const colourTable = (caption, names) => ({
    table: {
      caption,
      head: ['Role', ...modes.map((m) => m.charAt(0).toUpperCase() + m.slice(1)), 'Use'],
      rows: names.map((name) => [
        code(name),
        ...modes.map((mode) => colour(token(name), mode)),
        cell(uses.get(name) ?? ''),
      ]),
    },
  });
  const valueTable = (caption, list, extra) => ({
    table: {
      caption,
      head: ['Token', 'Value', ...(extra ? [extra.head] : [])],
      rows: list.map((t) => [
        code(t.name),
        code(valueIn(t, modes[0])),
        ...(extra ? [extra.cell(t)] : []),
      ]),
    },
  });
  const aliasTable = (caption, list) => ({
    table: {
      caption,
      head: ['Role', 'Reads', 'Value'],
      rows: list.map((t) => [code(t.name), code(definition(t)), code(valueIn(t, modes[0]))]),
    },
  });

  const semanticColours = inspection.tokens
    .filter((t) => t.category === 'semantic' && t.type === 'color')
    .map((t) => t.name);
  // In the palette table's order; roles it does not list come last.
  const documented = [...uses.keys()];
  const rank = (name) => (documented.includes(name) ? documented.indexOf(name) : documented.length);
  semanticColours.sort((a, b) => rank(a) - rank(b));
  const tones = ['neutral', 'info', 'success', 'warning', 'danger'];
  const isTone = (name) => tones.some((tone) => name.startsWith(`color.${tone}.`));
  const isAction = (name) => name.startsWith('color.action.') || name === 'color.text.on-action';

  // card.padding through its aliases to a value.
  const chain = [];
  for (let t = token('card.padding'); t;) {
    chain.push(t);
    const alias = /^\{([^}]+)\}$/.exec(definition(t));
    t = alias ? token(alias[1]) : undefined;
  }

  // Contrast: each foreground against the first background the report pairs it with.
  const pairs = [];
  for (const pair of contrast.pairs) {
    if (pair.mode !== modes[0] || pairs.some((p) => p.foreground === pair.foreground)) continue;
    pairs.push(pair);
  }
  const ratio = (pair, mode) => {
    const found = contrast.pairs.find(
      (p) =>
        p.foreground === pair.foreground && p.background === pair.background && p.mode === mode,
    );
    return found ? `${found.ratio}:1` : '';
  };

  // The first documented example of each tone.
  const alertLabels = new Map();
  for (const [, tone, label] of alertExamples.matchAll(/tone: '(\w+)', label: '([^']+)'/g))
    if (!alertLabels.has(tone)) alertLabels.set(tone, label);
  const durations = family('motion.duration.');
  const longest = Math.max(...durations.map((t) => parseFloat(valueIn(t, modes[0]))));
  const textRoles = ['display', 'section', 'title', 'body', 'ui', 'small', 'eyebrow', 'code'];
  const layout = inspection.tokens.filter((t) => t.category === 'layout');

  return {
    'token-categories': [
      {
        table: {
          caption: `Tokens in the default theme, by category (${inspection.tokens.length})`,
          head: ['Category', 'Tokens', 'Example'],
          rows: [...new Set(inspection.tokens.map((t) => t.category))].map((category) => {
            const list = inspection.tokens.filter((t) => t.category === category);
            return [code(category), cell(String(list.length)), code(list[0].cssVariable)];
          }),
        },
      },
    ],
    'token-pipeline': [
      docTable('The generator, stage by stage', markdownTable(theming, '2. Pipeline')),
    ],
    'token-trace': [
      {
        table: {
          caption: 'card.padding, resolved through its aliases',
          head: ['Token', 'Category', 'Definition', 'Value'],
          rows: chain.map((t) => [
            code(t.name),
            cell(t.category),
            code(definition(t)),
            code(valueIn(t, modes[0])),
          ]),
        },
      },
    ],
    palette: ['brand', 'neutral', 'info', 'success', 'warning', 'danger'].map((name) => ({
      ramp: {
        title: `ref.${name}`,
        steps: family(`ref.${name}.`).map((t) => ({
          label: t.name.split('.').at(-1),
          value: valueIn(t, modes[0]),
          token: t.cssVariable,
        })),
      },
    })),
    'color-roles': [
      colourTable(
        'Surface, text, border, and other roles',
        semanticColours.filter((n) => !isTone(n) && !isAction(n)),
      ),
    ],
    'action-roles': [
      colourTable('Action roles', semanticColours.filter(isAction)),
      {
        modes: {
          caption: 'A primary action in each mode',
          modes,
          specimen: { action: 'Continue' },
        },
      },
    ],
    'tone-roles': [
      colourTable(
        'Tone roles',
        tones.flatMap((tone) =>
          ['foreground', 'surface', 'border'].map((r) => `color.${tone}.${r}`),
        ),
      ),
      {
        tones: tones.map((tone) => ({
          tone,
          label: alertLabels.get(tone) ?? tone.charAt(0).toUpperCase() + tone.slice(1),
          token: `color.${tone}.surface`,
        })),
      },
    ],
    'contrast-pairs': [
      {
        p: [
          `${contrast.summary.pass} pairs pass, ${contrast.summary.fail} fail, and ${contrast.summary.exempt} are exempt. Method: ${contrast.method}.`,
        ],
      },
      {
        table: {
          caption: 'Each foreground role against its first background',
          head: [
            'Foreground',
            'Background',
            ...modes.map((m) => m.charAt(0).toUpperCase() + m.slice(1)),
            'Minimum',
          ],
          rows: pairs.map((pair) => [
            code(pair.foreground),
            code(pair.background),
            ...modes.map((mode) => cell(ratio(pair, mode))),
            cell(
              pair.status === 'exempt'
                ? `Exempt (${pair.criterion})`
                : `${pair.minimum}:1 (${pair.criterion})`,
            ),
          ]),
        },
      },
    ],
    'font-families': [valueTable('Font families', family('font.family.'))],
    'type-scale': [
      valueTable('Font sizes', family('font.size.'), {
        head: 'Sample',
        cell: (t) => [{ preview: 'font-size', token: t.cssVariable, text: 'Aa' }],
      }),
    ],
    'text-styles': [
      {
        table: {
          caption: 'Text styles',
          head: ['Style', 'Size / weight', 'Line height', 'Letter spacing', 'Sample'],
          rows: textRoles.map((role) => {
            const part = (name) => valueIn(token(`type.${role}.${name}`), modes[0]);
            return [
              code(`type.${role}`),
              cell(`${part('size')} / ${part('weight')}`),
              cell(part('line-height')),
              cell(part('letter-spacing')),
              [{ sample: role, role }],
            ];
          }),
        },
      },
      {
        note: [
          { code: 'layout.measure' },
          ` is ${valueIn(token('layout.measure'), modes[0])}, the content measure of `,
          { code: 'odd-container' },
          '.',
        ],
      },
    ],
    'space-scale': [
      valueTable('Space scale', family('space.'), {
        head: 'Sample',
        cell: (t) => [{ preview: 'space', token: t.cssVariable }],
      }),
    ],
    'layout-vocabulary': [
      aliasTable(
        'Roles that read the space scale',
        inspection.tokens.filter(
          (t) => t.category !== 'foundation' && /^\{(space|layout)\./.test(definition(t)),
        ),
      ),
    ],
    'border-widths': [
      valueTable('Border and focus widths', [
        ...family('border.width.'),
        token('focus.width'),
        token('focus.offset'),
      ]),
    ],
    'border-roles': [
      colourTable('Border and focus roles', [
        'color.border.default',
        'color.border.strong',
        'color.focus.ring',
      ]),
    ],
    radii: [
      valueTable('Corner radii', family('radius.'), {
        head: 'Sample',
        cell: (t) => [{ preview: 'radius', token: t.cssVariable }],
      }),
    ],
    'radius-mappings': [
      aliasTable(
        'Component roles that read the radius scale',
        inspection.tokens.filter((t) => /^\{radius\./.test(definition(t))),
      ),
    ],
    'elevation-levels': [
      {
        table: {
          caption: 'Elevation levels',
          head: ['Token', ...modes.map((m) => m.charAt(0).toUpperCase() + m.slice(1))],
          rows: family('elevation.').map((t) => [
            code(t.name),
            ...modes.map((m) => code(valueIn(t, m))),
          ]),
        },
      },
      {
        modes: {
          caption: 'Each elevation in each mode',
          modes,
          specimen: { elevation: family('elevation.').map((t) => t.name) },
        },
      },
    ],
    'motion-durations': [
      {
        table: {
          caption: 'Durations',
          head: ['Token', 'Value', 'Reduced motion', 'Length'],
          rows: durations.map((t) => [
            code(t.name),
            code(valueIn(t, modes[0])),
            code(t.reducedMotion ?? valueIn(t, modes[0])),
            [{ meter: parseFloat(valueIn(t, modes[0])), max: longest, label: t.name }],
          ]),
        },
      },
    ],
    'motion-easings': [valueTable('Easing curves', family('motion.easing.'))],
    'theme-baseline': [
      {
        modes: {
          caption: 'The baseline roles in each mode',
          modes,
          specimen: {
            roles: [
              'color.canvas',
              'color.surface.default',
              'color.text.primary',
              'color.action.default',
            ],
          },
        },
      },
    ],
    'scope-attributes': [
      {
        table: {
          caption: 'Scopes in the default theme',
          head: ['Scope', 'Tokens it sets', 'Aliases it re-declares'],
          rows: inspection.scopes.map((scope) => [
            code(scope.selector),
            cell(String(scope.changed.length)),
            cell(String(scope.redeclared.length)),
          ]),
        },
      },
    ],
    'scope-composition': [
      docTable('Scope axes together', markdownTable(theming, '5.4 Composition')),
    ],
    conditions: [
      {
        table: {
          caption: 'Named conditions',
          head: ['Condition', 'Kind', 'Emitted as'],
          rows: inspection.conditions.map((c) => [code(c.name), cell(c.kind), code(c.atRule)]),
        },
      },
    ],
    'layout-roles': [
      valueTable('Layout roles', layout),
      {
        reflow: {
          items: layout.map((t) => t.name),
          widths: ['layout.item-min', 'layout.measure'].map((name) => ({
            token: token(name).cssVariable,
            caption: `${name}: ${valueIn(token(name), modes[0])}`,
          })),
        },
      },
    ],
    profiles: [
      {
        table: {
          caption: 'Profiles in the default theme',
          head: ['Profile', 'Roles it sets'],
          rows: inspection.scopes
            .filter((scope) => scope.selector.includes('data-odd-profile'))
            .map((scope) => [
              code(/"([^"]+)"/.exec(scope.selector)?.[1] ?? scope.selector),
              cell(scope.changed.map((c) => (typeof c === 'string' ? c : c.name)).join(', ')),
            ]),
        },
      },
    ],
    'layout-concerns': [docTable('Concerns kept apart', markdownTable(theming, '11.4 Keep'))],
  };
}
