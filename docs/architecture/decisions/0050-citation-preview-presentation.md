# 0050. Citation previews: anchored by default, inline by allocation

- **Status:** Accepted. On 2026-11-10 the owner explicitly confirmed popover by default, with inline available for a dedicated details area.
- **Date:** 2026-11-10
- **Area:** Components / AI / Layout
- **Detailed contract:** [ai-interaction.md §7.6](../ai-interaction.md#76-citation-preview-presentation), [responsiveness.md](../responsiveness.md)
- **Supersedes:** [0049](./0049-agent-workflow-components.md), only the citation preview's inline-only presentation in the owner's 2026-11-09 decisions, item 3. The public citation identity, source records, event semantics, and other decisions remain.
- **Builds on:** [0044](./0044-overlay-positioning-and-top-layer.md), the existing public `odd-popover`, and the host/component ownership boundary of [0040](./0040-ai-interaction-package.md).

## Context

An inline citation marker belongs in reading flow. Its expanded source details have a different space requirement: inserting them into that flow can move a following working note or interrupt scanning. A parent may instead allocate a growing details region where that movement is intentional.

The earlier accepted decision retained an inline preview. On 2026-11-10 the owner expanded the work from an isolated behavior lab to responsive functionality in production components, including the citation behavior demonstrated in the lab. The owner then explicitly selected popover by default, with inline available for a dedicated details area. That confirms the implemented default and allocated inline option; the public `presentation` name remains the implementation's API choice.

Oddkin already has a named, non-modal anchored surface with native popover invocation, collision handling, dismissal, focus return, and inherited scopes. A citation-specific overlay runtime or a global component negotiation engine would duplicate that primitive and exceed this need.

## Decision

1. `odd-citation` adds a reflected `presentation` property and attribute with two values: `popover` (the default) and `inline`. The marker stays inline in both. `popover` composes the existing public `popoverDefinition`; `inline` puts details in the parent-allocated flow. Both are supported presentations.
2. The default marker uses native `popovertarget` invocation of a named `odd-popover`. Enter or Space opens it, Tab reaches its controls, and Escape or its explicit close control closes it. Pointer activation captures the logical marker focus, including in Safari. An outside control retains the focus the user deliberately moved there. The preview wraps long content inside the existing popover's available-space bounds.
3. The public property represents the desired presentation. While a preview is open, its effective presentation and active DOM stay stable. A property change takes effect after close; the marker stays the same node, and focus restoration happens after the presentation update when needed. Width changes adjust layout or placement and never select a different presentation or promote the interaction to a modal dialog.
4. `sourceId`, `index`, and the host-supplied `source` keep their contracts. Missing records remain explicitly unresolved. Source data updates in the current preview. Activating **Show in sources** captures the current `sourceId` and `resolved` value for `odd-citation-open`; its cancellation still vetoes the default source reveal. An uncancelled, resolved activation emits `odd-source-reveal` for that same captured identity, then closes the preview without taking focus from the revealed destination. Opening the marker itself does not become a source-navigation event.
5. The `trigger` and `preview` CSS parts remain. The composed close control uses the localized `strings.close` text. Citation code uses the popover's public definition, properties, native invocation, and supported styling surface; it does not reach into the popover's private implementation.
6. Parent purpose, capacity, and continuity remain application composition decisions. This component option is not a public adaptive context object, sibling scanner, layout coordinator, or blanket presentation policy for the rest of the catalog.

## Migration

The default expanded view changes from inline growth to an anchored popover. A directly composed citation whose parent intentionally allocates inline details should select that supported presentation explicitly:

```html
<odd-citation source-id="report" index="1" presentation="inline"></odd-citation>
```

The host still assigns its source record as a JavaScript property. The equivalent property assignment is `citation.presentation = 'inline'`.

Generated Markdown citations use the component default. This decision adds no response-wide presentation property or inherited presentation context; consumers must not invent one or reach through private shadow markup to configure generated markers. A need for a public renderer or response-level allocation option is a separate contract question.

Existing source identities, event names and details, cancellation behavior, and CSS parts continue. There is no legacy alias, compatibility mode, or silent width-based switch. The inline presentation is an intentional current option.

## Alternatives considered

- **Keep inline as the only preview.** Preserves the prior layout, but gives an ordinary reading-flow citation no supported way to avoid moving adjacent work. Retained as the explicitly allocated option.
- **Switch between inline and popover at a width threshold.** Width cannot establish the parent's purpose or consent to a presentation change. Moving an active preview can also lose focus or work.
- **Build a citation-specific overlay or global adaptive framework.** Duplicates the existing popover and broadens ownership beyond the citation. Reuse the established primitive.
- **Replace inline with popover and remove inline entirely.** A dedicated growing details region is useful and has different semantics. Keep both choices explicit.

## Consequences

The default protects surrounding document flow while using the existing overlay interaction. Allocated inline layouts require an explicit value, and the existing citation test and Figma assumptions must distinguish those two presentations. The native popover dependency affects bundle size; measure the affected response and chat entries through the normal size checks.

Source JSDoc and authored examples describe the actual property, so generated metadata and agent references derive it from the implementation. The shared responsiveness guide explains when the parent should choose it. No generated metadata is edited by hand.

## Evidence

Source inspection confirms the public option, composed dependency, deferred effective presentation, retained parts, and captured source identity in `packages/ai/src/citation/`. The authored examples include the normal source-list reveal and `inlineAllocated` with a working note.

`packages/ai/test/elements.browser.test.ts` contains regressions for unchanged neighboring layout in popover mode, deliberate inline growth, bounded long content, keyboard and native dismissal, logical marker focus, outside pointer focus, presentation changes while open, unresolved/current records, cancellation, atomic identity, and cleanup. `patterns.browser.test.ts` exercises citations with their source list. Authored tests are not passing-run evidence. Current browser results, size measurements, and remaining accessibility limits belong in [verification.md](../../verification.md); earlier inline-preview results do not establish this new default's behavior.

The isolated lab motivated the production change and remains an experiment boundary. It does not prove that every component negotiates space, that backend actions succeeded, or that the new behavior has been tested with real assistive technology.

## Revisit when

- The owner changes the preview preference or product requirements.
- A host needs a supported allocation choice for generated Markdown markers that the current public surface cannot express.
- Browser or assistive-technology evidence finds focus, reading-order, dismissal, or available-space problems that the existing primitive cannot resolve.
- Size evidence makes the dependency unacceptable, or repeated independent production needs justify a broader composition contract.
