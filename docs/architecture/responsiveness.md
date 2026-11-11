# Responsiveness: a contract between content and its parent

Responsiveness preserves the meaning and usability of an interaction as its available space changes. The component adapts inside the space its parent supplies; the application decides why that region exists and which product flows are appropriate there.

[Open the Responsiveness behavior lab](https://oddkin.dev/foundations/responsive). Its examples exercise real public elements. App responses supplied by example fixtures are simulations, and a rendered example is not proof that every interaction works.

This guide is authored once here. The build copies it to `RESPONSIVENESS.md` in both component packages and includes it in their generated agent kits. Those copies are generated outputs. The rules below describe component implementation and host composition; they do not introduce a public context object, layout coordinator, or automatic presentation engine.

## Start with ownership

| Owner | Responsibility | Must preserve |
| --- | --- | --- |
| Component implementation | Arrange its own content, controls, and supported states using its documented public contract. Prefer intrinsic CSS layout; use container queries for a meaningful arrangement change. | Labels, status, essential information, keyboard behavior, focus visibility, and access to each available action. |
| Parent composition | Supply the available inline and block space, decide whether the region grows or scrolls, and arrange siblings in a useful reading and action order. | The surrounding task, reading order, and room for content and actions after an update. |
| Host application | Own records, async outcomes, permissions, navigation, and product choices such as opening a separate detail view. | Record identity, user work, authorization boundaries, and the distinction between a request and its outcome. |

Use a component's actual public properties, slots, parts, events, and methods. A host must not inspect private shadow markup or scan siblings to infer their purpose. A component must not take ownership of the parent or rearrange unrelated siblings.

## Give the parent a purpose, capacity, and continuity rule

These are composition decisions, not attributes to invent on an Oddkin element.

| Decision | Questions the host answers | Practical consequence |
| --- | --- | --- |
| Purpose | Is this region for reading, choosing, editing, reviewing, or monitoring work? Which information and action are essential here? | Select an existing component or composition whose semantics fit that task. Width alone does not choose the interaction. |
| Capacity | How much space is actually available after padding, borders, and siblings? Can this region grow? If height is bounded, who owns scrolling? | Test the real containing region. A component can be narrow inside a wide window. Reserve a useful bounded region or let content increase its height. |
| Continuity | What must remain stable when space or presentation changes? | Preserve the current record, draft, selection, expanded content, and focus where appropriate. Restore focus deliberately when a user closes or finishes an interaction. |

The behavior lab calls its private host scenarios **Flow** and **Bounded**. Flow lets content grow in the document. Bounded reserves a region and keeps its content reachable. These labels are not a component API, a portable composition-schema field, or a promise that every component supports every arrangement.

## Use existing layout and interaction primitives

- Native semantic elements with `.odd-stack`, `.odd-cluster`, or `.odd-split` from `@oddkin/components/css/layout.css` arrange page content. Use them when a wrapper only arranges children.
- `odd-container` supplies a readable measure and an inline-size query boundary. It does not assign a product purpose, negotiate sibling space, add spacing, or provide scrolling.
- `odd-scroll-region` supplies a deliberate scrolling area. Give a bounded region a useful size and an accessible name where its contract requires one; keep focus and important actions reachable.
- `odd-disclosure` progressively reveals optional supporting detail. Required choices, failures, and information needed to judge a decision must remain discoverable and understandable before acting.
- `odd-popover`, `odd-dialog`, and other overlays retain their own documented semantics, focus, dismissal, and placement behavior. Use their public contracts rather than building a second overlay system.

Use intrinsic wrapping, shrinking tracks such as `minmax(0, 1fr)`, and a shrinkable flex or grid child where appropriate. Apply these rules to the region that owns the layout. A public part is a supported styling surface, not permission to depend on its private descendants.

`odd-citation` has one explicit presentation choice: `presentation="popover"` is the default anchored source preview; `presentation="inline"` is for a parent-allocated growing details region. The marker stays in reading flow in both. A property change while the preview is open waits until close before its effective presentation changes, preserving the active interaction and logical marker focus. Width never changes the selected mode. This is a component-specific public option; parent purpose, capacity, and continuity remain private composition decisions. Generated Markdown markers use the component default; there is no response-wide inherited presentation setting.

## Preserve meaning while changing arrangement

| Situation | Appropriate adaptation | Meaning that must survive |
| --- | --- | --- |
| Status and a recovery action | Keep the indicator, readable status, and associated action together. Let text wrap and move the action onto another line when needed. | What is happening, whether work is waiting or terminal, and what the action requests. |
| Approval, question, or change review | Stack the existing fields and actions. Keep the proposal, scope, required inputs, failure, and recorded outcome understandable. | Approving is authorization, submitting is a request, and neither means execution succeeded. |
| Toolbar | Wrap when its contract permits it. A host may deliberately put secondary actions in an existing, named menu as a separate composition. | Action names, keyboard access, and the task's essential action. A narrow width does not silently remove functionality. |
| Form control with a preferred measure | Keep the preferred width when room is available, and let the control's own box and internal tracks shrink to the granted width. Correct an unintended intrinsic minimum in the component implementation. | The native editing control, character positions where present, labels, value, focus, and keyboard behavior. |
| Citation or supporting detail | Keep the reference connected to its source. Use the citation's default anchored popover, explicitly select inline details for an allocated growing region, or provide a deliberate host-owned detail destination. | Source identity, the way back, a useful reading width, and focus continuity. An open citation applies a new presentation only after close. |
| Editor or form in a bounded region | Allocate usable height and one intentional scroll owner. Keep labels, errors, focused controls, and the final action reachable. | The draft and validation state. Resizing does not submit, clear, or recreate the work. |
| Data that needs two dimensions | A locally bounded scrolling table or code region can be justified. Label it where needed and verify keyboard access. | Rows, columns, and code remain understandable. This exception does not justify horizontal page overflow. |

Do not use transforms or automatic font reduction to make a screenshot fit. Do not hide an essential action or truncate a decision's meaning to satisfy a width measurement. If content cannot fit usefully, let the owner grow, provide intentional scrolling, or offer a deliberate product flow with an explicit way back.

## Density is separate from space

`data-odd-density` is a theme scope for spacing and control sizing. It does not change font size, reduce targets below their documented minimum, or decide whether an interaction becomes modal. User text-size preferences remain effective.

A narrow container normally changes arrangement. A compact density is an explicit choice, not a universal response to a narrow viewport. Test the chosen density with long labels, large text, localization, and every important state.

## Minimum useful space is contextual

There is no universal minimum width for all Oddkin components. Required space depends on content, state, text size, density, surrounding controls, and the component's current implementation. Record a tested minimum or a limitation for a specific composition and configuration; do not turn a successful specimen width into a global guarantee.

First check the component's own sizing. A preferred width is not an unavoidable minimum. A combobox box or a one-time-code control's internal layout should use the space actually available while keeping its intended wider measure when it fits. A one-time-code control retains its native input and visual character positions as it adapts. Fix unintended intrinsic minima and verify the default configuration; density remains an independent public choice.

When a region is too small, use a deterministic fallback owned by the parent: wrap or stack, grow, provide a useful bounded scroll region, or offer a different explicit host flow. Preserve labels and actions at each step. A component that clips or overflows its documented supported arrangement is an implementation finding; a host that grants no usable capacity is a composition finding. Both may need work.

## Overlays require an interaction decision

Opening a menu, preview, dialog, or drawer is a deliberate interaction with that component's own behavior. Resizing a parent must not open a dialog, move focus unexpectedly, or invent a new dismissal path.

Oddkin overlays use the platform top layer while remaining in the owning DOM tree. This preserves inherited theme, density, direction, language, and composed event paths. Nested overlays must follow their documented ownership and dismissal contracts. Check focus entry and return, Escape and explicit close behavior, scrolling, and collision handling; a screenshot cannot establish those facts.

Prefer CSS for responsive arrangement. Overlay positioning may legitimately measure an anchor and surface using the existing positioning controller. That exception does not justify a global layout runtime, resize-driven remounting, or DOM sibling scanning.

## Verification and the behavior matrix

Derive the current component and valid-example inventory from public package exports and generated metadata. Exclude examples marked as deliberately incorrect from valid-example coverage. Do not hardcode the catalog's component count.

Authored example modules must register additional elements their fixtures create, using public registration exports when those elements are not composed dependencies. Verify a fixture in a fresh isolated preview: a previous catalog selection or an eager test registration can hide a missing dependency. Mounting an unregistered custom tag does not prove that its behavior works.

For each matrix result, record the source revision, component or composition, example, actual available width and height, purpose, density, text-size configuration, browser, action performed, and observed result. Keep these evidence levels separate:

| Evidence | What it establishes | What it does not establish |
| --- | --- | --- |
| Example mounts and renders | The selected source fixture creates a visible element without the checked runtime errors. | Keyboard behavior, a useful layout, or a real service outcome. |
| Layout inspection | The checked content and controls fit or remain intentionally reachable in that configuration. | Every state, localization, large text, or assistive technology behavior. |
| Real interaction probe | The performed action emitted the expected intent and, where simulated, received the fixture's recorded outcome. | Backend authorization, actual execution, microphone permissions, or every alternative path. |
| Continuity probe | The checked resize or parent change retained the expected identity, work, and focus. | Continuity for untested presentations or host flows. |

Test isolated elements and meaningful compositions, including nested overlays, a narrow toolbar, a status with a recovery action, and detail inside another container. Use real keyboard and pointer interactions for interaction claims. Check document overflow separately from intentional local table or code scrolling. Verify cleanup when an example unmounts.

A prior lab finding, including a narrow combobox observation, must be reproduced against the current revision before being described as a current defect or a completed fix. Record a failed probe, an unsupported probe, and a passing probe distinctly. A startup or locator failure is a harness finding until evidence reaches the component.

## Guidance for agents

1. Read the installed component reference and this host contract before composing a responsive view. Reuse the published primitives and authored source examples.
2. State the parent purpose, actual capacity, scroll owner, essential information and actions, and continuity requirement in the implementation plan. Keep this private composition context outside component props unless a real public API explicitly supports it.
3. Use the smallest supported arrangement. Change the host when the product flow changes; change the component implementation when its own documented behavior fails. Do not disguise an implementation defect with an unrelated host workaround.
4. Preserve host-owned records and the request/outcome boundary. A compact layout must not turn a pending request into a success message or suppress the information needed to decide.
5. Verify the actual configurations and interactions changed. Report the observed evidence and remaining limits, with the current revision, rather than claiming every component or width is verified.
