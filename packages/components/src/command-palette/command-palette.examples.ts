import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-command-palette> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './command-palette.js';

const commands = [
  { id: 'new-project', label: 'New project', shortcut: 'Ctrl N', group: 'Commands' },
  { id: 'invite', label: 'Invite people', group: 'Commands' },
  { id: 'theme', label: 'Switch theme', description: 'Light or dark', group: 'Commands' },
  { id: 'atlas', label: 'Atlas', description: 'Project', group: 'Projects' },
  {
    id: 'beacon',
    label: 'Beacon',
    description: 'Project, archived',
    group: 'Projects',
    disabled: true,
  },
];

export default defineExamples('odd-command-palette', {
  default: {
    label: 'Commands and projects',
    previewRoles: ['commandPalette'],
    props: {
      label: 'Command palette',
      placeholder: 'Search commands and projects…',
      items: commands,
    },
    recommended: true,
    preset: true,
    guidance:
      'Open it from a button and from Ctrl+K or Cmd+K. Listen to `odd-action` and run the command with `detail.id`; the palette closes by itself.',
    fixture({ scope, element, mount }) {
      const open = mount(html`<odd-button>Search commands</odd-button>`) as HTMLElement;
      scope.listen(open, 'click', () => element.show());
      scope.listen(document, 'keydown', (event) => {
        const key = event as KeyboardEvent;
        if (key.key.toLowerCase() !== 'k' || !(key.ctrlKey || key.metaKey)) return;
        key.preventDefault();
        element.show();
      });
    },
  },
  open: {
    label: 'Open',
    props: { label: 'Command palette', items: commands, open: true },
    preset: true,
  },
  serverSearch: {
    label: 'Searched by the page',
    props: { label: 'Search projects', noFilter: true, open: true, items: [] },
    guidance:
      'With `no-filter`, listen to `odd-query-change` and replace `items` with the results (set `loading` while they load).',
    fixture({ scope, element }) {
      const projects = ['Atlas', 'Beacon', 'Cobalt', 'Delta'];
      scope.listen(element, 'odd-query-change', (event) => {
        const query = (event as CustomEvent<{ query: string }>).detail.query.toLowerCase();
        element.items = projects
          .filter((name) => name.toLowerCase().startsWith(query))
          .map((name) => ({ id: name.toLowerCase(), label: name }));
      });
    },
  },
  loading: {
    label: 'Loading',
    props: { label: 'Command palette', loading: true, open: true, items: [] },
  },
  itemsAttribute: {
    label: 'Commands written as an attribute',
    attributes: {
      label: 'Command palette',
      open: '',
      items: JSON.stringify([{ id: 'new', label: 'New project' }]),
    },
    incorrect: {
      explanation:
        '`items` is rich data and is read only as a property; an attribute string is ignored and the palette shows its empty state. Assign an array to `.items`.',
      diagnostic: 'usage.attribute.propertyOnly',
      correct: 'open',
    },
  },
});
