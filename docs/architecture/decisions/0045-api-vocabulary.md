# 0045. API vocabulary for elements

- **Status:** Proposed (2026-10-22). Owner approval required before any new component is built (plan §6, owner decision of 2026-10-22).
- **Date:** 2026-10-22
- **Area:** Components / AI / Metadata
- **Detailed contract:** this ADR (§3 vocabulary, §5 events); enforced by `npm run verify:metadata` once accepted
- **Related:** 0003 (property definitions), 0036 (composition API), 0037 (naming contract: element events use `odd-`), 0040 (AI package), 0043 (composites), 0044 (overlays)
- **Owners:** Agent 1 (this ADR and the check); Agent 4 (component APIs and the renames)

## Context

The 28 published elements (4 in `@oddkin/components`, 24 in `@oddkin/ai`) name the same concepts differently:

| Concept | Names in use (2026-10-22, from the generated manifests) |
| --- | --- |
| Visual treatment | `appearance` (`odd-button`), `variant` (`odd-card`); [data-composition.md](../data-composition.md) documents `variant` |
| Custom events | `odd-action`, `odd-toggle` (`odd-side-nav`); 32 unprefixed names (`prompt-submit`, `approval-decide`, …) and 2 `ai-` names (`ai-announce`, `ai-reveal-source`) in `@oddkin/ai`, although ADR 0037 gives element events the `odd-` prefix |
| Action in progress | `loading` (`odd-button`), `busy` (`odd-prompt-input`) |
| Announcements | `announce` boolean (5 elements), `announcements` enum (`odd-conversation`) |
| Name | `label` (8 elements), `heading` (`odd-sources`) |
| Lifecycle values | `ready` (`odd-inline-assist`) and `complete` (`odd-response`) for the same outcome |
| Same name, two meanings | `source`: a citation record (`odd-citation`) and the conversation's state owner (`odd-conversation`); `current`: an item id (`odd-side-nav`) and a rendered snapshot (`odd-conversation`) |
| Renderer hooks | `renderLabel`, `renderOutput` (functions) next to `toolRenderer` (a function) and `renderers` (a map) |

The plan adds more than 40 components (component-catalog.md). Each inconsistency costs every user a lookup and teaches people and AI agents a wrong guess for the next element. The packages are unpublished and pre-1.0, so renaming now has no consumer cost; after the catalog lands it would be a breaking change for every component.

## Decision

### 1. One name, one meaning, one type

A name keeps one meaning and one type across `@oddkin/components` and `@oddkin/ai`. The only exception is `error` (§3). New concepts are added to the vocabulary in the commit that introduces them, with a reason.

### 2. Native first

Where HTML has the concept, use its name, type, and behavior: `disabled`, `readonly`, `required`, `name`, `value` (the attribute is the default value, as on `<input>`), `checked`, `indeterminate`, `selected`, `multiple`, `open`, `placeholder`, `autocomplete`, `type`, `min`, `max`, `step`, `minlength`, `maxlength`, `pattern`, `form*` on submit buttons; methods `checkValidity()`, `reportValidity()`, `setCustomValidity()`, `focus()`, `blur()`; overlays use `open` with `show()` and `close(returnValue?)` (the `<dialog>` names).

One documented exception: `odd-button`'s `type` defaults to `button`, not `submit`, so a styled button never submits a form by accident. Submitting is always written (`type="submit"`). Web Awesome makes the same choice; Material Web keeps `submit`.

### 3. Vocabulary

| Concept | Name | Type and values | Replaces (reported by the check) |
| --- | --- | --- | --- |
| Visual treatment | `appearance` | Per family. Actions: `primary \| secondary \| ghost` (Figma `Appearance`). Surfaces: `outlined \| filled \| elevated`. Fields: `outlined \| filled` (reserved; none today) | `variant`, `kind`, `treatment`, `outline` |
| Meaning colour | `tone` | `neutral \| info \| success \| warning \| danger`, default `neutral`. Buttons accept `danger` only (destructive actions) | `variant` (colour sense), `color`, `intent`, `severity` |
| Size | `size` | `sm \| md \| lg` (subset per element), default `md` | `small`/`medium`/`large`, `s`/`m`/`l` |
| Inner spacing | `padding` | `none \| sm \| md \| lg` | — |
| Name | `label` | string; the accessible name, shown where the design shows one (field label, card or region heading, dialog title) | `heading`, `title` (as a component attribute), `caption` |
| Help text | `description` | string; the accessible description | `hint`, `help-text`, `supporting-text` |
| Error | `error` | Form controls: string; non-empty sets a custom validity error and shows the message. Data-driven elements: an error record property `{ code, message, retryable? }` | `error-text`, `error-message`, `validation-message`, an `invalid` attribute |
| Action in progress | `loading` | boolean | `busy`, `pending` |
| Lifecycle of a record or operation | `status` | `idle \| pending \| streaming \| complete \| failed \| cancelled \| interrupted` (subset per element) | the value `ready` (→ `complete`) |
| The element's own open state | `open` | boolean, reflected | `opened`, `visible`, `show`, `expanded` (for the element itself) |
| Items' open state | `expanded` | property: ids of open items | — |
| Current item | `current` | string id; the item gets `aria-current` | `active`, `activeId` |
| Value | `value` | string; a `string[]` property when `multiple` is set | `selectedId`, `selectedValue` |
| Checked | `checked`, `indeterminate` | boolean | `on`, `state`, `mixed` |
| Orientation | `orientation` | `horizontal \| vertical` | `direction`, `vertical` (boolean) |
| Announcements | `announce` | `none \| important \| all` | `announcements`, the boolean form |
| Built-in text | `strings` | partial record of localized strings | `labels`, `messages`, `i18n` |
| Feature switches (AI) | `capabilities` | record | — |
| State owner | `controller` (an Oddkin controller) or `store` (a controller or an `ExternalSource`) | property | `source` for a state owner |
| Rendered snapshot | `snapshot` | read-only property | `current` for a snapshot |
| Renderer hooks | `render<Thing>` (one function), `renderers` or `<thing>Renderers` (a map keyed by kind) | property | `<thing>Renderer` |

### 4. Slots

`start` and `end` hold inline adornments (logical, so they follow `dir`). `header` and `footer` hold block regions. The default slot holds the main content or label. Other slots are named by role (`composer`, `empty`, `status`); a slot inside a region is `<region>-start` or `<region>-end` (`toolbar-start`). Replaced: `prefix`, `suffix`, `leading`, `trailing`, `before`, `after`.

### 5. Events

1. **Native names where the meaning matches:** `input` and `change` (user edits of a value), `toggle` and `beforetoggle` (an element's own open state), `close` and `cancel` (dialogs), `invalid`. The host re-dispatches one only when the native event does not leave the shadow root (`change`, `toggle`, `close`, `cancel` are not composed), exactly once, and never for a programmatic change.
2. **Every other event is `odd-` + kebab-case** (ADR 0037). Use a shared intent name when it fits: `odd-action` (run an item's action), `odd-toggle` (an item's open state, cancelable), `odd-select` (choose an item). Otherwise `odd-<subject>-<verb>`, present tense, with the record or concept as the subject: `odd-prompt-submit`, `odd-approval-decide`, `odd-artifact-revision-change`.
3. Custom events have `bubbles: true` and `composed: true`.
4. `detail` is a plain object of ids (`<record>Id`), revisions, and values: never DOM nodes, live records, or functions.
5. `cancelable: true` only when `preventDefault()` vetoes a local default (keep the draft, keep the previous model, skip the download, keep a group closed). Requests to the host are not cancelable.
6. Every event declares `intent` (`'user'` or `'notification'`), as the core/events contract defines.
7. Prefixed events are added to `GlobalEventHandlersEventMap`, so `document.addEventListener('odd-prompt-submit', …)` is typed. Unprefixed custom names could not be added safely.

### 6. Attributes, properties, reflection

- Scalars have kebab-case attributes; records, arrays, functions, and controllers are property-only (ADR 0003, unchanged).
- Booleans use presence and default to `false`. A feature that is on by default is turned off with `no-<feature>`.
- An invalid enumerated value reports `element.attribute.invalid` with the allowed values and falls back to the default (unchanged).
- Reflection stays opt-in. `open` reflects (native parity); attributes documented as styling hooks may reflect. Runtime states are custom states (`:state(user-invalid)`), not reflected attributes.

### 7. Form-associated elements

`static formAssociated` with `ElementInternals`; `name`, `value` (attribute = default value), `disabled` (including a disabled `<fieldset>`), `required`, `readonly`; read-only `form`, `validity`, `validationMessage`, `willValidate`; `checkValidity()`, `reportValidity()`, `setCustomValidity()`; reset restores the default value; `formStateRestoreCallback` restores state; `input` and `change` only for user edits; `:state(user-invalid)` after interaction or a submit attempt. `odd-input` meets this today except `setCustomValidity()`.

### 8. Enforcement

On acceptance, a vocabulary file and a check in `scripts/verify-metadata.mjs` (run by `npm run verify:metadata` and CI) report, as errors, for every published element:

| Code | Finding |
| --- | --- |
| `vocabulary.synonym` | A replaced name (§3, §4) is used; the message names the canonical one |
| `vocabulary.values` | A controlled name has a value outside its set |
| `vocabulary.type` | A name has a different type than the vocabulary gives it |
| `vocabulary.event.name` | A custom event without the `odd-` prefix, or a native name with different semantics |
| `vocabulary.event.shape` | A custom event that does not bubble or is not composed |
| `vocabulary.boolean.default` | A boolean that defaults to `true` |

Element-specific names that are not synonyms pass (`items`, `enter-behavior`, `insert-only`).

### 9. Renames in the existing elements

No compatibility aliases: the packages are unpublished.

| Element | Now | After |
| --- | --- | --- |
| `odd-card` | `variant` | `appearance` (same values) |
| `odd-sources` | `heading` | `label` |
| `odd-prompt-input` | `busy` | `loading` |
| `odd-conversation` | `announcements` | `announce` (same values, default `important`) |
| `odd-action-approval`, `odd-change-review`, `odd-checkpoint`, `odd-question`, `odd-response-feedback` | `announce` (boolean, default off) | `announce` (`none` default; `important` replaces the bare attribute) |
| `odd-inline-assist` | `status` value `ready` | `complete` |
| `odd-conversation` | `source`, `current` | `store`, `snapshot` |
| `odd-conversation`, `odd-message` | `toolRenderer` | `renderTool` |
| All of `@oddkin/ai` | 32 unprefixed events | `odd-` + the same name (`odd-prompt-submit`, …) |
| All of `@oddkin/ai` | `ai-announce`, `ai-reveal-source` | `odd-announce`, `odd-source-reveal` |
| `odd-input` | — | add `setCustomValidity()` (§7) |
| data-composition.md | `variant` as the named visual option | `appearance` |

Unchanged: `odd-button` (`appearance`, `size`, `loading`, `type`), `odd-input` (`label`, `description`, `error`, native events), `odd-side-nav` (`label`, `current`, `expanded`, `odd-action`, `odd-toggle`).

### 10. Owner decisions in this ADR

1. Button treatment keeps Figma's `appearance="primary | secondary | ghost"` (recommended) rather than splitting it into `appearance` (`filled | outlined | plain`) plus `tone`; the split makes the most common case two attributes.
2. `odd-button` defaults to `type="button"` (recommended, §2) rather than the native `submit`.
3. All custom events take the `odd-` prefix (recommended, §5) rather than keeping `@oddkin/ai`'s unprefixed names.
4. One `announce` enum everywhere (recommended) rather than a boolean on leaf elements and an enum on the conversation.

## Alternatives considered

- **`variant` for the visual treatment** (today's `odd-card`, data-composition.md). Web Awesome, Shoelace, and Spectrum use `variant` for meaning or colour (`danger`, `negative`), so people and agents who know them would write `variant="danger"` and get nothing.
- **`variant` for meaning colour** (Web Awesome, Shoelace). `tone` states what it controls; `status` is already the lifecycle name.
- **One element per treatment** (Material Web's `md-filled-button`, `md-outlined-button`, …). Multiplies tags, definitions, metadata, and registrations.
- **Web Awesome's five sizes (`xs` … `xl`)**. Figma defines `sm`, `md`, `lg`; add steps only when they are designed.
- **Unprefixed custom events typed per element** (core-contracts typed listeners). Native already uses `close`, `toggle`, `select`, and `change`; other libraries and future platform events can collide; unprefixed names cannot go into the global event map.

## Consequences

- Agent 4 renames §9 with examples, demos, tests, docs, and metadata; Agent 1 adds the vocabulary file and the check, then updates data-composition.md, ai-interaction.md §6.1, and the core/events contract text. Agent kits, Workbench, and the docs app pick the names up from metadata.
- Agent 2 adds an `info` tone role (today's roles have success, warning, and danger, no info).
- React 19 handlers become `onodd-prompt-submit`, Vue `@odd-prompt-submit`; the framework fixtures are updated with the renames.
- A component that needs a concept outside §3 adds it to the vocabulary in the same commit; the check then covers it everywhere.

## Evidence

Observed 2026-10-22:

- Web Awesome 3.14.0 ([button](https://webawesome.com/docs/components/button), [input](https://webawesome.com/docs/components/input), [dialog](https://webawesome.com/docs/components/dialog)): `variant` is the meaning colour (`neutral | brand | success | warning | danger`), `appearance` the treatment (`accent | filled | outlined | filled-outlined | plain`), `size` `xs | s | m | l | xl` (plus `small | medium | large`), `loading`, `label` and `hint`, `open`, `light-dismiss`; native `input`, `change`, `blur`, `focus`; custom events prefixed (`wa-invalid`, `wa-clear`, `wa-show`, `wa-hide`, `wa-after-show`); button `type` defaults to `button` ("opposite of how native `<button>` elements behave").
- [Shoelace button](https://shoelace.style/components/button) (sunset in favour of Web Awesome): `variant` `default | primary | success | neutral | warning | danger | text`, `outline` boolean, `size` `small | medium | large`, `loading`; events `sl-blur`, `sl-focus`, `sl-invalid`.
- [Spectrum Web Components button](https://opensource.adobe.com/spectrum-web-components/components/button/) 1.12.5: `variant` `accent | primary | secondary | negative`, `treatment` `fill | outline`, `size` `s | m | l | xl`, `pending`; link attributes on `sp-button` deprecated in favour of a native `<a>`.
- Material Web ([button](https://material-web.dev/components/button/), [text field](https://material-web.dev/components/text-field/), [dialog](https://material-web.dev/components/dialog/)): one element per treatment; `type` defaults to `submit`; text fields use `label`, `supporting-text`, `error` + `error-text`, native `input`, `change`, `select`; dialog events `open`, `opened`, `close`, `closed`, `cancel`, unprefixed.
- Figma file `E7LfRysny8V3qU24tv082i`, page 158:22 (`get_metadata`, read-only): variant properties `Appearance` (`primary | secondary | ghost`), `Size` (`sm | md | lg`), checkbox `Selection` (`Unchecked | Checked | Mixed`), switch `Value` (`Off | On`), badge states `Neutral | Success | Warning | Danger | Count | Selected`; most other families use a catch-all `State` property for specimens.
- Oddkin's own manifests (`packages/*/custom-elements.json`, built from the current sources): the inventory in Context.

Pending: the agent evaluation (research/agent-eval) runs after the renames and measures first-try correctness against this vocabulary.

## Revisit when

- The agent evaluation shows a name agents get wrong repeatedly.
- A new component needs a concept the vocabulary does not cover.
- The platform adds a native equivalent of a concept named here.
