# Oddkin: Build an Enterprise-Grade, High-Performance Data Grid

## Mission

Design and implement `odd-data-grid`, a production-grade, framework-agnostic data grid as a native web component within the existing Oddkin design system.

The component must be capable of supporting massive datasets, complex enterprise interactions, bidirectional virtualization, sophisticated data manipulation, editing, streaming updates, and accessible keyboard navigation.

Draw architectural lessons from AG Grid, TanStack Table, TanStack Virtual, MUI X Data Grid, Glide Data Grid, and Handsontable.

The goal is not simply to recreate an HTML table with virtual scrolling. Build a comprehensive grid architecture that can compete with mature enterprise data grids while exploiting the strengths of native web components and Oddkin's framework-agnostic infrastructure.

**This is a new implementation. No data grid architecture, implementation, or previous data grid prompt should be assumed to exist.**

Begin by examining the repository and its existing architecture, implementation plan, contracts, components, utilities, tests, documentation infrastructure, and established patterns.

Produce an implementation plan and then execute it incrementally. Do not stop at planning, scaffolding, or placeholder implementations.

Preserve existing Oddkin architecture and conventions.

---

# 1. Package architecture

Oddkin currently has four primary packages:

- `@oddkin/core`
- `@oddkin/state`
- `@oddkin/components`
- `@oddkin/workbench`

**Do not introduce additional npm packages for the data grid.**

The entire data grid, including its headless engine, rendering implementations, row models, data adapters, and feature modules, belongs inside `@oddkin/components`.

Other existing packages should provide supporting infrastructure when appropriate.

### Package responsibilities

**`@oddkin/core`**

Shared, component-agnostic foundations:

- Lifecycle utilities
- Observers
- Scheduling utilities
- General-purpose measurement utilities
- Rendering primitives
- Reusable scroll and virtualization utilities
- Event and cleanup infrastructure
- Shared contracts

Only move virtualization primitives here if they are genuinely reusable outside the data grid.

**`@oddkin/state`**

Existing reactive state-management infrastructure:

- Reactive state
- Subscriptions
- Selectors
- State batching
- State transitions
- Derived state
- Controlled/uncontrolled state support where available

Do not implement a competing reactive state-management system inside the grid.

**`@oddkin/components`**

All grid-specific functionality:

- Public custom element
- Headless grid engine
- Row and column models
- Data adapters
- Virtualization integration
- DOM and Canvas renderers
- Sorting and filtering
- Grouping and aggregation
- Pivoting
- Selection
- Editing
- Accessibility
- Clipboard
- Export
- Feature extensions

**`@oddkin/workbench`**

Grid development and documentation:

- Interactive examples
- Component documentation
- API explorer
- Playground
- Performance benchmarks and visualizations
- Theme demonstrations
- Accessibility testing examples

Follow the existing conventions for documentation and component discovery.

---

# 2. Suggested internal component structure

Adapt this proposal to the actual repository conventions.

```text
packages/
├── core/
│   └── src/
│       └── ...
│
├── state/
│   └── src/
│       └── ...
│
├── components/
│   └── src/
│       └── data-grid/
│           ├── data-grid.ts
│           ├── data-grid.definition.ts
│           ├── data-grid.template.ts
│           ├── data-grid.styles.ts
│           ├── data-grid.types.ts
│           ├── index.ts
│           │
│           ├── engine/
│           │   ├── grid-engine.ts
│           │   ├── grid-state.ts
│           │   ├── row-model.ts
│           │   ├── column-model.ts
│           │   ├── transactions.ts
│           │   └── feature-registry.ts
│           │
│           ├── virtualization/
│           │   ├── grid-virtualizer.ts
│           │   ├── row-layout.ts
│           │   ├── column-layout.ts
│           │   ├── pinned-layout.ts
│           │   └── scroll-coordinator.ts
│           │
│           ├── data/
│           │   ├── data-source.ts
│           │   ├── local-source.ts
│           │   ├── remote-source.ts
│           │   ├── infinite-source.ts
│           │   ├── viewport-source.ts
│           │   └── cache.ts
│           │
│           ├── features/
│           │   ├── sorting.ts
│           │   ├── filtering.ts
│           │   ├── selection.ts
│           │   ├── editing.ts
│           │   ├── grouping.ts
│           │   ├── aggregation.ts
│           │   ├── pivoting.ts
│           │   ├── tree-data.ts
│           │   ├── clipboard.ts
│           │   └── export.ts
│           │
│           ├── renderers/
│           │   ├── renderer.types.ts
│           │   ├── dom-renderer.ts
│           │   ├── canvas-renderer.ts
│           │   ├── cell-renderers.ts
│           │   └── editor-overlay.ts
│           │
│           ├── accessibility/
│           │   ├── keyboard.ts
│           │   ├── focus.ts
│           │   ├── aria.ts
│           │   └── announcements.ts
│           │
│           └── tests/
│
└── workbench/
    └── ...
```

The important distinction is between **internal architectural modularity and published package modularity**.

These files remain part of one components package.

The headless grid engine should not import the custom element, DOM renderer, or Canvas renderer.

Use explicit module boundaries to preserve testability and framework independence.

Provide a focused package subpath export if supported by existing conventions:

```ts
import {
  OddkinDataGrid,
  type GridColumn,
  type GridDataSource,
} from "@oddkin/components/data-grid";
```

Ensure unused capabilities can be tree-shaken where possible.

Use lazy imports for substantial optional functionality, particularly Canvas rendering and heavy export functionality.

Do not let the default data grid import pull in every optional feature unnecessarily.

---

# 3. Architectural principles

Follow these requirements throughout implementation.

1. **Headless-first.** The grid's data processing, interaction state, and virtualization logic must be independent of the DOM.

2. **Web-component-native.** `<odd-data-grid>` is the primary rendering and interaction surface.

3. **Framework-agnostic.** Consumers must be able to use the component in vanilla JavaScript, React, Angular, Vue, and Svelte without introducing framework dependencies into Oddkin.

4. **Viewport-proportional rendering.** Rendering cost should scale primarily with visible rows and columns, not total dataset size.

5. **Fine-grained invalidation.** A change to one cell should not automatically rerender the whole grid.

6. **Predictable state ownership.** Grid-specific state integrates with `@oddkin/state`.

7. **Composable features.** Advanced capabilities should be organized internally as feature modules.

8. **Explicit asynchronous behavior.** Data loading, mutations, editing, and remote operations must have defined lifecycle and cancellation semantics.

9. **Accessible interaction.** Virtualization cannot undermine keyboard support and screen-reader semantics.

10. **Benchmark-driven optimization.** Measure performance continuously rather than relying on theoretical efficiency.

11. **Reusable primitives.** Move genuinely general-purpose functionality to Oddkin core rather than reinventing it locally.

12. **No unnecessary abstraction.** Keep clear boundaries without creating excessive interfaces, indirection, or package fragmentation.

---

# 4. Public API design

Design a fully typed API with ergonomic TypeScript generics.

Example:

```ts
interface Person {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  salary: number;
}

const columns: GridColumn<Person>[] = [
  {
    id: "firstName",
    field: "firstName",
    header: "First Name",
    width: 180,
    sortable: true,
    filterable: true,
    editable: true,
  },
  {
    id: "salary",
    field: "salary",
    header: "Salary",
    type: "number",
    width: 140,
    sortable: true,
    aggregate: "sum",
  },
];

const grid = document.querySelector("odd-data-grid");

grid.configure({
  columns,
  rows: people,
  getRowId: (row) => row.id,
  rowHeight: 36,
  selection: {
    mode: "multi-row",
  },
  virtualization: {
    rows: true,
    columns: true,
    overscanRows: 8,
    overscanColumns: 2,
  },
});
```

Support declarative HTML configuration for simple options and JavaScript properties for complex data, functions, and callbacks.

Do not attempt to serialize entire datasets or callback functions into HTML attributes.

### Column definitions

Support:

- Stable column IDs
- Field accessors
- Value getters/setters
- Value formatters/parsers
- Cell renderers
- Custom editors
- Validators
- Sorting comparators
- Filter types
- Aggregators
- Column width and constraints
- Flexible sizing
- Auto sizing
- Column groups
- Nested headers
- Visibility
- Reordering
- Pinning
- Resizing
- Cell alignment
- Tooltips
- Styling hooks
- Accessibility labels
- Conditional editing

Separate column data semantics from column presentation.

### Grid controller API

Provide well-defined methods covering:

**Data:** `setRows`, `setDataSource`, `getRow`, `getRowById`, `applyTransaction`, `applyTransactionAsync`, `refreshRows`, `refreshCells`, `invalidateCache`.

**Navigation:** `scrollToRow`, `scrollToColumn`, `scrollToCell`, `ensureCellVisible`, `getVisibleRange`, `setFocusedCell`, `getFocusedCell`.

**Selection:** `selectRow`, `selectRows`, `selectRange`, `clearSelection`, `getSelection`, `selectAll`.

**Editing:** `startEditing`, `stopEditing`, `commitEditing`, `cancelEditing`, `undo`, `redo`.

**Columns:** `setColumns`, `setColumnWidth`, `autoSizeColumn`, `autoSizeColumns`, `pinColumn`, `moveColumn`, `setColumnVisibility`.

**Data manipulation:** `setSorting`, `setFilters`, `setGrouping`, `setPivot`, `expandRow`, `collapseRow`.

**State:** `getState`, `setState`, `resetState`, `subscribe`.

**Export:** `exportCSV`, `exportTSV`, `exportJSON`.

Define synchronous versus asynchronous semantics, return types, and failure conditions.

---

# 5. Data models and processing pipeline

Support multiple data models through a shared interface.

## Client-side model

All relevant rows are in memory.

Implement:

- Stable multi-column sorting
- Filtering
- Grouping
- Aggregation
- Expansion
- Pagination
- Search
- Transactions
- Incremental invalidation

Use stable row IDs.

Avoid recomputing every derived row for small changes where incremental updates are practical.

## Infinite model

Support block-based loading as the user scrolls.

Include:

- Block sizes
- Block caching
- Cache eviction
- Prefetching
- Cancellable requests
- Loading placeholders
- Retry policies
- Unknown row counts
- End-of-data detection

## Server-side model

Support delegation of:

- Sorting
- Filtering
- Grouping
- Aggregation
- Pivoting
- Pagination

Define which operations are performed remotely versus locally.

Avoid producing incorrect global results from partial datasets.

## Viewport model

Allow external applications to provide the records currently required by the viewport.

Suitable for continuously updating dashboards.

## Tree model

Support:

- Parent-child relationships
- Lazy expansion
- Stable node IDs
- Indentation
- Nested sorting
- Hierarchical selection
- Variable heights

## Processing pipeline

Design explicit row-model stages:

```text
Raw Data
   ↓
Filtering
   ↓
Grouping / Tree Construction
   ↓
Sorting
   ↓
Aggregation / Pivoting
   ↓
Expansion / Flattening
   ↓
Pagination
   ↓
Logical Visible Rows
   ↓
Virtualization
   ↓
Rendering
```

This is a conceptual pipeline.

Determine the correct semantic ordering for each row-model mode. Not every mode should blindly execute the same transformations.

Avoid hidden dependencies between feature modules.

---

# 6. Two-dimensional virtualization

Implement both row and column virtualization.

This is a foundational requirement, not an optional enhancement.

Support:

- Millions of logical rows
- Thousands of logical columns
- Fixed row heights
- Variable row heights
- Dynamic measurements
- Variable column widths
- Horizontal and vertical scrolling
- Pinned rows
- Pinned columns
- Virtualized grouped headers
- Programmatic scrolling
- Keyboard navigation
- Large logical scroll offsets
- Scroll anchoring
- Configurable overscan

## Efficient range calculation

Use efficient indexed geometry structures.

Investigate:

- Prefix sums
- Binary search
- Fenwick trees
- Indexed measurement caches

Avoid linear scanning over every logical row during scroll operations.

For fixed-height rows, index lookup should be constant time where possible.

For variable-height rows, aim for logarithmic lookup and update operations.

## Dynamic height management

Support measured and estimated row heights.

Maintain geometry caches.

When a measurement changes, update layout without unnecessarily invalidating all rows.

Preserve the user's visible scroll anchor when rows above the viewport change size.

Investigate the interaction between dynamic row height and column virtualization.

Do not force all offscreen columns to render solely to measure every row.

Expose measurement strategies and explain their tradeoffs.

## Overscan

Implement configurable row and column overscan.

Investigate adaptive overscan based on scroll velocity and direction.

Prevent unbounded overscan growth.

Avoid excessive rendering when users scroll quickly.

## Browser scroll limits

Browsers impose practical limits on physical scroll-container dimensions.

Do not create a single spacer whose height is proportional to millions of rows without considering these limits.

Implement a logical scrolling strategy, such as segmented scroll space or coordinate rebasing.

Preserve:

- Correct row indices
- Smooth scrolling
- Reliable programmatic navigation
- Accurate viewport ranges
- Keyboard navigation
- Stable anchoring

Test extreme scroll positions in Chromium, Firefox, and WebKit.

## Recycling

Reuse visible row and cell elements where beneficial.

Ensure recycled elements properly reset:

- Cell data
- Attributes
- Styling
- ARIA state
- Selection
- Focus
- Events
- Observers
- Editor state

Do not recycle focused or actively edited elements without preserving their logical state.

Prevent stale cell content and asynchronous race conditions.

---

# 7. Pinned and sticky regions

Support:

- Pinned leading columns
- Pinned trailing columns
- Pinned top rows
- Pinned bottom rows
- Sticky column headers
- Nested column group headers
- Summary rows
- Group footers

Use one synchronized scroll coordinate system.

Avoid separately scrolling containers that drift out of alignment.

Handle intersections between pinned rows and columns.

Support RTL through logical start/end concepts.

Clearly define sizing constraints when pinned regions consume most of the viewport.

---

# 8. Rendering backends

Keep rendering strategies internal to `@oddkin/components/data-grid`.

Define a renderer contract that allows DOM and Canvas implementations to share the same engine.

```ts
interface GridRenderer {
  mount(context: GridRenderContext): void;

  update(
    snapshot: GridRenderSnapshot,
    changes: GridRenderChanges
  ): void;

  setViewport(viewport: GridViewport): void;

  dispose(): void;
}
```

Refine the interface as needed.

## DOM renderer

This is the default and primary renderer.

Requirements:

- Efficient DOM reconciliation
- Bounded rendered cell count
- Row and cell reuse
- Batched DOM updates
- Minimal layout reads
- Event delegation where practical
- Scoped observation
- Fine-grained updates
- Stable focus behavior
- CSS containment where suitable

Avoid per-cell subscriptions or event listeners when delegated alternatives are more efficient.

Do not synchronously force layout after bulk DOM writes.

Support custom web components inside cells, with explicit lifecycle and recycling behavior.

## Canvas renderer

Provide an optional Canvas2D rendering implementation.

Requirements:

- Visible-cell drawing
- Dirty-region redraw
- Text measurement caching
- High-DPI support
- Coordinate hit testing
- Selection rendering
- Focus indicators
- Pinned regions
- Custom draw callbacks
- DOM-based editor overlays

Evaluate optional OffscreenCanvas and Web Worker integration.

Do not assume workers are always faster.

Canvas must not compromise the grid's data, state, or interaction contracts.

Define a credible keyboard and assistive-technology strategy before claiming feature parity.

Expose:

```ts
renderer: "dom" | "canvas"
```

Keep Canvas code lazy-loadable where feasible.

---

# 9. State management

Reuse `@oddkin/state`.

Do not introduce another general-purpose reactive framework.

Support independently controlled state slices:

- Sorting
- Filtering
- Grouping
- Pivoting
- Aggregation
- Expansion
- Selection
- Focus
- Editing
- Column order
- Column visibility
- Column sizing
- Pinning
- Pagination

Keep transient viewport geometry and caches separate from serializable application state.

Requirements:

- Fine-grained subscriptions
- Efficient selectors
- Batched transitions
- Equality checks
- Deterministic updates
- Controlled/uncontrolled support
- Snapshot serialization
- Restoration
- Undo/redo for editable data

Scrolling must not trigger global application-state recomputation.

Changing selection must not re-run sorting.

Editing one cell must not invalidate the entire viewport.

---

# 10. Streaming and transactional updates

Support high-frequency changes.

Example:

```ts
grid.applyTransaction({
  add: addedRows,
  update: updatedRows,
  remove: removedIds,
});

grid.applyTransactionAsync({
  update: streamingRows,
});
```

Implement:

- Stable row identities
- Batched transactions
- Configurable flush scheduling
- Transaction coalescing
- Revision tracking
- Dirty-cell detection
- Incremental recalculation
- Backpressure
- Optimistic changes
- Rollback
- Conflict resolution policies

Prioritize user input over background work.

Investigate optional worker-based processing for expensive sorting, filtering, grouping, and aggregation.

Make worker boundaries explicit and do not assume callback functions are transferable.

---

# 11. Data-source APIs and caching

Provide a typed asynchronous data-source interface.

```ts
interface GridDataSource<T> {
  getRows(
    request: GridRowsRequest,
    context: {
      signal: AbortSignal;
    }
  ): Promise<GridRowsResponse<T>>;

  updateRows?(
    changes: GridMutation<T>[],
    context: {
      signal: AbortSignal;
    }
  ): Promise<GridMutationResult>;
}
```

Requests should support:

- Row ranges
- Cursors
- Sort models
- Filter expressions
- Group paths
- Aggregation requests
- Pivot configuration
- Requested columns
- Revision identifiers

Implement:

- Range-aware caching
- LRU eviction
- Block deduplication
- Request concurrency limits
- Cancellation
- Stale-response rejection
- Adjacent-block prefetching
- Retry/backoff
- Explicit invalidation
- Memory budgets

When sorting or filtering changes, old network responses must not corrupt the current data view.

---

# 12. Sorting and filtering

## Sorting

Support:

- Single and multi-column sorting
- Stable ordering
- Custom comparators
- Locale-aware strings
- Numbers
- Dates
- Null handling
- Group sorting
- Server delegation

## Filtering

Support:

- Text
- Number
- Date
- Boolean
- Set membership
- Multiple conditions
- AND/OR expression groups
- Global search
- Quick filters
- Faceted filters
- Custom predicates
- Server delegation

Define a structured, serializable filter-expression model.

Make null, missing-value, locale, date, and case-sensitivity semantics explicit.

Avoid arbitrary code execution when processing server-provided filters.

---

# 13. Grouping, aggregation and pivoting

Implement:

### Grouping

- Multiple grouping levels
- Group headers
- Expand/collapse
- Group counts
- Group footers
- Group selection
- Lazy group loading
- Stable group identities

### Aggregation

Built-in operations:

- Sum
- Count
- Min/max
- Average
- Median
- Distinct count
- First/last

Allow custom aggregators.

Support incremental aggregate updates where practical.

### Pivoting

- Multiple pivot dimensions
- Generated columns
- Column group hierarchies
- Aggregated pivot values
- Server-side pivot support
- Deterministic generated IDs
- Cardinality limits

Prevent unbounded generated columns.

---

# 14. Selection and clipboard

Support:

- Single row
- Multiple rows
- Checkbox selection
- Select all
- Cell selection
- Rectangular ranges
- Multiple ranges
- Shift-click
- Ctrl/Cmd selection
- Keyboard selection extension
- Selection across virtualized regions
- Selection across remote pages

Selection must use logical identifiers rather than DOM positions.

For remote data, distinguish selection of loaded rows from selection of all records matching a query.

Implement clipboard operations:

- Copy
- Cut
- Paste
- TSV/CSV parsing
- HTML table format
- Multi-cell paste
- Bulk validation
- Paste error handling
- Undoable edits

Consider fill handles and autofill as advanced capabilities.

---

# 15. Editing architecture

Editing must operate through a dedicated controller rather than being coupled to the DOM renderer.

Support:

- Single-click editing
- Double-click editing
- Keyboard editing
- Enter/Escape behavior
- Tab navigation
- Cell editing
- Row editing
- Async validation
- Cross-field validation
- Async persistence
- Optimistic updates
- Error display
- Dirty-state tracking
- Undo/redo
- Conflict handling

Built-in editors:

- Text
- Number
- Checkbox
- Select
- Date
- Date/time
- Multiline text

Allow registered custom editors.

Reuse Oddkin form controls where appropriate.

Only mount editors when necessary.

Define behavior when an edited cell scrolls out of view, changes position after sorting, or receives an external update.

---

# 16. Column and row management

### Columns

Implement:

- Resize
- Reorder
- Pin
- Hide/show
- Autosize
- Flex sizing
- Min/max widths
- Column groups
- Nested headers
- Column menus
- Column chooser
- Saved column layouts

Avoid full-grid recomputation during resizing.

### Rows

Implement:

- Variable heights
- Detail panels
- Expand/collapse
- Tree nodes
- Pinning
- Drag reordering
- Context menus
- Loading rows
- Error rows
- Summary rows
- Group rows

Support nested grids without conflicting keyboard or scroll handling.

---

# 17. Accessibility

Treat WAI-ARIA grid behavior as a foundational design constraint.

Reference:

https://www.w3.org/WAI/ARIA/apg/patterns/grid/

Implement:

- Grid, row, and cell semantics
- Header semantics
- Correct virtual row/column indices
- Known and unknown row counts
- Selection state
- Sorting state
- Expansion state
- Accessible labels
- Focus indicators
- Keyboard instructions
- Live announcements
- High contrast
- Forced colors
- Reduced motion
- RTL

Keyboard support must cover:

- Arrow navigation
- Home/End
- Ctrl/Cmd+Home/End
- Page Up/Down
- Shift selection
- Enter to edit
- Escape to cancel
- Tab navigation
- Space-based selection
- Context menu activation

Research roving tabindex versus `aria-activedescendant`.

Validate the chosen strategy with actual browser and assistive-technology behavior.

When navigating to a virtualized cell:

1. Update logical focus.
2. Bring the cell into view.
3. Ensure it is rendered.
4. Apply DOM focus.
5. Preserve accessible context.

Never focus stale recycled elements.

Investigate Shadow DOM versus light DOM semantics and choose deliberately.

Canvas rendering must have an accessible interaction strategy.

---

# 18. Design tokens and styling

Use Oddkin's existing token infrastructure.

Do not create a separate token engine.

Support:

- Light/dark themes
- Product themes
- Density variants
- Header styling
- Cell spacing
- Gridlines
- Selection styling
- Focus indicators
- Hover states
- Alternating rows
- Pinned-region separators
- Error and loading states
- Forced colors

Example token concepts:

```css
--odd-grid-row-height
--odd-grid-header-height
--odd-grid-cell-padding-inline
--odd-grid-border-color
--odd-grid-header-background
--odd-grid-row-hover-background
--odd-grid-selection-background
--odd-grid-focus-ring
--odd-grid-pinned-shadow
```

Map these into existing canonical Oddkin tokens.

Provide compact, standard, and comfortable densities.

Expose appropriate styling hooks and CSS parts.

The default grid should be visually polished, clean, and consistent with the broader Oddkin design language.

---

# 19. Events

Expose typed CustomEvents following Oddkin naming conventions.

Suggested events:

```text
odd-grid-ready
odd-grid-state-change
odd-grid-selection-change
odd-grid-focus-change
odd-grid-cell-click
odd-grid-cell-double-click
odd-grid-cell-edit-start
odd-grid-cell-edit-commit
odd-grid-cell-edit-cancel
odd-grid-cell-value-change
odd-grid-sort-change
odd-grid-filter-change
odd-grid-column-resize
odd-grid-column-move
odd-grid-visible-range-change
odd-grid-data-loading
odd-grid-data-loaded
odd-grid-data-error
odd-grid-transaction-flushed
```

Define payloads, bubbling, composition, cancelability, and ordering.

Coalesce high-frequency events when appropriate.

---

# 20. Performance engineering

Create a deterministic benchmark suite.

Test these scenarios:

| Dataset | Purpose |
|---|---|
| 1,000 × 20 | Normal application |
| 100,000 × 50 | Large local dataset |
| 1,000,000 × 100 | Huge logical dataset |
| 10,000 × 2,000 | Extreme column virtualization |
| 100,000 variable-height rows | Measurement performance |
| Grouped/aggregated large data | Row-model performance |
| High-frequency streaming | Transaction throughput |
| Remote paginated dataset | Cache and request behavior |
| Complex custom cells | Rendering overhead |
| Multiple grid instances | Isolation and memory |

Measure:

- Initial render
- Time to first usable viewport
- Frame times
- Scroll FPS
- Input latency
- DOM node count
- Heap memory
- Garbage collection
- Range calculation
- Cell updates
- Transaction throughput
- Sorting/filtering
- Grouping/aggregation
- Column resizing
- Editor activation
- Remote cache performance

### Performance goals

Treat the following as provisional engineering targets:

- Aim for smooth 60 FPS scrolling on ordinary desktop hardware.
- Keep p95 scroll work comfortably within a 16.7 ms frame budget at 60 Hz.
- Keep rendered DOM proportional to viewport size.
- Support navigation across millions of logical rows without allocating all rows.
- Avoid routine long tasks during scrolling.
- Preserve anchors during dynamic measurement.
- Batch high-frequency updates.
- Keep interactions responsive while remote requests are pending.

Do not claim a benchmark target has been achieved without measurements.

Record hardware, browser versions, dataset characteristics, renderer mode, and enabled features.

Compare against representative configurations of mature grids when useful.

---

# 21. Scheduling and memory management

Define priorities for:

1. User input and focus
2. Active editing
3. Scroll calculations
4. Visible rendering
5. Background computations
6. Data prefetching
7. Diagnostics

Use appropriate scheduling primitives.

Investigate:

- `requestAnimationFrame`
- Microtasks
- Idle callbacks
- Cooperative chunking
- Optional workers

Implement limits for:

- Rendered rows
- Rendered columns
- Remote cache blocks
- Measurement caches
- Custom renderer instances
- Concurrent requests
- Background work

Provide meaningful cleanup and eviction behavior.

Expose development warnings for unusually expensive configurations.

---

# 22. Security and robustness

Handle untrusted application data safely.

- Render strings as text by default.
- Explicitly opt in to rich HTML.
- Document sanitization requirements.
- Prevent spreadsheet formula injection during export.
- Avoid evaluating filter strings as code.
- Validate incoming data-source responses.
- Limit pathological recursive tree structures.
- Bound expensive operations.
- Handle malformed records.
- Prevent endless fetch retries.
- Cancel stale async work.
- Clean up detached observers and editors.
- Protect against stale updates during sorting, filtering, and navigation.

Do not introduce `eval` or equivalent runtime code execution.

---

# 23. Testing

### Unit tests

Cover:

- Virtual ranges
- Dynamic measurements
- Logical scrolling
- Extreme indices
- Scroll anchoring
- Row-model transformations
- Stable sorting
- Filtering semantics
- Grouping
- Aggregation
- Pivoting
- Selection
- Transactions
- Cache eviction
- Request cancellation
- State transitions

### Integration tests

Cover:

- Custom element registration
- Lifecycle
- DOM rendering
- Canvas rendering
- Editor positioning
- Pinned regions
- Theme changes
- RTL
- Reconnection
- Multiple instances
- Custom cell renderers

### Browser tests

Use existing infrastructure or Playwright.

Test Chromium, Firefox, and WebKit.

Include:

- Mouse and touchpad scrolling
- Keyboard navigation
- Focus restoration
- Selection
- Editing
- Browser zoom
- Forced colors
- Reduced motion
- Extreme logical scrolling
- Rapid remote request changes
- Network failures
- Resize handling

### Framework tests

Verify usage in:

- Vanilla JavaScript/TypeScript
- React
- Vue
- Angular
- Svelte

Reuse existing framework-testing infrastructure.

---

# 24. Workbench integration

Integrate `odd-data-grid` into the existing Oddkin workbench.

Provide:

- Overview
- Quick start
- API reference
- Column configuration
- Data sources
- Virtualization
- Selection
- Editing
- Grouping
- Pivoting
- Accessibility
- Theming
- Performance guidance
- Troubleshooting

Interactive examples:

1. Basic grid
2. Sorting/filtering
3. Editing
4. Selection
5. Pinned columns
6. Grouping/aggregation
7. Tree data
8. Remote data
9. Infinite scrolling
10. Million-row logical dataset
11. High-frequency streaming
12. Variable row heights
13. Large column counts
14. Custom renderers
15. Canvas rendering
16. Theme variations

### Grid Performance Lab

Add an interactive performance playground.

Allow configuration of:

- Logical row count
- Column count
- Row height
- Overscan
- Renderer
- Update frequency
- Remote latency
- Grouping
- Sorting
- Pinned regions

Show measured:

- Visible rows and columns
- Rendered cell count
- DOM node count
- Frame times
- FPS
- Cache statistics
- Pending requests
- Memory estimates where available

Integrate this into existing workbench patterns rather than building an unrelated development application.

---

# 25. Research and architectural investigations

Before settling the architecture, review current documentation and relevant implementation patterns from:

- AG Grid: https://www.ag-grid.com/
- TanStack Table: https://tanstack.com/table/latest
- TanStack Virtual: https://tanstack.com/virtual/latest
- MUI X Data Grid: https://mui.com/x/react-data-grid/
- Glide Data Grid: https://github.com/glideapps/glide-data-grid
- Handsontable: https://handsontable.com/
- WAI-ARIA Grid Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/grid/
- MDN Web Components: https://developer.mozilla.org/en-US/docs/Web/API/Web_components

Investigate and record decisions on:

1. DOM recycling and embedded custom-element lifecycles.
2. Focus management across virtualized cells.
3. Variable row heights with horizontal virtualization.
4. Browser scroll-container size limits.
5. Scroll anchoring during async measurement.
6. Incremental row-model recomputation.
7. Server-side selection across unloaded records.
8. Stable group identities.
9. Incremental aggregation.
10. DOM versus Canvas performance tradeoffs.
11. Editor preservation during scrolling.
12. Fine-grained custom-renderer invalidation.
13. RTL and pinned-region geometry.
14. Remote cache consistency.
15. General-purpose utilities that belong in `@oddkin/core`.
16. Performance behavior under high-cardinality pivoting.
17. Shadow DOM accessibility tradeoffs.

Do not copy proprietary source code or introduce incompatible dependencies.

---

# 26. Implementation phases

Work incrementally and validate each phase.

### Phase 1: Repository research and architecture

- Inspect repository.
- Read implementation plan and contracts.
- Identify reusable existing utilities.
- Define public types.
- Define engine boundaries.
- Define virtualization interfaces.
- Define data-source contracts.
- Define rendering contracts.
- Define accessibility strategy.
- Update implementation plan.

### Phase 2: Headless engine

Implement:

- Row model
- Column model
- State integration
- Sorting
- Filtering
- Selection
- Transactions

### Phase 3: Virtualization

Implement:

- Vertical virtualization
- Horizontal virtualization
- Dynamic sizes
- Scroll anchoring
- Logical scrolling
- Pinned-region geometry

### Phase 4: Native web component

Implement:

- `<odd-data-grid>`
- DOM renderer
- Headers
- Virtual cells
- Styling
- Keyboard navigation
- Accessibility
- Lifecycle handling

Deliver a functioning basic grid at this stage.

### Phase 5: Enterprise interaction

Implement:

- Editing
- Clipboard
- Range selection
- Column resizing
- Reordering
- Pinning
- Menus
- Undo/redo

### Phase 6: Advanced data

Implement:

- Infinite loading
- Server-side row model
- Viewport loading
- Tree data
- Grouping
- Aggregation
- Pivoting

### Phase 7: Performance

Implement and refine:

- Batched rendering
- Incremental invalidation
- Streaming transactions
- Cache policies
- Adaptive overscan
- Optional worker processing
- Performance benchmarks

### Phase 8: Canvas renderer

Implement:

- Canvas backend
- Cell drawing
- Dirty regions
- Hit testing
- DOM editing overlays
- Accessibility strategy
- Performance comparisons

### Phase 9: Workbench and hardening

Implement:

- Documentation
- Interactive examples
- Performance Lab
- Accessibility testing
- Cross-browser tests
- Framework tests
- Bundle-size validation
- Public API review

---

# 27. Required architectural qualities

The implementation must preserve these invariants:

**A.** The grid engine must never import the custom element or a renderer.

**B.** The grid renderer must not own authoritative application data.

**C.** Virtualization must operate on logical row/column identities rather than depending on mounted DOM elements.

**D.** Scrolling must not trigger unnecessary global state updates.

**E.** Remote responses must never overwrite newer query generations.

**F.** Custom renderers and editors must have explicit lifecycle semantics.

**G.** Focus, selection, and editing must survive virtualization wherever their documented policies require it.

**H.** Grid-specific concerns must remain inside `@oddkin/components`.

**I.** General-purpose reusable infrastructure must use existing Oddkin packages.

**J.** No additional npm packages should be created for individual grid capabilities.

**K.** Optional heavyweight features must not impose unavoidable runtime or bundle overhead on simple grids.

**L.** Performance claims must be supported by reproducible measurements.

---

# 28. Definition of done

The data grid is complete only when:

- `<odd-data-grid>` functions as a real native web component.
- All grid-specific implementation lives inside `@oddkin/components`.
- Existing Oddkin core and state infrastructure is reused.
- The headless engine remains DOM-independent.
- Rows and columns are independently virtualized.
- Million-row logical datasets do not require million-row allocation or rendering.
- Very large scroll ranges work within browser constraints.
- Dynamic row sizing and scroll anchoring work correctly.
- Pinned regions remain synchronized.
- Selection works across virtualized ranges.
- Editing survives supported navigation and scroll scenarios.
- High-frequency updates are batched.
- Remote loading is cancellable and cache-aware.
- Sorting, filtering, grouping, aggregation, and pivoting follow documented semantics.
- Accessibility and keyboard behavior have been tested.
- DOM and optional Canvas rendering follow consistent engine contracts.
- Public APIs and events are documented.
- Benchmarks run reproducibly.
- The workbench includes interactive examples and performance diagnostics.
- Supported frameworks are tested.
- Existing Oddkin contracts remain intact.

Maintain an accurate feature-status matrix distinguishing implemented, tested, experimental, planned, and unsupported functionality.

Do not equate interfaces, placeholders, or partially implemented features with completed functionality.

## Final instruction

Build an exceptionally capable enterprise data grid that demonstrates the strengths of Oddkin's design-system architecture.

**Do not turn the data grid into its own ecosystem of npm packages.**

It is one sophisticated component inside `@oddkin/components`, powered by reusable infrastructure from `@oddkin/core` and `@oddkin/state`, and documented and tested through `@oddkin/workbench`.

Internally modular. Externally cohesive. Framework-independent. Virtualized in both dimensions. Accessible, extensible, and demonstrably performant.

Start by examining the existing repository, then plan and implement accordingly.
