# Change-impact demonstration

`node scripts/impact-demo.mjs --run` wrote this from a real change between two commits (IMPLEMENTATION_PLAN.md CF.2). Both revisions were built with their own build steps; this checkout's `oddkin-impact` snapshotted and compared them, and its `oddkin-kit` packaged both revisions' agent kits.

- Base: `35b6dcd2e327`, Records and notes: the 1.0.0-beta.1 cut's checks (P0.8), and the kit change in the notes
- Head: `749a34f00b91`, the base and 2 commits:
  1. `d74d1f391f9c`, Menu: name the item part after its role, menuitem
  2. `749a34f00b91`, Theme: a lighter specimen surface

Files: [change.patch](./change.patch) (the commits), [report.md](./report.md) and [report.json](./report.json) (the comparison), and [kit.diff](./kit.diff) (the agent-context change).

## The change

```text
 packages/components/src/menu/menu.template.ts | 4 ++--
 packages/components/src/menu/menu.ts          | 2 +-
 packages/tokens/themes/default.theme.json     | 2 +-
 3 files changed, 4 insertions(+), 4 deletions(-)
```

## What it affects

6 changes: 1 incompatible, 4 review, 1 informational. 4 components affected:

- `component:odd-combobox`, via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-combobox` → `component:odd-combobox`
- `component:odd-menu`, via `class:odd-menu` → `component:odd-menu`
- `component:odd-picker`, via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-picker` → `component:odd-picker`
- `component:odd-split-button`, via `class:odd-menu` → `component:odd-menu` → `definition:odd-split-button` → `component:odd-split-button`

29 checks: 29 passed, in chromium, firefox, webkit. Each check's reason path is in the report below.

Every selected check passed, and the report still marks `part:odd-menu#item` incompatible: passing checks do not make a contract change compatible.

## Change impact

6 changes (1 incompatible) · 0 products affected · 29 checks (29 passed)

### Changes

| Classification | Change | Item | Reason |
| --- | --- | --- | --- |
| review | changed | `class:odd-menu` | class changed |
| incompatible | removed | `part:odd-menu#item` | removed; possible rename to `part:odd-menu#menuitem` (unconfirmed) |
| informational | added | `part:odd-menu#menuitem` | added |
| review | changed | `template:@oddkin/components/dist/menu/menu.template.js#menuTemplate` | template changed |
| review | changed | `theme:base` | theme changed |
| review | changed | `token:color.surface.specimen` | value or definition changed |

### Checks

| State | Check | Product | Reason |
| --- | --- | --- | --- |
| passed | `example:odd-combobox/children` |  | an input on its path changed (via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-combobox` → `component:odd-combobox` → `example:odd-combobox/children`) |
| passed | `example:odd-combobox/default` |  | an input on its path changed (via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-combobox` → `component:odd-combobox` → `example:odd-combobox/default`) |
| passed | `example:odd-combobox/disabled` |  | an input on its path changed (via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-combobox` → `component:odd-combobox` → `example:odd-combobox/disabled`) |
| passed | `example:odd-combobox/grouped` |  | an input on its path changed (via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-combobox` → `component:odd-combobox` → `example:odd-combobox/grouped`) |
| passed | `example:odd-combobox/inForm` |  | an input on its path changed (via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-combobox` → `component:odd-combobox` → `example:odd-combobox/inForm`) |
| passed | `example:odd-combobox/loading` |  | an input on its path changed (via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-combobox` → `component:odd-combobox` → `example:odd-combobox/loading`) |
| passed | `example:odd-combobox/multiple` |  | an input on its path changed (via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-combobox` → `component:odd-combobox` → `example:odd-combobox/multiple`) |
| passed | `example:odd-combobox/readonly` |  | an input on its path changed (via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-combobox` → `component:odd-combobox` → `example:odd-combobox/readonly`) |
| passed | `example:odd-combobox/selectAll` |  | an input on its path changed (via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-combobox` → `component:odd-combobox` → `example:odd-combobox/selectAll`) |
| passed | `example:odd-combobox/serverFiltered` |  | an input on its path changed (via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-combobox` → `component:odd-combobox` → `example:odd-combobox/serverFiltered`) |
| passed | `example:odd-combobox/views` |  | an input on its path changed (via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-combobox` → `component:odd-combobox` → `example:odd-combobox/views`) |
| passed | `example:odd-menu/contextMenu` |  | an input on its path changed (via `class:odd-menu` → `component:odd-menu` → `example:odd-menu/contextMenu`) |
| passed | `example:odd-menu/default` |  | an input on its path changed (via `class:odd-menu` → `component:odd-menu` → `example:odd-menu/default`) |
| passed | `example:odd-menu/disabled` |  | an input on its path changed (via `class:odd-menu` → `component:odd-menu` → `example:odd-menu/disabled`) |
| passed | `example:odd-menu/fromData` |  | an input on its path changed (via `class:odd-menu` → `component:odd-menu` → `example:odd-menu/fromData`) |
| passed | `example:odd-menu/glyphOnly` |  | an input on its path changed (via `class:odd-menu` → `component:odd-menu` → `example:odd-menu/glyphOnly`) |
| passed | `example:odd-picker/default` |  | an input on its path changed (via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-picker` → `component:odd-picker` → `example:odd-picker/default`) |
| passed | `example:odd-picker/disabled` |  | an input on its path changed (via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-picker` → `component:odd-picker` → `example:odd-picker/disabled`) |
| passed | `example:odd-picker/empty` |  | an input on its path changed (via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-picker` → `component:odd-picker` → `example:odd-picker/empty`) |
| passed | `example:odd-picker/inForm` |  | an input on its path changed (via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-picker` → `component:odd-picker` → `example:odd-picker/inForm`) |
| passed | `example:odd-picker/list` |  | an input on its path changed (via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-picker` → `component:odd-picker` → `example:odd-picker/list`) |
| passed | `example:odd-picker/listMultiple` |  | an input on its path changed (via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-picker` → `component:odd-picker` → `example:odd-picker/listMultiple`) |
| passed | `example:odd-picker/loading` |  | an input on its path changed (via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-picker` → `component:odd-picker` → `example:odd-picker/loading`) |
| passed | `example:odd-picker/multiple` |  | an input on its path changed (via `token:color.surface.specimen` → `style:@oddkin/components/dist/combobox/combobox.styles.js#comboboxStyles` → `definition:odd-picker` → `component:odd-picker` → `example:odd-picker/multiple`) |
| passed | `example:odd-split-button/default` |  | an input on its path changed (via `class:odd-menu` → `component:odd-menu` → `definition:odd-split-button` → `component:odd-split-button` → `example:odd-split-button/default`) |
| passed | `example:odd-split-button/disabled` |  | an input on its path changed (via `class:odd-menu` → `component:odd-menu` → `definition:odd-split-button` → `component:odd-split-button` → `example:odd-split-button/disabled`) |
| passed | `example:odd-split-button/fromData` |  | an input on its path changed (via `class:odd-menu` → `component:odd-menu` → `definition:odd-split-button` → `component:odd-split-button` → `example:odd-split-button/fromData`) |
| passed | `example:odd-split-button/loading` |  | an input on its path changed (via `class:odd-menu` → `component:odd-menu` → `definition:odd-split-button` → `component:odd-split-button` → `example:odd-split-button/loading`) |
| passed | `example:odd-split-button/secondary` |  | an input on its path changed (via `class:odd-menu` → `component:odd-menu` → `definition:odd-split-button` → `component:odd-split-button` → `example:odd-split-button/secondary`) |

## The agent-context change

The packaged agent kits of both revisions, generated with the same `oddkin-kit`. The full diff is [kit.diff](./kit.diff).

```text
 kits/{base => head}/ai/kit.json                                  | 2 +-
 kits/{base => head}/ai/references/tokens/semantic.md             | 2 +-
 kits/{base => head}/components/kit.json                          | 4 ++--
 kits/{base => head}/components/references/components/odd-menu.md | 2 +-
 kits/{base => head}/components/references/tokens/semantic.md     | 2 +-
 5 files changed, 6 insertions(+), 6 deletions(-)
```

## Reproduce

```sh
npm install
npm run build
node scripts/impact-demo.mjs --base 35b6dcd2e327 --run
```

The same base gives the same head commits. Check results name the browsers that ran them.
