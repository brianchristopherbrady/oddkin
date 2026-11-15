/**
 * The context picker's records (`odd-context-picker`). They live apart from `models.ts` so bundles
 * without the picker do not carry them. Contract: docs/architecture/ai-interaction.md §3.
 */
import { defineModel, m } from '@oddkin/core/model';
import { publicErrorSchema } from './models.js';

/** Where context comes from (a drive, a wiki, a CRM), as the host has connected it. */
export const ContextSourceModel = defineModel('oddkin.ai.context-source', {
  version: 1,
  schema: m.object({
    id: m.id(),
    label: m.label(),
    description: m.optional(
      m.string({ description: 'Shown beside the label when browsing sources.' }),
    ),
    browse: m.optional(m.boolean('Whether the host can list what is inside it (Browse).')),
  }),
});

const contextResourceSchema = m.object(
  {
    sourceId: m.id(),
    id: m.id(),
    label: m.string({ minLength: 1, description: 'Untrusted; rendered as text.' }),
    type: m.string({
      minLength: 1,
      description: 'What it is, in the host’s words: document, page, account.',
    }),
    kind: m.optional(
      m.string({ minLength: 1, description: 'A stable key for its icon (the picker’s `icons`).' }),
    ),
    path: m.optional(m.string({ description: 'Where it is, e.g. "Product / Launch".' })),
    description: m.optional(m.string({ description: 'Useful metadata, e.g. "2h ago".' })),
    unavailable: m.optional(
      m.string({ description: 'Why it cannot be used now; absent when it can.' }),
    ),
    container: m.optional(
      m.boolean('Opens to show what is inside it when activated; it is not chosen itself.'),
    ),
  },
  'A resource a person can add as context. Identity is `sourceId` with `id`.',
);

export const ContextResourceModel = defineModel('oddkin.ai.context-resource', {
  version: 1,
  schema: contextResourceSchema,
});

/** The host's answer to one `odd-context-query`. */
export const ContextResultsModel = defineModel('oddkin.ai.context-results', {
  version: 1,
  schema: m.object({
    requestId: m.id(),
    items: m.array(contextResourceSchema),
    sources: m.optional(
      m.array(
        m.object({
          sourceId: m.id(),
          status: m.enum(['complete', 'failed']),
          error: m.optional(publicErrorSchema),
        }),
        { description: 'Each searched source; a failed source is never shown as no matches.' },
      ),
    ),
    total: m.optional(
      m.number({ integer: true, minimum: 0, description: 'All matches, if the host knows.' }),
    ),
    nextCursor: m.optional(
      m.string({ description: 'Give it back in `cursor` to ask for the next page.' }),
    ),
  }),
});
