import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-menu> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './menu.js';

const actions =
  'Project actions<option value="new">New project</option><option value="duplicate" title="With its files">Duplicate project</option><option value="archive" disabled>Archive</option><hr><optgroup label="Danger zone"><option value="delete">Delete project</option></optgroup>';

export default defineExamples('odd-menu', {
  default: {
    label: 'Items as children',
    previewRoles: ['menu'],
    recommended: true,
    preset: true,
    guidance:
      'Write the trigger text and the items as `<option value>` children (the value is the `id` that `odd-action` reports); `<hr>` separates, `<optgroup label>` groups.',
    fixture({ element }) {
      element.innerHTML = actions;
    },
  },
  fromData: {
    label: 'Items property with a submenu',
    props: {
      items: [
        { id: 'new', label: 'New project', shortcut: 'Ctrl N' },
        {
          id: 'share',
          label: 'Share',
          items: [
            { id: 'link', label: 'Copy link' },
            { id: 'email', label: 'Email' },
          ],
        },
        { kind: 'separator' },
        { id: 'delete', label: 'Delete project', tone: 'danger' },
      ],
    },
    preset: true,
    guidance:
      'Set `items` when the actions come from data: groups (`kind: "group"`), separators, shortcuts, icons, the danger tone, and submenus (`items` on an action).',
    fixture({ element }) {
      element.textContent = 'Project actions';
    },
  },
  glyphOnly: {
    label: 'Glyph-only trigger',
    props: { label: 'More actions', appearance: 'ghost', size: 'sm' },
    guidance: 'With no trigger text, `label` names the button.',
    fixture({ element }) {
      element.innerHTML =
        '<option value="rename">Rename</option><option value="move">Move</option><option value="delete">Delete</option>';
    },
  },
  contextMenu: {
    label: 'Context menu of an element',
    props: { context: 'menu-project-brief', label: 'More actions' },
    previewRoles: ['menu'],
    guidance:
      'Set `context` to the ID of the element whose context menu it is: a right-click or long press there opens it at the pointer, Shift+F10 or the Menu key beside the focused element. Keep the trigger visible next to the element: it is the way to the same actions for everyone who does not right-click.',
    fixture({ element, mount }) {
      element.innerHTML = actions;
      const parts = mount(
        html`<div><div id="menu-project-brief" tabindex="0">Project brief</div></div>`,
      );
      element.before(...parts.children);
      parts.remove();
    },
  },
  disabled: {
    label: 'Disabled',
    props: { disabled: true },
    fixture({ element }) {
      element.innerHTML = actions;
    },
  },
  itemsAttribute: {
    label: 'Items written as an attribute',
    attributes: { items: JSON.stringify([{ id: 'new', label: 'New project' }]) },
    incorrect: {
      explanation:
        '`items` is rich data and is read only as a property; an attribute string is ignored and the menu has no items. Write `<option>` children, or assign an array to `.items`.',
      diagnostic: 'usage.attribute.propertyOnly',
      correct: 'default',
    },
    fixture({ element }) {
      element.textContent = 'Project actions';
    },
  },
});
