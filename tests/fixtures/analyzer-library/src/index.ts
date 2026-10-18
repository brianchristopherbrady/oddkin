import { define } from '@oddkin/core';
import { defineLayoutRecipe, row, stack } from '@oddkin/core/layout';
import { defineModel, m } from '@oddkin/core/model';
import { AcmeAlert } from './alert.js';
import { AcmePanel } from './panel.js';

export { AcmeAlert, AcmePanel };

define('acme-panel', AcmePanel);
define('acme-alert', AcmeAlert);

const suffix = 'dynamic';
define(`acme-${suffix}`, AcmePanel);

export const panelLayout = defineLayoutRecipe({
  name: 'panel',
  container: { name: 'panel' },
  regions: { root: stack(), actions: row({ justify: 'end' }) },
  variants: { tone: { info: { actions: row({ justify: 'start' }) } } },
  when: { '@container panel (min-width: 30rem)': { actions: row({ justify: 'space-between' }) } },
  parts: ['actions'],
});

export const MessageModel = defineModel('acme.message', {
  version: 1,
  schema: m.union('kind', {
    text: m.object({ id: m.id(), body: m.label() }),
    link: m.object({ id: m.id(), label: m.label(), href: m.url() }),
  }),
});
