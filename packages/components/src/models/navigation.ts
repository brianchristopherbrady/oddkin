/**
 * The navigation item model: the single source for the `NavigationItem` type, runtime
 * validation of external data, migrations, and the published JSON Schema.
 * Contract: docs/architecture/data-composition.md §2, §5.
 */
import { defineModel, m, type Infer } from '@oddkin/core/model';

export const NavigationItemModel = defineModel('oddkin.navigation', {
  version: 1,
  description: 'Entries of a side navigation: links, actions, and groups of entries.',
  schema: m.array(
    m.recursive(
      (self) =>
        m.union('kind', {
          link: m.object({
            id: m.id(),
            label: m.label(),
            href: m.url(),
            target: m.optional(m.enum(['_blank', '_self'])),
            rel: m.optional(m.string()),
            disabled: m.optional(m.boolean()),
            badge: m.optional(m.string()),
          }),
          action: m.object({
            id: m.id(),
            label: m.label(),
            action: m.actionRef(),
            disabled: m.optional(m.boolean()),
          }),
          group: m.object({
            id: m.id(),
            label: m.label(),
            items: m.array(self),
            expanded: m.optional(m.boolean()),
          }),
        }),
      'NavigationItem',
    ),
  ),
  rules: [m.uniqueIds('id')],
  migrations: {
    // Version 0 used `title` for labels and `children` for group entries.
    1: (data) => fromVersion0(data),
  },
});

/** Every entry of a navigation, in order. */
export type Navigation = Infer<typeof NavigationItemModel>;
/** One link, action, or group. */
export type NavigationItem = Navigation[number];

function fromVersion0(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(fromVersion0);
  if (!data || typeof data !== 'object') return data;
  const { title, children, ...rest } = data as Record<string, unknown>;
  const out: Record<string, unknown> = { ...rest };
  if (title !== undefined && out['label'] === undefined) out['label'] = title;
  if (children !== undefined && out['items'] === undefined) out['items'] = fromVersion0(children);
  else if (Array.isArray(out['items'])) out['items'] = fromVersion0(out['items']);
  return out;
}
