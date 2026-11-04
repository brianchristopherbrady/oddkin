import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-table> into HTMLElementTagNameMap, so props are checked against the element.
import type { TableColumn, TableRow } from './table.js';

const columns: readonly TableColumn[] = [
  { key: 'name', label: 'Project', sortable: true },
  { key: 'owner', label: 'Owner', sortable: true },
  { key: 'status', label: 'Status' },
  { key: 'tasks', label: 'Open tasks', align: 'end', sortable: true },
];

const rows: readonly TableRow[] = [
  { id: 'atlas', cells: { name: 'Atlas', owner: 'Mira Chen', status: 'On track', tasks: 12 } },
  { id: 'beacon', cells: { name: 'Beacon', owner: 'Jonas Weber', status: 'At risk', tasks: 31 } },
  { id: 'cinder', cells: { name: 'Cinder', owner: 'Ada Okafor', status: 'On track', tasks: 4 } },
  { id: 'delta', cells: { name: 'Delta', owner: 'Sam Rivera', status: 'Paused', tasks: null } },
];

export default defineExamples('odd-table', {
  default: {
    label: 'Projects',
    previewRoles: ['table'],
    props: { label: 'Projects', columns, rows },
    recommended: true,
    preset: true,
    guidance:
      'Give each row an `id` and each column a `key`; a cell is found by its column key. Assign new `columns` and `rows` arrays to change them; never mutate them.',
  },
  sorted: {
    label: 'Sorted',
    props: { label: 'Projects', columns, rows, sort: 'tasks', sortDirection: 'descending' },
    preset: true,
    guidance:
      'Set `sort` and `sortDirection` to show the rows sorted; a sortable header sorts them on activation and reports `odd-sort`. Empty cells stay last.',
  },
  single: {
    label: 'One row selected',
    props: { label: 'Projects', columns, rows, selection: 'single', selected: ['beacon'] },
    preset: true,
    guidance: 'With `selection="single"`, each row has a radio; read `selected` on `change`.',
  },
  multiple: {
    label: 'Several rows selected',
    props: {
      label: 'Projects',
      columns,
      rows,
      selection: 'multiple',
      selected: ['atlas', 'cinder'],
    },
    preset: true,
    guidance:
      'With `selection="multiple"`, each row has a checkbox and the header selects every row; read `selected` on `change`.',
  },
  empty: {
    label: 'Empty',
    props: { label: 'Projects', columns, rows: [] },
    preset: true,
    guidance: 'Put your own text in the `empty` slot to say what will appear and how to add it.',
  },
  loading: {
    label: 'Loading',
    props: { label: 'Projects', columns, loading: true },
    preset: true,
  },
  error: {
    label: 'Error',
    props: { label: 'Projects', columns, error: 'The projects could not be loaded.' },
    preset: true,
    guidance:
      'Set `error` to the message; put a way to try again, such as a button, in the `error` slot.',
  },
});
