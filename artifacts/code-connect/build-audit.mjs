import fs from 'node:fs';
const root = new URL('../../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const snapshot = JSON.parse(read('artifacts/code-connect/audit-snapshot.json'));
const pkg = JSON.parse(read('packages/components/package.json'));
const metadata = JSON.parse(read('packages/components/oddkin.metadata.json'));
const norm = (s) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();
const components = Object.values(metadata.components).map((c) => ({
  tag: c.tag,
  name: c.cem.name,
  folder: c.tag.replace(/^odd-/, ''),
  registration: c.registration,
}));
const aliases = {
  iconButton: 'button',
  toggleButton: 'button',
  number: 'input',
  search: 'input',
  dateTime: 'input',
  segmented: 'segmented-control',
  fileUpload: 'file-input',
  SideNavigation: 'side-nav',
  splitAction: 'split-button',
  SplitPanels: 'split-panel',
  alertDialog: 'dialog',
  multiselect: 'combobox',
  Accordion: 'disclosure',
  'button/sm': 'button',
  'button/lg': 'button',
  'avatar/Appearance': 'avatar',
};
const css = {
  List: 'list',
  Table: 'table',
  field: 'field',
  link: 'link',
  divider: 'divider',
  typography: 'typography',
  keyboardKey: 'kbd',
  descriptionList: 'description-list',
  timeline: 'timeline',
  stepper: 'stepper',
};
const parts = {
  ListboxOption: ['collection/option-rows.template.ts', 'optionListTemplate', 'listbox'],
  ListboxSurface: ['collection/option-rows.template.ts', 'optionListTemplate', 'listbox'],
  CheckboxOption: ['collection/option-rows.template.ts', 'optionListTemplate', 'combobox'],
  MenuItem: ['menu/menu.template.ts', 'menuTemplate', 'menu'],
  NavigationItem: ['side-nav/side-nav.template.ts', 'sideNavTemplate', 'side-nav'],
  CommandItem: [
    'command-palette/command-palette.template.ts',
    'commandPaletteTemplate',
    'command-palette',
  ],
  radio: ['form-control/radio-input.ts', 'radioInput', 'radio-group'],
  'calendar/Day': ['calendar/calendar.template.ts', 'calendarTemplate', 'calendar'],
  'oneTimeCode/Cell': [
    'one-time-code/one-time-code.template.ts',
    'oneTimeCodeTemplate',
    'one-time-code',
  ],
  'color/Swatch': ['color-picker/color-picker.template.ts', 'colorPickerTemplate', 'color-picker'],
  'rating/Item': ['rating/rating.template.ts', 'ratingTemplate', 'rating'],
  AvatarItem: ['avatar/avatar.ts', 'OddkinAvatar', 'avatar'],
  'Splitter/horizontal': [
    'split-panel/split-panel.template.ts',
    'splitPanelTemplate',
    'split-panel',
  ],
  'Splitter/vertical': ['split-panel/split-panel.template.ts', 'splitPanelTemplate', 'split-panel'],
  'multiselect/Field': ['combobox/combobox.template.ts', 'comboboxTemplate', 'combobox'],
  'multiselect/Display': ['collection/option-field.template.ts', 'valueTemplate', 'combobox'],
  'multiselect/SelectionPanel': [
    'collection/option-field.template.ts',
    'selectionTemplate',
    'combobox',
  ],
  'multiselect/SelectedItems': [
    'collection/option-field.template.ts',
    'reviewTemplate',
    'combobox',
  ],
};
const layoutHelpers = {
  Stack: 'stack',
  Row: 'row',
  Cluster: 'row',
  Grid: 'grid',
  AutoGrid: 'autoGrid',
  Split: 'split',
};
const layoutClasses = {
  Stack: 'odd-stack',
  Row: 'odd-row',
  Cluster: 'odd-cluster',
  Grid: 'odd-grid',
  AutoGrid: 'odd-auto-grid',
  Split: 'odd-split',
  Box: 'odd-box',
  Center: 'odd-center',
  AspectRatio: 'odd-aspect-ratio',
};
const checks = [];
const records = snapshot.records.map((n) => {
  const name = n.name.replace(/^Oddkin\/(Common|Layout)\//, '');
  let x = {
    id: n.id,
    page: n.page,
    figmaName: n.name,
    previousDescription: n.description,
    observedBindings: n.bindings,
    kind: 'Design specification',
    source: null,
    exportName: null,
    importPath: null,
    usage: 'No corresponding implementation verified. Do not invent an element or import.',
  };
  if (!n.name.startsWith('Oddkin/')) {
    const folder = n.name.startsWith('odd-button/')
      ? 'button'
      : n.name.startsWith('odd-input/')
        ? 'input'
        : null;
    if (folder) Object.assign(x, { kind: 'Web component specimen', componentFolder: folder });
  } else if (n.name.startsWith('Oddkin/Layout/')) {
    if (name === 'Container' || name === 'ScrollRegion')
      x.componentFolder = name === 'Container' ? 'container' : 'scroll-region';
    else if (layoutClasses[name]) {
      Object.assign(x, {
        kind: 'CSS layout recipe',
        source: 'packages/components/src/css/index.ts',
        exportName: 'layout',
        importPath: '@oddkin/components/css/layout.css',
        usage: `<div class="${layoutClasses[name]}">...</div>`,
      });
      if (layoutHelpers[name])
        x.helper = {
          source: 'packages/components/src/layout/index.ts',
          importPath: '@oddkin/components/layout',
          exportName: layoutHelpers[name],
          note:
            name === 'Cluster'
              ? 'row({wrap:true})'
              : 'Optional programmatic CSS helper; does not register an element.',
        };
    } else x.kind = 'Design specimen';
  } else if (css[name]) {
    const s = metadata.stylesheets['stylesheet:' + css[name]];
    Object.assign(x, {
      kind: 'CSS recipe',
      source: 'packages/components/src/css/index.ts',
      exportName: css[name] === 'description-list' ? 'descriptionList' : css[name],
      importPath: s.import,
      usage: s.description,
    });
  } else if (name === 'Form')
    Object.assign(x, {
      kind: 'Native composition',
      source: 'examples/forms/index.html',
      usage:
        'Use a native <form> with registered Oddkin controls, CSS layout classes, and validation summary. There is no OddkinForm element. The FormValue controller is not a Form component.',
    });
  else if (name.startsWith('multiselect/Value/'))
    parts[name] = ['collection/option-field.template.ts', 'valueTemplate', 'combobox'];
  if (parts[name] && n.name.startsWith('Oddkin/Common/')) {
    const [source, exportName, parent] = parts[name];
    Object.assign(x, {
      kind: 'Internal component part',
      source: 'packages/components/src/' + source,
      exportName,
      parent,
      importPath: '@oddkin/components/define/' + parent,
      usage: `Use <odd-${parent}> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import.`,
    });
    if (name.startsWith('multiselect/Value/'))
      x.usage += ` Set multiple and view="${name.split('/').at(-1)}".`;
    if (name === 'multiselect/SelectedItems') x.usage += ' Set multiple and view="expandable".';
    if (name === 'multiselect/SelectionPanel')
      x.usage +=
        ' Inline review uses multiple, review and select-all; Tabbed, Dual pane and Unified arrangements need author composition.';
  }
  if (!x.source && x.kind !== 'Native composition' && x.kind !== 'Internal component part') {
    const folder =
      x.componentFolder ||
      aliases[name] ||
      components.find((c) => norm(c.folder) === norm(name))?.folder;
    if (folder) x.componentFolder = folder;
  }
  if (x.componentFolder) {
    const c = components.find((c) => c.folder === x.componentFolder);
    if (!c) throw Error('Missing metadata ' + x.componentFolder);
    Object.assign(x, {
      kind:
        x.kind === 'Web component specimen'
          ? x.kind
          : name === 'Accordion'
            ? 'Web component composition'
            : 'Web component',
      source: `packages/components/src/${c.folder}/${c.folder}.ts`,
      exportName: c.name,
      importPath: c.registration,
      classImport: `@oddkin/components/${c.folder}`,
      tag: c.tag,
      usage: `import '${c.registration}';\n<${c.tag}></${c.tag}>\nOptional side-effect-free class import: import { ${c.name} } from '@oddkin/components/${c.folder}'; this class import alone does not register the tag.`,
    });
    if (name === 'Accordion')
      x.usage += ' Use several odd-disclosure elements with the same name attribute.';
    if (name === 'alertDialog') x.usage += ' Set alert on odd-dialog.';
    if (name === 'toggleButton') x.usage += ' Set toggle and pressed on odd-button.';
    if (name === 'iconButton') x.usage += ' Provide an accessible label on odd-button.';
    if (['number', 'search', 'dateTime'].includes(name))
      x.usage += ` Set type="${name === 'dateTime' ? 'datetime-local' : name}" on odd-input.`;
    if (name === 'multiselect') x.usage += ' Set multiple on odd-combobox.';
  }
  const variationNames = new Set([
    'iconButton',
    'toggleButton',
    'number',
    'search',
    'dateTime',
    'alertDialog',
    'avatar/Appearance',
    'button/sm',
    'button/lg',
  ]);
  if (variationNames.has(name) && x.kind === 'Web component') {
    x.kind = 'Web component variation';
    x.variationOf = x.tag;
    x.usage +=
      ' This Figma family is a variation/configuration of its parent element, not a separate registered tag.';
  }
  if (name === 'multiselect' && x.kind === 'Web component') {
    x.kind = 'Web component variation';
    x.variationOf = 'odd-combobox';
  }
  if (name.startsWith('multiselect/Value/') && x.kind === 'Internal component part') {
    x.kind = 'Internal component part variation';
    x.variationOf = 'odd-combobox';
  }
  const issues = [];
  if (x.source) {
    if (!fs.existsSync(new URL(x.source, root))) throw Error('Missing source ' + x.source);
    if (
      x.exportName &&
      !new RegExp(`export\\s+(?:class|const|function)\\s+${x.exportName}\\b`).test(read(x.source))
    )
      throw Error('Missing export ' + x.exportName + ' ' + x.source);
    if (x.importPath && !pkg.exports[x.importPath.replace('@oddkin/components', '.')])
      throw Error('Missing package export ' + x.importPath);
  }
  for (const b of n.bindings) {
    if (!x.source) issues.push('Connection exists for an asset without a verified implementation.');
    else if (b.source !== x.source) issues.push(`Source should be ${x.source}; saved ${b.source}.`);
    if (b.componentName && x.exportName && b.componentName !== x.exportName)
      issues.push(`Export name should be ${x.exportName}; saved ${b.componentName}.`);
    if (!b.componentName && x.exportName) issues.push(`Export name is blank; use ${x.exportName}.`);
  }
  x.issues = [...new Set(issues)];
  x.mcpInstructions = [
    `ODDKIN IMPLEMENTATION TYPE: ${x.kind}.`,
    `Figma asset: ${n.name}.`,
    x.source
      ? `Repository source: ${x.source}.`
      : 'Implementation: design-only; no verified public component.',
    x.exportName ? `Code Connect export/name: ${x.exportName}.` : null,
    x.importPath
      ? x.kind.startsWith('CSS')
        ? `CSS IMPORT: import '${x.importPath}';`
        : `REGISTRATION/PUBLIC IMPORT: import '${x.importPath}';`
      : null,
    x.usage,
    x.helper
      ? `Optional CSS helper: import { ${x.helper.exportName} } from '${x.helper.importPath}'; ${x.helper.note}`
      : null,
    x.kind.startsWith('CSS')
      ? 'This is native HTML plus a stylesheet. Do not generate a fictional Oddkin class, custom-element tag, component registration, or TypeScript component import.'
      : null,
    x.kind.startsWith('Internal component part')
      ? 'Do not import packages/components/src/... into application code; import and configure the public parent component above.'
      : null,
    'VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.',
  ]
    .filter(Boolean)
    .join('\n');
  x.updatedDescription =
    x.mcpInstructions +
    '\n\nDESIGN NOTES\n' +
    n.description
      .replace(/\s*Design proposal; not a promised custom-element API\./g, '')
      .replace(
        /\s*Existing @oddkin\/components implementation; extra visual states remain specifications\./g,
        '',
      );
  return x;
});
const report = {
  auditedAt: snapshot.auditedAt,
  fileKey: snapshot.fileKey,
  scope:
    'Primitives and Composed component families plus legacy button/input specimens; saved bindings read through reviewed and definition frames. Empty or unresolved results do not certify that a mapping is absent.',
  counts: {
    assets: records.length,
    withObservedBindings: records.filter((r) => r.observedBindings.length).length,
    withIssues: records.filter((r) => r.issues.length).length,
    kinds: records.reduce((a, r) => ((a[r.kind] = (a[r.kind] || 0) + 1), a), {}),
  },
  records,
};
fs.writeFileSync(
  new URL('artifacts/code-connect/implementation-audit.json', root),
  JSON.stringify(report, null, 2) + '\n',
);
const md = [
  '# Oddkin implementation and Code Connect audit',
  '',
  `Audit date: ${snapshot.auditedAt}. Source files and public imports were checked locally. Saved bindings are recorded separately from proposed corrections.`,
  '',
  '| Figma asset | Kind | Correct source | Correct name | Import | Findings |',
  '|---|---|---|---|---|---|',
  ...records
    .filter((r) => r.figmaName.startsWith('Oddkin/'))
    .map(
      (r) =>
        `| ${r.figmaName} | ${r.kind} | ${r.source || 'No implementation verified'} | ${r.exportName || '—'} | ${r.importPath || '—'} | ${r.issues.join(' ').replaceAll('|', '\\|') || (r.observedBindings.length ? 'Observed mapping matches source/name checks.' : 'No mapping verified in sampled selections.')} |`,
    ),
  '',
  '## MCP instruction text',
  '',
  ...records
    .filter((r) => r.figmaName.startsWith('Oddkin/'))
    .flatMap((r) => [`### ${r.figmaName}`, '', '```text', r.mcpInstructions, '```', '']),
].join('\n');
fs.writeFileSync(new URL('artifacts/code-connect/implementation-audit.md', root), md);
console.log(
  JSON.stringify(
    {
      counts: report.counts,
      issues: records
        .filter((r) => r.issues.length)
        .map((r) => ({ name: r.figmaName, issues: r.issues })),
    },
    null,
    2,
  ),
);
