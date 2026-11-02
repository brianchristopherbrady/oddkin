/**
 * Theme Studio's starter screens for `@oddkin/components`: composition documents a team edits or
 * replaces with one an agent wrote. Each passes `validateComposition` (node-theme-studio.test.ts).
 */
import type { JsonObject } from './types.js';

const document = (root: readonly JsonObject[]): JsonObject => ({
  $schema: 'https://oddkin.dev/schemas/composition/composition.v1.json',
  version: 1,
  root,
});

const button = (slot: string, appearance: string, text: string, action: string): JsonObject => ({
  element: 'odd-button',
  slot,
  attributes: { appearance },
  children: [text],
  actions: { click: action },
});

export const STARTERS: readonly {
  readonly id: string;
  readonly title: string;
  readonly document: JsonObject;
}[] = [
  {
    id: 'report-card',
    title: 'Report card',
    document: document([
      {
        element: 'odd-card',
        attributes: { label: 'Quarterly report' },
        children: [
          { element: 'h2', slot: 'header', children: ['Quarterly report'] },
          { element: 'odd-badge', attributes: { tone: 'success' }, children: ['On track'] },
          {
            element: 'odd-stat',
            attributes: { label: 'Revenue', value: '$1.24M', trend: 'increase' },
            children: ['+8.2% from last quarter'],
          },
          {
            element: 'odd-stat',
            attributes: { label: 'Churn', value: '2.1%', trend: 'decrease' },
            children: ['-0.4 points'],
          },
          {
            element: 'odd-progress',
            attributes: { label: 'Annual target', value: 72, max: 100 },
          },
          {
            element: 'odd-alert',
            attributes: { tone: 'warning' },
            children: ['Two invoices are overdue.'],
          },
          button('footer', 'secondary', 'Download PDF', 'report.download'),
        ],
      },
    ]),
  },
  {
    id: 'settings-form',
    title: 'Settings form',
    document: document([
      {
        element: 'odd-card',
        attributes: { label: 'Notification settings' },
        children: [
          { element: 'h2', slot: 'header', children: ['Notification settings'] },
          { element: 'p', children: ['Choose how we reach you.'] },
          {
            element: 'odd-input',
            id: 'email',
            attributes: {
              name: 'email',
              type: 'email',
              label: 'Email',
              autocomplete: 'email',
              required: true,
              value: 'ada@example.com',
            },
          },
          {
            element: 'odd-switch',
            id: 'digest',
            attributes: { name: 'digest', checked: true },
            children: ['Weekly digest'],
          },
          {
            element: 'odd-checkbox',
            id: 'mentions',
            attributes: { name: 'mentions' },
            children: ['Only when I am mentioned'],
          },
          {
            element: 'odd-textarea',
            id: 'signature',
            attributes: { name: 'signature', label: 'Email signature', rows: 3 },
          },
          button('footer', 'ghost', 'Cancel', 'settings.cancel'),
          button('footer', 'primary', 'Save', 'settings.save'),
        ],
      },
    ]),
  },
  {
    id: 'sign-in-dialog',
    title: 'Sign-in dialog',
    document: document([
      {
        element: 'odd-dialog',
        attributes: { label: 'Sign in', open: true },
        children: [
          { element: 'h2', slot: 'header', children: ['Sign in'] },
          { element: 'p', children: ['Use your work email.'] },
          {
            element: 'odd-input',
            id: 'email',
            attributes: {
              name: 'email',
              type: 'email',
              label: 'Email',
              autocomplete: 'email',
              required: true,
            },
          },
          {
            element: 'odd-input',
            id: 'password',
            attributes: {
              name: 'password',
              type: 'password',
              label: 'Password',
              autocomplete: 'current-password',
              required: true,
            },
          },
          {
            element: 'odd-checkbox',
            id: 'remember',
            attributes: { name: 'remember' },
            children: ['Keep me signed in'],
          },
          button('footer', 'ghost', 'Cancel', 'signIn.cancel'),
          button('footer', 'primary', 'Sign in', 'signIn.submit'),
        ],
      },
    ]),
  },
];
