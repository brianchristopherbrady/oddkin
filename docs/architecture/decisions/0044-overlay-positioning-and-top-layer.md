# 0044. Overlay positioning and the top layer

- **Status:** Proposed (draft for the M8 checkpoint; implementation in M10 with the first overlay components)
- **Date:** 2026-10-21
- **Area:** Components / Core / Platform
- **Detailed design:** [css-architecture.md](../css-architecture.md) §9 (CSS-08), §11 (motion); registry entries `popover-api`, `dialog-element`, `inert`, `anchor-positioning` (all `planned`) in [features.json](../../compatibility/features.json)
- **Related:** 0038 (compatibility policy and floor), 0039 (cascade layers), 0033 (multi-product: scope isolation for overlays), 0042 (stacking tokens), 0043 (composites that own overlays)
- **Owners if accepted:** the controller's home is decided with Agent 1 (see Open questions); overlay elements are Agent 4's lane in M10

## Context

The Figma catalog (page 158:22) defines overlay families that M10 will implement: popover, tooltip, dialog, alert dialog, drawer, menu and menu items, select, combobox, multiselect, and listbox surfaces (one shared `ListboxSurface` primitive), toast, and the command palette. None exists in code; plan §6 forbids building them before M8. css-architecture.md §9 already fixes the contract's direction: one shared positioning controller, native anchoring only when every needed subfeature is present, exactly one backend at a time, top layer instead of portals, and APG behaviour independent of positioning. This ADR turns that direction into decisions that M10 can build against and M8 can review.

Platform facts at the floor (Chrome/Edge 125, Firefox 126, Safari 17.4; `@mdn/browser-compat-data` as pinned):

| Feature | First full support | At the floor? |
| --- | --- | --- |
| `popover`, `showPopover()`, `togglePopover()`, `:popover-open`, `beforetoggle`/`ToggleEvent` | Chrome 114, Firefox 125, Safari 17 (iOS: light dismiss on outside taps only from 18.3) | Yes, with the iOS 17.0–18.2 floor exception already registered |
| `<dialog>` + `showModal()`, `inert` | Chrome 37/102, Firefox 98/112, Safari 15.4/15.5 | Yes |
| `popover="hint"` | Chrome 151, Firefox 153, Safari preview | No |
| `showPopover({ source })` | Chrome 137, Firefox 144, Safari 26 | No |
| `anchor-name` / `position-area` / `position-try-fallbacks` / `anchor-scope` | Chrome 125/129/128/131, Firefox 147, Safari 26 | No |
| `dialog closedby`, `CloseWatcher` | Chrome 134/126, Firefox 141/149, Safari preview | No |

## Decision (proposed)

1. **Top layer, never portals.** Nonmodal overlays (menus, listbox surfaces, popovers, tooltips, toasts) are `popover` elements rendered in place inside the owning component's shadow root; modal overlays (dialog, alert dialog, modal drawer) are `<dialog>` opened with `showModal()`. Elements stay where they are in the DOM, so theme, product, density, mode, profile, `dir`, and `lang` inherit as written (multi-product.md §9), and events keep their composed path. Nothing is moved to `document.body`.
2. **`popover="auto"` for light-dismiss surfaces, `popover="manual"` for tooltips and toasts.** `hint` and `showPopover({ source })` are above the floor and not used. Nested auto popovers (submenus) are DOM descendants of their parent popover, which is how the floor keeps the ancestor chain open. Because Safari iOS 17.0–18.2 does not light-dismiss on outside taps, every dismissible overlay offers an explicit close control or an Escape-equivalent action.
3. **One positioning controller, one backend at a time.** A `Scope`-owned controller computes placement from measured rectangles (`getBoundingClientRect` of anchor and surface, the visual viewport, and scroll ancestors found through the composed tree) with flip and shift fallbacks along logical sides (`block-start`, `block-end`, `inline-start`, `inline-end`, resolved through `dir` and writing mode), and writes the result through the CSSOM (`style.setProperty` on the surface), which a strict `style-src` without `'unsafe-inline'` allows. Observers (`ResizeObserver` on anchor and surface, `scroll` on each scroll ancestor, `visualViewport` resize and scroll) start on `toggle` to open and stop on close, under the overlay's `Scope`; nothing listens while closed.
4. **Native anchor positioning is a later backend, chosen at open time.** The controller switches to CSS anchor positioning only when every subfeature the contract uses is supported (`anchor-name`, `position-area`, `position-try-fallbacks`, and `anchor-scope` for repeated instances) and the anchor and surface are in the same tree scope (anchor names do not cross shadow roots). Otherwise the measured backend runs. The two never run together. Under today's floor this means the measured backend everywhere; the switch is an enhancement registered in features.json, never a requirement.
5. **Stacking.** Top-layer order is the browser's open order; Oddkin never emulates it with large `z-index` values. The `z-index` tokens (ADR 0042) order in-flow layers only.
6. **Behaviour is separate from placement.** Roles, focus movement and return, roving focus (`@oddkin/core/controllers/focus`), typeahead, dismissal, and keyboard follow the APG pattern of each component and do not depend on the backend. Focus returns to the invoker on close unless focus has deliberately moved elsewhere.
7. **Motion.** Open and close transitions use `transition-behavior: allow-discrete` and `@starting-style` only behind `@supports` (registered enhancements); without them, and with reduced motion, overlays appear and disappear instantly. No cleanup waits on `transitionend`/`animationend` (CSS-10).
8. **Verification before acceptance of the M10 components** (F09, F10): repeated instances anchored correctly with observers released; theme, product, density, direction, and language inherited in both backends; nested scroll containers, transformed ancestors, and zoom; the iOS light-dismiss exception covered by the close control; e2e in three engines and the floor probe.

## Alternatives considered

- **Portals to `document.body`** — lose scope inheritance, `dir`, `lang`, and composed event paths; need z-index management. Rejected.
- **A third-party positioning library** — no third-party runtime in shipped packages. Rejected.
- **CSS anchor positioning only** — above the floor in Firefox and Safari, and tree-scoped across shadow roots. Kept as a gated backend.
- **`popover="hint"` for tooltips, `closedby` for dialogs** — above the floor; reconsider when the floor moves (ADR 0038 re-resolution per release).

## Consequences

- The measured backend is real code with a size cost; it is measured against a budget set with the first overlay (the component budgets in `npm run size`, ADR 0031).
- Every overlay component carries a close affordance on touch platforms below iOS 18.3.
- Composites that own overlays (select, combobox, menu) depend on ADR 0043 for their option and item children.

## Open questions

- **Home of the controller.** css-architecture.md §9 says "in `@oddkin/components`"; the existing unbranded controllers (`focus`, `form`, announce) live in `@oddkin/core/controllers/*`. A DOM-measuring, unbranded controller fits `@oddkin/core/controllers/position` better, but core's size budget and ownership (Agent 1) decide. Agent 4 proposes core, behind its own subpath so non-overlay consumers pay nothing.
- Whether toasts use `popover="manual"` in a component-owned region or a live region outside the top layer is decided with the announcement design (`LiveAnnouncer`).
