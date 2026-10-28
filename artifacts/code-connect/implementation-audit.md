# Oddkin implementation and Code Connect audit

Audit date: 2026-10-26. Source files and public imports were checked locally. Saved bindings are recorded separately from proposed corrections.

| Figma asset | Kind | Correct source | Correct name | Import | Findings |
|---|---|---|---|---|---|
| Oddkin/Common/button | Web component | packages/components/src/button/button.ts | OddkinButton | @oddkin/components/define/button | Observed mapping matches source/name checks. |
| Oddkin/Common/iconButton | Web component variation | packages/components/src/button/button.ts | OddkinButton | @oddkin/components/define/button | No mapping verified in sampled selections. |
| Oddkin/Common/toggleButton | Web component variation | packages/components/src/button/button.ts | OddkinButton | @oddkin/components/define/button | No mapping verified in sampled selections. |
| Oddkin/Common/link | CSS recipe | packages/components/src/css/index.ts | link | @oddkin/components/css/link.css | Export name is blank; use link. |
| Oddkin/Common/badge | Web component | packages/components/src/badge/badge.ts | OddkinBadge | @oddkin/components/define/badge | Observed mapping matches source/name checks. |
| Oddkin/Common/chip | Web component | packages/components/src/chip/chip.ts | OddkinChip | @oddkin/components/define/chip | Observed mapping matches source/name checks. |
| Oddkin/Common/button/sm | Web component variation | packages/components/src/button/button.ts | OddkinButton | @oddkin/components/define/button | Export name is blank; use OddkinButton. |
| Oddkin/Common/button/lg | Web component variation | packages/components/src/button/button.ts | OddkinButton | @oddkin/components/define/button | Export name is blank; use OddkinButton. |
| Oddkin/Common/field | CSS recipe | packages/components/src/css/index.ts | field | @oddkin/components/css/field.css | Export name is blank; use field. |
| Oddkin/Common/input | Web component | packages/components/src/input/input.ts | OddkinInput | @oddkin/components/define/input | Observed mapping matches source/name checks. |
| Oddkin/Common/textarea | Web component | packages/components/src/textarea/textarea.ts | OddkinTextarea | @oddkin/components/define/textarea | Observed mapping matches source/name checks. |
| Oddkin/Common/search | Web component variation | packages/components/src/input/input.ts | OddkinInput | @oddkin/components/define/input | No mapping verified in sampled selections. |
| Oddkin/Common/checkbox | Web component | packages/components/src/checkbox/checkbox.ts | OddkinCheckbox | @oddkin/components/define/checkbox | Observed mapping matches source/name checks. |
| Oddkin/Common/radio | Internal component part | packages/components/src/form-control/radio-input.ts | radioInput | @oddkin/components/define/radio-group | Export name is blank; use radioInput. |
| Oddkin/Common/switch | Web component | packages/components/src/switch/switch.ts | OddkinSwitch | @oddkin/components/define/switch | Observed mapping matches source/name checks. |
| Oddkin/Common/slider | Web component | packages/components/src/slider/slider.ts | OddkinSlider | @oddkin/components/define/slider | Observed mapping matches source/name checks. |
| Oddkin/Common/ListboxSurface | Internal component part | packages/components/src/collection/option-rows.template.ts | optionListTemplate | @oddkin/components/define/listbox | Export name should be optionListTemplate; saved ListboxSurface. |
| Oddkin/Common/ListboxOption | Internal component part | packages/components/src/collection/option-rows.template.ts | optionListTemplate | @oddkin/components/define/listbox | Export name should be optionListTemplate; saved ListboxOption. |
| Oddkin/Common/CheckboxOption | Internal component part | packages/components/src/collection/option-rows.template.ts | optionListTemplate | @oddkin/components/define/combobox | Source should be packages/components/src/collection/option-rows.template.ts; saved packages/components/src/checkbox/checkbox.ts. Export name should be optionListTemplate; saved OddkinCheckbox. |
| Oddkin/Common/MenuItem | Internal component part | packages/components/src/menu/menu.template.ts | menuTemplate | @oddkin/components/define/menu | Export name is blank; use menuTemplate. |
| Oddkin/Common/NavigationItem | Internal component part | packages/components/src/side-nav/side-nav.template.ts | sideNavTemplate | @oddkin/components/define/side-nav | Export name should be sideNavTemplate; saved NavigationItem. |
| Oddkin/Common/CommandItem | Internal component part | packages/components/src/command-palette/command-palette.template.ts | commandPaletteTemplate | @oddkin/components/define/command-palette | Source should be packages/components/src/command-palette/command-palette.template.ts; saved packages/app/src/command/command.ts. Export name is blank; use commandPaletteTemplate. |
| Oddkin/Common/Disclosure | Web component | packages/components/src/disclosure/disclosure.ts | OddkinDisclosure | @oddkin/components/define/disclosure | Observed mapping matches source/name checks. |
| Oddkin/Common/tooltip | Web component | packages/components/src/tooltip/tooltip.ts | OddkinTooltip | @oddkin/components/define/tooltip | Observed mapping matches source/name checks. |
| Oddkin/Common/progress | Web component | packages/components/src/progress/progress.ts | OddkinProgress | @oddkin/components/define/progress | Observed mapping matches source/name checks. |
| Oddkin/Common/spinner | Web component | packages/components/src/spinner/spinner.ts | OddkinSpinner | @oddkin/components/define/spinner | Observed mapping matches source/name checks. |
| Oddkin/Common/skeleton | Web component | packages/components/src/skeleton/skeleton.ts | OddkinSkeleton | @oddkin/components/define/skeleton | Observed mapping matches source/name checks. |
| Oddkin/Common/avatar | Web component | packages/components/src/avatar/avatar.ts | OddkinAvatar | @oddkin/components/define/avatar | Observed mapping matches source/name checks. |
| Oddkin/Common/icon | Web component | packages/components/src/icon/icon.ts | OddkinIcon | @oddkin/components/define/icon | Observed mapping matches source/name checks. |
| Oddkin/Common/divider | CSS recipe | packages/components/src/css/index.ts | divider | @oddkin/components/css/divider.css | Export name is blank; use divider. |
| Oddkin/Common/typography | CSS recipe | packages/components/src/css/index.ts | typography | @oddkin/components/css/typography.css | Export name is blank; use typography. |
| Oddkin/Common/keyboardKey | CSS recipe | packages/components/src/css/index.ts | kbd | @oddkin/components/css/kbd.css | No mapping verified in sampled selections. |
| Oddkin/Common/avatar/Appearance | Web component variation | packages/components/src/avatar/avatar.ts | OddkinAvatar | @oddkin/components/define/avatar | No mapping verified in sampled selections. |
| Oddkin/Common/multiselect/Value/chips | Internal component part variation | packages/components/src/collection/option-field.template.ts | valueTemplate | @oddkin/components/define/combobox | Source should be packages/components/src/collection/option-field.template.ts; saved packages/components/src/chip/chip.ts. Export name should be valueTemplate; saved OddkinChip. |
| Oddkin/Common/multiselect/Value/count | Internal component part variation | packages/components/src/collection/option-field.template.ts | valueTemplate | @oddkin/components/define/combobox | No mapping verified in sampled selections. |
| Oddkin/Common/multiselect/Value/text | Internal component part variation | packages/components/src/collection/option-field.template.ts | valueTemplate | @oddkin/components/define/combobox | No mapping verified in sampled selections. |
| Oddkin/Common/multiselect/Value/auto | Internal component part variation | packages/components/src/collection/option-field.template.ts | valueTemplate | @oddkin/components/define/combobox | No mapping verified in sampled selections. |
| Oddkin/Common/multiselect/Value/expandable | Internal component part variation | packages/components/src/collection/option-field.template.ts | valueTemplate | @oddkin/components/define/combobox | No mapping verified in sampled selections. |
| Oddkin/Common/multiselect/Value/avatars | Internal component part variation | packages/components/src/collection/option-field.template.ts | valueTemplate | @oddkin/components/define/combobox | Source should be packages/components/src/collection/option-field.template.ts; saved packages/components/src/avatar/avatar.ts. Export name should be valueTemplate; saved OddkinAvatar. |
| Oddkin/Common/multiselect/Value/grouped | Internal component part variation | packages/components/src/collection/option-field.template.ts | valueTemplate | @oddkin/components/define/combobox | No mapping verified in sampled selections. |
| Oddkin/Common/multiselect/Field | Internal component part | packages/components/src/combobox/combobox.template.ts | comboboxTemplate | @oddkin/components/define/combobox | Export name should be comboboxTemplate; saved OddkinField. |
| Oddkin/Common/AvatarItem | Internal component part | packages/components/src/avatar/avatar.ts | OddkinAvatar | @oddkin/components/define/avatar | Observed mapping matches source/name checks. |
| Oddkin/Common/GridCell | Design specification | No implementation verified | — | — | No mapping verified in sampled selections. |
| Oddkin/Common/GridColumnHeader | Design specification | No implementation verified | — | — | No mapping verified in sampled selections. |
| Oddkin/Common/GridSelection | Design specification | No implementation verified | — | — | No mapping verified in sampled selections. |
| Oddkin/Common/Splitter/vertical | Internal component part | packages/components/src/split-panel/split-panel.template.ts | splitPanelTemplate | @oddkin/components/define/split-panel | No mapping verified in sampled selections. |
| Oddkin/Common/Splitter/horizontal | Internal component part | packages/components/src/split-panel/split-panel.template.ts | splitPanelTemplate | @oddkin/components/define/split-panel | No mapping verified in sampled selections. |
| Oddkin/Layout/SpecimenItem | Design specimen | No implementation verified | — | — | No mapping verified in sampled selections. |
| Oddkin/Layout/Box | CSS layout recipe | packages/components/src/css/index.ts | layout | @oddkin/components/css/layout.css | No mapping verified in sampled selections. |
| Oddkin/Layout/Container | Web component | packages/components/src/container/container.ts | OddkinContainer | @oddkin/components/define/container | No mapping verified in sampled selections. |
| Oddkin/Layout/Stack | CSS layout recipe | packages/components/src/css/index.ts | layout | @oddkin/components/css/layout.css | No mapping verified in sampled selections. |
| Oddkin/Layout/Row | CSS layout recipe | packages/components/src/css/index.ts | layout | @oddkin/components/css/layout.css | No mapping verified in sampled selections. |
| Oddkin/Layout/Cluster | CSS layout recipe | packages/components/src/css/index.ts | layout | @oddkin/components/css/layout.css | No mapping verified in sampled selections. |
| Oddkin/Layout/Grid | CSS layout recipe | packages/components/src/css/index.ts | layout | @oddkin/components/css/layout.css | No mapping verified in sampled selections. |
| Oddkin/Layout/AutoGrid | CSS layout recipe | packages/components/src/css/index.ts | layout | @oddkin/components/css/layout.css | No mapping verified in sampled selections. |
| Oddkin/Layout/Split | CSS layout recipe | packages/components/src/css/index.ts | layout | @oddkin/components/css/layout.css | No mapping verified in sampled selections. |
| Oddkin/Layout/Center | CSS layout recipe | packages/components/src/css/index.ts | layout | @oddkin/components/css/layout.css | No mapping verified in sampled selections. |
| Oddkin/Layout/AspectRatio | CSS layout recipe | packages/components/src/css/index.ts | layout | @oddkin/components/css/layout.css | No mapping verified in sampled selections. |
| Oddkin/Layout/ScrollRegion | Web component | packages/components/src/scroll-region/scroll-region.ts | OddkinScrollRegion | @oddkin/components/define/scroll-region | No mapping verified in sampled selections. |
| Oddkin/Common/calendar/Day | Internal component part | packages/components/src/calendar/calendar.template.ts | calendarTemplate | @oddkin/components/define/calendar | Source should be packages/components/src/calendar/calendar.template.ts; saved packages/components/src/calendar/calendar.ts. Export name should be calendarTemplate; saved OddkinCalendarDay. |
| Oddkin/Common/oneTimeCode/Cell | Internal component part | packages/components/src/one-time-code/one-time-code.template.ts | oneTimeCodeTemplate | @oddkin/components/define/one-time-code | Source should be packages/components/src/one-time-code/one-time-code.template.ts; saved onet-time-code.cell.template.ts. Export name should be oneTimeCodeTemplate; saved OddkinOneTimeCodeCell. |
| Oddkin/Common/color/Swatch | Internal component part | packages/components/src/color-picker/color-picker.template.ts | colorPickerTemplate | @oddkin/components/define/color-picker | Source should be packages/components/src/color-picker/color-picker.template.ts; saved packages/components/src/one-time-code/one-time-code.template.ts. Export name is blank; use colorPickerTemplate. |
| Oddkin/Common/rating/Item | Internal component part | packages/components/src/rating/rating.template.ts | ratingTemplate | @oddkin/components/define/rating | Export name is blank; use ratingTemplate. |
| Oddkin/Common/rating | Web component | packages/components/src/rating/rating.ts | OddkinRating | @oddkin/components/define/rating | Observed mapping matches source/name checks. |
| Oddkin/Common/number | Web component variation | packages/components/src/input/input.ts | OddkinInput | @oddkin/components/define/input | No mapping verified in sampled selections. |
| Oddkin/Common/stat | Web component | packages/components/src/stat/stat.ts | OddkinStat | @oddkin/components/define/stat | Observed mapping matches source/name checks. |
| Oddkin/Common/copyButton | Web component | packages/components/src/copy-button/copy-button.ts | OddkinCopyButton | @oddkin/components/define/copy-button | Observed mapping matches source/name checks. |
| Oddkin/Common/relativeTime | Web component | packages/components/src/relative-time/relative-time.ts | OddkinRelativeTime | @oddkin/components/define/relative-time | No mapping verified in sampled selections. |
| Oddkin/Common/select | Web component | packages/components/src/select/select.ts | OddkinSelect | @oddkin/components/define/select | Export name is blank; use OddkinSelect. |
| Oddkin/Common/listbox | Web component | packages/components/src/listbox/listbox.ts | OddkinListbox | @oddkin/components/define/listbox | Observed mapping matches source/name checks. |
| Oddkin/Common/combobox | Web component | packages/components/src/combobox/combobox.ts | OddkinCombobox | @oddkin/components/define/combobox | No mapping verified in sampled selections. |
| Oddkin/Common/multiselect | Web component variation | packages/components/src/combobox/combobox.ts | OddkinCombobox | @oddkin/components/define/combobox | Export name is blank; use OddkinCombobox. |
| Oddkin/Common/multiselect/Display | Internal component part | packages/components/src/collection/option-field.template.ts | valueTemplate | @oddkin/components/define/combobox | Export name should be valueTemplate; saved OddkindMultiSelectDisplay. |
| Oddkin/Common/multiselect/SelectionPanel | Internal component part | packages/components/src/collection/option-field.template.ts | selectionTemplate | @oddkin/components/define/combobox | Export name is blank; use selectionTemplate. |
| Oddkin/Common/multiselect/InteractionExamples | Design specification | No implementation verified | — | — | No mapping verified in sampled selections. |
| Oddkin/Common/multiselect/SelectedItems | Internal component part | packages/components/src/collection/option-field.template.ts | reviewTemplate | @oddkin/components/define/combobox | Export name is blank; use reviewTemplate. |
| Oddkin/Common/radioGroup | Web component | packages/components/src/radio-group/radio-group.ts | OddkinRadioGroup | @oddkin/components/define/radio-group | Observed mapping matches source/name checks. |
| Oddkin/Common/segmented | Web component | packages/components/src/segmented-control/segmented-control.ts | OddkinSegmentedControl | @oddkin/components/define/segmented-control | Observed mapping matches source/name checks. |
| Oddkin/Common/dateTime | Web component variation | packages/components/src/input/input.ts | OddkinInput | @oddkin/components/define/input | Export name should be OddkinInput; saved OddkinDateTime. |
| Oddkin/Common/fileUpload | Web component | packages/components/src/file-input/file-input.ts | OddkinFileInput | @oddkin/components/define/file-input | No mapping verified in sampled selections. |
| Oddkin/Common/CheckboxGroup | Web component | packages/components/src/checkbox-group/checkbox-group.ts | OddkinCheckboxGroup | @oddkin/components/define/checkbox-group | Export name is blank; use OddkinCheckboxGroup. |
| Oddkin/Common/ValidationSummary | Web component | packages/components/src/validation-summary/validation-summary.ts | OddkinValidationSummary | @oddkin/components/define/validation-summary | No mapping verified in sampled selections. |
| Oddkin/Common/Form | Native composition | examples/forms/index.html | — | — | Source should be examples/forms/index.html; saved packages/core/src/controllers/form.ts. |
| Oddkin/Common/Menu | Web component | packages/components/src/menu/menu.ts | OddkinMenu | @oddkin/components/define/menu | Observed mapping matches source/name checks. |
| Oddkin/Common/Tree | Web component | packages/components/src/tree/tree.ts | OddkinTree | @oddkin/components/define/tree | Observed mapping matches source/name checks. |
| Oddkin/Common/Table | CSS recipe | packages/components/src/css/index.ts | table | @oddkin/components/css/table.css | Export name should be table; saved OddkinTable. |
| Oddkin/Common/List | CSS recipe | packages/components/src/css/index.ts | list | @oddkin/components/css/list.css | Export name should be list; saved List. |
| Oddkin/Common/SideNavigation | Web component | packages/components/src/side-nav/side-nav.ts | OddkinSideNav | @oddkin/components/define/side-nav | Export name is blank; use OddkinSideNav. |
| Oddkin/Common/Breadcrumbs | Web component | packages/components/src/breadcrumbs/breadcrumbs.ts | OddkinBreadcrumbs | @oddkin/components/define/breadcrumbs | Export name is blank; use OddkinBreadcrumbs. |
| Oddkin/Common/Pagination | Web component | packages/components/src/pagination/pagination.ts | OddkinPagination | @oddkin/components/define/pagination | Export name is blank; use OddkinPagination. |
| Oddkin/Common/Tabs | Web component | packages/components/src/tabs/tabs.ts | OddkinTabs | @oddkin/components/define/tabs | Observed mapping matches source/name checks. |
| Oddkin/Common/Accordion | Web component composition | packages/components/src/disclosure/disclosure.ts | OddkinDisclosure | @oddkin/components/define/disclosure | Export name is blank; use OddkinDisclosure. |
| Oddkin/Common/Toolbar | Web component | packages/components/src/toolbar/toolbar.ts | OddkinToolbar | @oddkin/components/define/toolbar | Observed mapping matches source/name checks. |
| Oddkin/Common/splitAction | Web component | packages/components/src/split-button/split-button.ts | OddkinSplitButton | @oddkin/components/define/split-button | Export name should be OddkinSplitButton; saved OddkinSplitAction. |
| Oddkin/Common/card | Web component | packages/components/src/card/card.ts | OddkinCard | @oddkin/components/define/card | Observed mapping matches source/name checks. |
| Oddkin/Common/popover | Web component | packages/components/src/popover/popover.ts | OddkinPopover | @oddkin/components/define/popover | Observed mapping matches source/name checks. |
| Oddkin/Common/dialog | Web component | packages/components/src/dialog/dialog.ts | OddkinDialog | @oddkin/components/define/dialog | Observed mapping matches source/name checks. |
| Oddkin/Common/alertDialog | Web component variation | packages/components/src/dialog/dialog.ts | OddkinDialog | @oddkin/components/define/dialog | Source should be packages/components/src/dialog/dialog.ts; saved packages/components/src/alert/alert.ts. Export name should be OddkinDialog; saved OddkinAlert. |
| Oddkin/Common/drawer | Web component | packages/components/src/drawer/drawer.ts | OddkinDrawer | @oddkin/components/define/drawer | Observed mapping matches source/name checks. |
| Oddkin/Common/alert | Web component | packages/components/src/alert/alert.ts | OddkinAlert | @oddkin/components/define/alert | Observed mapping matches source/name checks. |
| Oddkin/Common/toast | Web component | packages/components/src/toast/toast.ts | OddkinToast | @oddkin/components/define/toast | Observed mapping matches source/name checks. |
| Oddkin/Common/emptyState | Web component | packages/components/src/empty-state/empty-state.ts | OddkinEmptyState | @oddkin/components/define/empty-state | Observed mapping matches source/name checks. |
| Oddkin/Common/CommandPalette | Web component | packages/components/src/command-palette/command-palette.ts | OddkinCommandPalette | @oddkin/components/define/command-palette | Export name is blank; use OddkinCommandPalette. |
| Oddkin/Common/GridRow | Design specification | No implementation verified | — | — | No mapping verified in sampled selections. |
| Oddkin/Common/DataGrid | Design specification | No implementation verified | — | — | No mapping verified in sampled selections. |
| Oddkin/Common/SplitPanels | Web component | packages/components/src/split-panel/split-panel.ts | OddkinSplitPanel | @oddkin/components/define/split-panel | Export name is blank; use OddkinSplitPanel. |
| Oddkin/Common/Picker | Web component | packages/components/src/picker/picker.ts | OddkinPicker | @oddkin/components/define/picker | Export name is blank; use OddkinPicker. |
| Oddkin/Common/calendar | Web component | packages/components/src/calendar/calendar.ts | OddkinCalendar | @oddkin/components/define/calendar | Observed mapping matches source/name checks. |
| Oddkin/Common/datePicker | Web component | packages/components/src/date-picker/date-picker.ts | OddkinDatePicker | @oddkin/components/define/date-picker | Observed mapping matches source/name checks. |
| Oddkin/Common/colorPicker | Web component | packages/components/src/color-picker/color-picker.ts | OddkinColorPicker | @oddkin/components/define/color-picker | Observed mapping matches source/name checks. |
| Oddkin/Common/oneTimeCode | Web component | packages/components/src/one-time-code/one-time-code.ts | OddkinOneTimeCode | @oddkin/components/define/one-time-code | Observed mapping matches source/name checks. |
| Oddkin/Common/stepper | CSS recipe | packages/components/src/css/index.ts | stepper | @oddkin/components/css/stepper.css | Export name is blank; use stepper. |
| Oddkin/Common/timeline | CSS recipe | packages/components/src/css/index.ts | timeline | @oddkin/components/css/timeline.css | Export name is blank; use timeline. |
| Oddkin/Common/descriptionList | CSS recipe | packages/components/src/css/index.ts | descriptionList | @oddkin/components/css/description-list.css | Export name is blank; use descriptionList. |
| Oddkin/Common/carousel | Design specification | No implementation verified | — | — | No mapping verified in sampled selections. |
| Oddkin/Common/hoverCard | Design specification | No implementation verified | — | — | Connection exists for an asset without a verified implementation. |
| Oddkin/Common/contextMenu | Design specification | No implementation verified | — | — | No mapping verified in sampled selections. |
| Oddkin/Common/appHeader | Design specification | No implementation verified | — | — | No mapping verified in sampled selections. |

## MCP instruction text

### Oddkin/Common/button

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/button.
Repository source: packages/components/src/button/button.ts.
Code Connect export/name: OddkinButton.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/button';
import '@oddkin/components/define/button';
<odd-button></odd-button>
Optional side-effect-free class import: import { OddkinButton } from '@oddkin/components/button'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/iconButton

```text
ODDKIN IMPLEMENTATION TYPE: Web component variation.
Figma asset: Oddkin/Common/iconButton.
Repository source: packages/components/src/button/button.ts.
Code Connect export/name: OddkinButton.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/button';
import '@oddkin/components/define/button';
<odd-button></odd-button>
Optional side-effect-free class import: import { OddkinButton } from '@oddkin/components/button'; this class import alone does not register the tag. Provide an accessible label on odd-button. This Figma family is a variation/configuration of its parent element, not a separate registered tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/toggleButton

```text
ODDKIN IMPLEMENTATION TYPE: Web component variation.
Figma asset: Oddkin/Common/toggleButton.
Repository source: packages/components/src/button/button.ts.
Code Connect export/name: OddkinButton.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/button';
import '@oddkin/components/define/button';
<odd-button></odd-button>
Optional side-effect-free class import: import { OddkinButton } from '@oddkin/components/button'; this class import alone does not register the tag. Set toggle and pressed on odd-button. This Figma family is a variation/configuration of its parent element, not a separate registered tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/link

```text
ODDKIN IMPLEMENTATION TYPE: CSS recipe.
Figma asset: Oddkin/Common/link.
Repository source: packages/components/src/css/index.ts.
Code Connect export/name: link.
CSS IMPORT: import '@oddkin/components/css/link.css';
`a.odd-link`: link colour, an underline on hover, and the shared keyboard focus ring.
This is native HTML plus a stylesheet. Do not generate a fictional Oddkin class, custom-element tag, component registration, or TypeScript component import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/badge

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/badge.
Repository source: packages/components/src/badge/badge.ts.
Code Connect export/name: OddkinBadge.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/badge';
import '@oddkin/components/define/badge';
<odd-badge></odd-badge>
Optional side-effect-free class import: import { OddkinBadge } from '@oddkin/components/badge'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/chip

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/chip.
Repository source: packages/components/src/chip/chip.ts.
Code Connect export/name: OddkinChip.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/chip';
import '@oddkin/components/define/chip';
<odd-chip></odd-chip>
Optional side-effect-free class import: import { OddkinChip } from '@oddkin/components/chip'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/button/sm

```text
ODDKIN IMPLEMENTATION TYPE: Web component variation.
Figma asset: Oddkin/Common/button/sm.
Repository source: packages/components/src/button/button.ts.
Code Connect export/name: OddkinButton.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/button';
import '@oddkin/components/define/button';
<odd-button></odd-button>
Optional side-effect-free class import: import { OddkinButton } from '@oddkin/components/button'; this class import alone does not register the tag. This Figma family is a variation/configuration of its parent element, not a separate registered tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/button/lg

```text
ODDKIN IMPLEMENTATION TYPE: Web component variation.
Figma asset: Oddkin/Common/button/lg.
Repository source: packages/components/src/button/button.ts.
Code Connect export/name: OddkinButton.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/button';
import '@oddkin/components/define/button';
<odd-button></odd-button>
Optional side-effect-free class import: import { OddkinButton } from '@oddkin/components/button'; this class import alone does not register the tag. This Figma family is a variation/configuration of its parent element, not a separate registered tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/field

```text
ODDKIN IMPLEMENTATION TYPE: CSS recipe.
Figma asset: Oddkin/Common/field.
Repository source: packages/components/src/css/index.ts.
Code Connect export/name: field.
CSS IMPORT: import '@oddkin/components/css/field.css';
`.odd-field`: the field anatomy for native and third-party controls (`.odd-field-label`, `.odd-field-description`, `.odd-field-control`, `.odd-field-error`), generated from the rules of Oddkin's form controls, with the same `--odd-field-*` variables. The author wires `<label for>`, `aria-describedby`, and `aria-invalid`.
This is native HTML plus a stylesheet. Do not generate a fictional Oddkin class, custom-element tag, component registration, or TypeScript component import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/input

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/input.
Repository source: packages/components/src/input/input.ts.
Code Connect export/name: OddkinInput.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/input';
import '@oddkin/components/define/input';
<odd-input></odd-input>
Optional side-effect-free class import: import { OddkinInput } from '@oddkin/components/input'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/textarea

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/textarea.
Repository source: packages/components/src/textarea/textarea.ts.
Code Connect export/name: OddkinTextarea.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/textarea';
import '@oddkin/components/define/textarea';
<odd-textarea></odd-textarea>
Optional side-effect-free class import: import { OddkinTextarea } from '@oddkin/components/textarea'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/search

```text
ODDKIN IMPLEMENTATION TYPE: Web component variation.
Figma asset: Oddkin/Common/search.
Repository source: packages/components/src/input/input.ts.
Code Connect export/name: OddkinInput.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/input';
import '@oddkin/components/define/input';
<odd-input></odd-input>
Optional side-effect-free class import: import { OddkinInput } from '@oddkin/components/input'; this class import alone does not register the tag. Set type="search" on odd-input. This Figma family is a variation/configuration of its parent element, not a separate registered tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/checkbox

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/checkbox.
Repository source: packages/components/src/checkbox/checkbox.ts.
Code Connect export/name: OddkinCheckbox.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/checkbox';
import '@oddkin/components/define/checkbox';
<odd-checkbox></odd-checkbox>
Optional side-effect-free class import: import { OddkinCheckbox } from '@oddkin/components/checkbox'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/radio

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part.
Figma asset: Oddkin/Common/radio.
Repository source: packages/components/src/form-control/radio-input.ts.
Code Connect export/name: radioInput.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/radio-group';
Use <odd-radio-group> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import.
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/switch

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/switch.
Repository source: packages/components/src/switch/switch.ts.
Code Connect export/name: OddkinSwitch.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/switch';
import '@oddkin/components/define/switch';
<odd-switch></odd-switch>
Optional side-effect-free class import: import { OddkinSwitch } from '@oddkin/components/switch'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/slider

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/slider.
Repository source: packages/components/src/slider/slider.ts.
Code Connect export/name: OddkinSlider.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/slider';
import '@oddkin/components/define/slider';
<odd-slider></odd-slider>
Optional side-effect-free class import: import { OddkinSlider } from '@oddkin/components/slider'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/ListboxSurface

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part.
Figma asset: Oddkin/Common/ListboxSurface.
Repository source: packages/components/src/collection/option-rows.template.ts.
Code Connect export/name: optionListTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/listbox';
Use <odd-listbox> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import.
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/ListboxOption

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part.
Figma asset: Oddkin/Common/ListboxOption.
Repository source: packages/components/src/collection/option-rows.template.ts.
Code Connect export/name: optionListTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/listbox';
Use <odd-listbox> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import.
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/CheckboxOption

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part.
Figma asset: Oddkin/Common/CheckboxOption.
Repository source: packages/components/src/collection/option-rows.template.ts.
Code Connect export/name: optionListTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/combobox';
Use <odd-combobox> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import.
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/MenuItem

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part.
Figma asset: Oddkin/Common/MenuItem.
Repository source: packages/components/src/menu/menu.template.ts.
Code Connect export/name: menuTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/menu';
Use <odd-menu> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import.
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/NavigationItem

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part.
Figma asset: Oddkin/Common/NavigationItem.
Repository source: packages/components/src/side-nav/side-nav.template.ts.
Code Connect export/name: sideNavTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/side-nav';
Use <odd-side-nav> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import.
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/CommandItem

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part.
Figma asset: Oddkin/Common/CommandItem.
Repository source: packages/components/src/command-palette/command-palette.template.ts.
Code Connect export/name: commandPaletteTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/command-palette';
Use <odd-command-palette> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import.
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/Disclosure

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/Disclosure.
Repository source: packages/components/src/disclosure/disclosure.ts.
Code Connect export/name: OddkinDisclosure.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/disclosure';
import '@oddkin/components/define/disclosure';
<odd-disclosure></odd-disclosure>
Optional side-effect-free class import: import { OddkinDisclosure } from '@oddkin/components/disclosure'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/tooltip

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/tooltip.
Repository source: packages/components/src/tooltip/tooltip.ts.
Code Connect export/name: OddkinTooltip.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/tooltip';
import '@oddkin/components/define/tooltip';
<odd-tooltip></odd-tooltip>
Optional side-effect-free class import: import { OddkinTooltip } from '@oddkin/components/tooltip'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/progress

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/progress.
Repository source: packages/components/src/progress/progress.ts.
Code Connect export/name: OddkinProgress.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/progress';
import '@oddkin/components/define/progress';
<odd-progress></odd-progress>
Optional side-effect-free class import: import { OddkinProgress } from '@oddkin/components/progress'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/spinner

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/spinner.
Repository source: packages/components/src/spinner/spinner.ts.
Code Connect export/name: OddkinSpinner.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/spinner';
import '@oddkin/components/define/spinner';
<odd-spinner></odd-spinner>
Optional side-effect-free class import: import { OddkinSpinner } from '@oddkin/components/spinner'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/skeleton

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/skeleton.
Repository source: packages/components/src/skeleton/skeleton.ts.
Code Connect export/name: OddkinSkeleton.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/skeleton';
import '@oddkin/components/define/skeleton';
<odd-skeleton></odd-skeleton>
Optional side-effect-free class import: import { OddkinSkeleton } from '@oddkin/components/skeleton'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/avatar

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/avatar.
Repository source: packages/components/src/avatar/avatar.ts.
Code Connect export/name: OddkinAvatar.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/avatar';
import '@oddkin/components/define/avatar';
<odd-avatar></odd-avatar>
Optional side-effect-free class import: import { OddkinAvatar } from '@oddkin/components/avatar'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/icon

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/icon.
Repository source: packages/components/src/icon/icon.ts.
Code Connect export/name: OddkinIcon.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/icon';
import '@oddkin/components/define/icon';
<odd-icon></odd-icon>
Optional side-effect-free class import: import { OddkinIcon } from '@oddkin/components/icon'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/divider

```text
ODDKIN IMPLEMENTATION TYPE: CSS recipe.
Figma asset: Oddkin/Common/divider.
Repository source: packages/components/src/css/index.ts.
Code Connect export/name: divider.
CSS IMPORT: import '@oddkin/components/css/divider.css';
`hr.odd-divider`, or a labelled `.odd-divider` ("or") the author gives `role="separator"`.
This is native HTML plus a stylesheet. Do not generate a fictional Oddkin class, custom-element tag, component registration, or TypeScript component import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/typography

```text
ODDKIN IMPLEMENTATION TYPE: CSS recipe.
Figma asset: Oddkin/Common/typography.
Repository source: packages/components/src/css/index.ts.
Code Connect export/name: typography.
CSS IMPORT: import '@oddkin/components/css/typography.css';
`.odd-type-<role>`: the eight type roles (`display`, `title`, `section`, `body`, `ui`, `small`, `eyebrow`, `code`) on any element; native `h1`–`h6` and `p` keep their semantics.
This is native HTML plus a stylesheet. Do not generate a fictional Oddkin class, custom-element tag, component registration, or TypeScript component import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/keyboardKey

```text
ODDKIN IMPLEMENTATION TYPE: CSS recipe.
Figma asset: Oddkin/Common/keyboardKey.
Repository source: packages/components/src/css/index.ts.
Code Connect export/name: kbd.
CSS IMPORT: import '@oddkin/components/css/kbd.css';
`kbd.odd-kbd`: a key cap that does not look clickable; sequences are adjacent keys.
This is native HTML plus a stylesheet. Do not generate a fictional Oddkin class, custom-element tag, component registration, or TypeScript component import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/avatar/Appearance

```text
ODDKIN IMPLEMENTATION TYPE: Web component variation.
Figma asset: Oddkin/Common/avatar/Appearance.
Repository source: packages/components/src/avatar/avatar.ts.
Code Connect export/name: OddkinAvatar.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/avatar';
import '@oddkin/components/define/avatar';
<odd-avatar></odd-avatar>
Optional side-effect-free class import: import { OddkinAvatar } from '@oddkin/components/avatar'; this class import alone does not register the tag. This Figma family is a variation/configuration of its parent element, not a separate registered tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/multiselect/Value/chips

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part variation.
Figma asset: Oddkin/Common/multiselect/Value/chips.
Repository source: packages/components/src/collection/option-field.template.ts.
Code Connect export/name: valueTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/combobox';
Use <odd-combobox> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import. Set multiple and view="chips".
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/multiselect/Value/count

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part variation.
Figma asset: Oddkin/Common/multiselect/Value/count.
Repository source: packages/components/src/collection/option-field.template.ts.
Code Connect export/name: valueTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/combobox';
Use <odd-combobox> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import. Set multiple and view="count".
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/multiselect/Value/text

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part variation.
Figma asset: Oddkin/Common/multiselect/Value/text.
Repository source: packages/components/src/collection/option-field.template.ts.
Code Connect export/name: valueTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/combobox';
Use <odd-combobox> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import. Set multiple and view="text".
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/multiselect/Value/auto

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part variation.
Figma asset: Oddkin/Common/multiselect/Value/auto.
Repository source: packages/components/src/collection/option-field.template.ts.
Code Connect export/name: valueTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/combobox';
Use <odd-combobox> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import. Set multiple and view="auto".
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/multiselect/Value/expandable

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part variation.
Figma asset: Oddkin/Common/multiselect/Value/expandable.
Repository source: packages/components/src/collection/option-field.template.ts.
Code Connect export/name: valueTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/combobox';
Use <odd-combobox> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import. Set multiple and view="expandable".
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/multiselect/Value/avatars

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part variation.
Figma asset: Oddkin/Common/multiselect/Value/avatars.
Repository source: packages/components/src/collection/option-field.template.ts.
Code Connect export/name: valueTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/combobox';
Use <odd-combobox> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import. Set multiple and view="avatars".
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/multiselect/Value/grouped

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part variation.
Figma asset: Oddkin/Common/multiselect/Value/grouped.
Repository source: packages/components/src/collection/option-field.template.ts.
Code Connect export/name: valueTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/combobox';
Use <odd-combobox> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import. Set multiple and view="grouped".
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/multiselect/Field

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part.
Figma asset: Oddkin/Common/multiselect/Field.
Repository source: packages/components/src/combobox/combobox.template.ts.
Code Connect export/name: comboboxTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/combobox';
Use <odd-combobox> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import.
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/AvatarItem

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part.
Figma asset: Oddkin/Common/AvatarItem.
Repository source: packages/components/src/avatar/avatar.ts.
Code Connect export/name: OddkinAvatar.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/avatar';
Use <odd-avatar> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import.
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/GridCell

```text
ODDKIN IMPLEMENTATION TYPE: Design specification.
Figma asset: Oddkin/Common/GridCell.
Implementation: design-only; no verified public component.
No corresponding implementation verified. Do not invent an element or import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/GridColumnHeader

```text
ODDKIN IMPLEMENTATION TYPE: Design specification.
Figma asset: Oddkin/Common/GridColumnHeader.
Implementation: design-only; no verified public component.
No corresponding implementation verified. Do not invent an element or import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/GridSelection

```text
ODDKIN IMPLEMENTATION TYPE: Design specification.
Figma asset: Oddkin/Common/GridSelection.
Implementation: design-only; no verified public component.
No corresponding implementation verified. Do not invent an element or import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/Splitter/vertical

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part.
Figma asset: Oddkin/Common/Splitter/vertical.
Repository source: packages/components/src/split-panel/split-panel.template.ts.
Code Connect export/name: splitPanelTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/split-panel';
Use <odd-split-panel> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import.
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/Splitter/horizontal

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part.
Figma asset: Oddkin/Common/Splitter/horizontal.
Repository source: packages/components/src/split-panel/split-panel.template.ts.
Code Connect export/name: splitPanelTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/split-panel';
Use <odd-split-panel> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import.
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Layout/SpecimenItem

```text
ODDKIN IMPLEMENTATION TYPE: Design specimen.
Figma asset: Oddkin/Layout/SpecimenItem.
Implementation: design-only; no verified public component.
No corresponding implementation verified. Do not invent an element or import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Layout/Box

```text
ODDKIN IMPLEMENTATION TYPE: CSS layout recipe.
Figma asset: Oddkin/Layout/Box.
Repository source: packages/components/src/css/index.ts.
Code Connect export/name: layout.
CSS IMPORT: import '@oddkin/components/css/layout.css';
<div class="odd-box">...</div>
This is native HTML plus a stylesheet. Do not generate a fictional Oddkin class, custom-element tag, component registration, or TypeScript component import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Layout/Container

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Layout/Container.
Repository source: packages/components/src/container/container.ts.
Code Connect export/name: OddkinContainer.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/container';
import '@oddkin/components/define/container';
<odd-container></odd-container>
Optional side-effect-free class import: import { OddkinContainer } from '@oddkin/components/container'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Layout/Stack

```text
ODDKIN IMPLEMENTATION TYPE: CSS layout recipe.
Figma asset: Oddkin/Layout/Stack.
Repository source: packages/components/src/css/index.ts.
Code Connect export/name: layout.
CSS IMPORT: import '@oddkin/components/css/layout.css';
<div class="odd-stack">...</div>
Optional CSS helper: import { stack } from '@oddkin/components/layout'; Optional programmatic CSS helper; does not register an element.
This is native HTML plus a stylesheet. Do not generate a fictional Oddkin class, custom-element tag, component registration, or TypeScript component import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Layout/Row

```text
ODDKIN IMPLEMENTATION TYPE: CSS layout recipe.
Figma asset: Oddkin/Layout/Row.
Repository source: packages/components/src/css/index.ts.
Code Connect export/name: layout.
CSS IMPORT: import '@oddkin/components/css/layout.css';
<div class="odd-row">...</div>
Optional CSS helper: import { row } from '@oddkin/components/layout'; Optional programmatic CSS helper; does not register an element.
This is native HTML plus a stylesheet. Do not generate a fictional Oddkin class, custom-element tag, component registration, or TypeScript component import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Layout/Cluster

```text
ODDKIN IMPLEMENTATION TYPE: CSS layout recipe.
Figma asset: Oddkin/Layout/Cluster.
Repository source: packages/components/src/css/index.ts.
Code Connect export/name: layout.
CSS IMPORT: import '@oddkin/components/css/layout.css';
<div class="odd-cluster">...</div>
Optional CSS helper: import { row } from '@oddkin/components/layout'; row({wrap:true})
This is native HTML plus a stylesheet. Do not generate a fictional Oddkin class, custom-element tag, component registration, or TypeScript component import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Layout/Grid

```text
ODDKIN IMPLEMENTATION TYPE: CSS layout recipe.
Figma asset: Oddkin/Layout/Grid.
Repository source: packages/components/src/css/index.ts.
Code Connect export/name: layout.
CSS IMPORT: import '@oddkin/components/css/layout.css';
<div class="odd-grid">...</div>
Optional CSS helper: import { grid } from '@oddkin/components/layout'; Optional programmatic CSS helper; does not register an element.
This is native HTML plus a stylesheet. Do not generate a fictional Oddkin class, custom-element tag, component registration, or TypeScript component import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Layout/AutoGrid

```text
ODDKIN IMPLEMENTATION TYPE: CSS layout recipe.
Figma asset: Oddkin/Layout/AutoGrid.
Repository source: packages/components/src/css/index.ts.
Code Connect export/name: layout.
CSS IMPORT: import '@oddkin/components/css/layout.css';
<div class="odd-auto-grid">...</div>
Optional CSS helper: import { autoGrid } from '@oddkin/components/layout'; Optional programmatic CSS helper; does not register an element.
This is native HTML plus a stylesheet. Do not generate a fictional Oddkin class, custom-element tag, component registration, or TypeScript component import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Layout/Split

```text
ODDKIN IMPLEMENTATION TYPE: CSS layout recipe.
Figma asset: Oddkin/Layout/Split.
Repository source: packages/components/src/css/index.ts.
Code Connect export/name: layout.
CSS IMPORT: import '@oddkin/components/css/layout.css';
<div class="odd-split">...</div>
Optional CSS helper: import { split } from '@oddkin/components/layout'; Optional programmatic CSS helper; does not register an element.
This is native HTML plus a stylesheet. Do not generate a fictional Oddkin class, custom-element tag, component registration, or TypeScript component import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Layout/Center

```text
ODDKIN IMPLEMENTATION TYPE: CSS layout recipe.
Figma asset: Oddkin/Layout/Center.
Repository source: packages/components/src/css/index.ts.
Code Connect export/name: layout.
CSS IMPORT: import '@oddkin/components/css/layout.css';
<div class="odd-center">...</div>
This is native HTML plus a stylesheet. Do not generate a fictional Oddkin class, custom-element tag, component registration, or TypeScript component import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Layout/AspectRatio

```text
ODDKIN IMPLEMENTATION TYPE: CSS layout recipe.
Figma asset: Oddkin/Layout/AspectRatio.
Repository source: packages/components/src/css/index.ts.
Code Connect export/name: layout.
CSS IMPORT: import '@oddkin/components/css/layout.css';
<div class="odd-aspect-ratio">...</div>
This is native HTML plus a stylesheet. Do not generate a fictional Oddkin class, custom-element tag, component registration, or TypeScript component import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Layout/ScrollRegion

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Layout/ScrollRegion.
Repository source: packages/components/src/scroll-region/scroll-region.ts.
Code Connect export/name: OddkinScrollRegion.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/scroll-region';
import '@oddkin/components/define/scroll-region';
<odd-scroll-region></odd-scroll-region>
Optional side-effect-free class import: import { OddkinScrollRegion } from '@oddkin/components/scroll-region'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/calendar/Day

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part.
Figma asset: Oddkin/Common/calendar/Day.
Repository source: packages/components/src/calendar/calendar.template.ts.
Code Connect export/name: calendarTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/calendar';
Use <odd-calendar> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import.
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/oneTimeCode/Cell

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part.
Figma asset: Oddkin/Common/oneTimeCode/Cell.
Repository source: packages/components/src/one-time-code/one-time-code.template.ts.
Code Connect export/name: oneTimeCodeTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/one-time-code';
Use <odd-one-time-code> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import.
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/color/Swatch

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part.
Figma asset: Oddkin/Common/color/Swatch.
Repository source: packages/components/src/color-picker/color-picker.template.ts.
Code Connect export/name: colorPickerTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/color-picker';
Use <odd-color-picker> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import.
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/rating/Item

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part.
Figma asset: Oddkin/Common/rating/Item.
Repository source: packages/components/src/rating/rating.template.ts.
Code Connect export/name: ratingTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/rating';
Use <odd-rating> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import.
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/rating

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/rating.
Repository source: packages/components/src/rating/rating.ts.
Code Connect export/name: OddkinRating.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/rating';
import '@oddkin/components/define/rating';
<odd-rating></odd-rating>
Optional side-effect-free class import: import { OddkinRating } from '@oddkin/components/rating'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/number

```text
ODDKIN IMPLEMENTATION TYPE: Web component variation.
Figma asset: Oddkin/Common/number.
Repository source: packages/components/src/input/input.ts.
Code Connect export/name: OddkinInput.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/input';
import '@oddkin/components/define/input';
<odd-input></odd-input>
Optional side-effect-free class import: import { OddkinInput } from '@oddkin/components/input'; this class import alone does not register the tag. Set type="number" on odd-input. This Figma family is a variation/configuration of its parent element, not a separate registered tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/stat

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/stat.
Repository source: packages/components/src/stat/stat.ts.
Code Connect export/name: OddkinStat.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/stat';
import '@oddkin/components/define/stat';
<odd-stat></odd-stat>
Optional side-effect-free class import: import { OddkinStat } from '@oddkin/components/stat'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/copyButton

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/copyButton.
Repository source: packages/components/src/copy-button/copy-button.ts.
Code Connect export/name: OddkinCopyButton.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/copy-button';
import '@oddkin/components/define/copy-button';
<odd-copy-button></odd-copy-button>
Optional side-effect-free class import: import { OddkinCopyButton } from '@oddkin/components/copy-button'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/relativeTime

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/relativeTime.
Repository source: packages/components/src/relative-time/relative-time.ts.
Code Connect export/name: OddkinRelativeTime.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/relative-time';
import '@oddkin/components/define/relative-time';
<odd-relative-time></odd-relative-time>
Optional side-effect-free class import: import { OddkinRelativeTime } from '@oddkin/components/relative-time'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/select

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/select.
Repository source: packages/components/src/select/select.ts.
Code Connect export/name: OddkinSelect.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/select';
import '@oddkin/components/define/select';
<odd-select></odd-select>
Optional side-effect-free class import: import { OddkinSelect } from '@oddkin/components/select'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/listbox

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/listbox.
Repository source: packages/components/src/listbox/listbox.ts.
Code Connect export/name: OddkinListbox.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/listbox';
import '@oddkin/components/define/listbox';
<odd-listbox></odd-listbox>
Optional side-effect-free class import: import { OddkinListbox } from '@oddkin/components/listbox'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/combobox

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/combobox.
Repository source: packages/components/src/combobox/combobox.ts.
Code Connect export/name: OddkinCombobox.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/combobox';
import '@oddkin/components/define/combobox';
<odd-combobox></odd-combobox>
Optional side-effect-free class import: import { OddkinCombobox } from '@oddkin/components/combobox'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/multiselect

```text
ODDKIN IMPLEMENTATION TYPE: Web component variation.
Figma asset: Oddkin/Common/multiselect.
Repository source: packages/components/src/combobox/combobox.ts.
Code Connect export/name: OddkinCombobox.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/combobox';
import '@oddkin/components/define/combobox';
<odd-combobox></odd-combobox>
Optional side-effect-free class import: import { OddkinCombobox } from '@oddkin/components/combobox'; this class import alone does not register the tag. Set multiple on odd-combobox.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/multiselect/Display

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part.
Figma asset: Oddkin/Common/multiselect/Display.
Repository source: packages/components/src/collection/option-field.template.ts.
Code Connect export/name: valueTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/combobox';
Use <odd-combobox> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import.
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/multiselect/SelectionPanel

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part.
Figma asset: Oddkin/Common/multiselect/SelectionPanel.
Repository source: packages/components/src/collection/option-field.template.ts.
Code Connect export/name: selectionTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/combobox';
Use <odd-combobox> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import. Inline review uses multiple, review and select-all; Tabbed, Dual pane and Unified arrangements need author composition.
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/multiselect/InteractionExamples

```text
ODDKIN IMPLEMENTATION TYPE: Design specification.
Figma asset: Oddkin/Common/multiselect/InteractionExamples.
Implementation: design-only; no verified public component.
No corresponding implementation verified. Do not invent an element or import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/multiselect/SelectedItems

```text
ODDKIN IMPLEMENTATION TYPE: Internal component part.
Figma asset: Oddkin/Common/multiselect/SelectedItems.
Repository source: packages/components/src/collection/option-field.template.ts.
Code Connect export/name: reviewTemplate.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/combobox';
Use <odd-combobox> through its public properties and parts. The source renderer is implementation detail, not a separate custom element or public deep import. Set multiple and view="expandable".
Do not import packages/components/src/... into application code; import and configure the public parent component above.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/radioGroup

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/radioGroup.
Repository source: packages/components/src/radio-group/radio-group.ts.
Code Connect export/name: OddkinRadioGroup.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/radio-group';
import '@oddkin/components/define/radio-group';
<odd-radio-group></odd-radio-group>
Optional side-effect-free class import: import { OddkinRadioGroup } from '@oddkin/components/radio-group'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/segmented

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/segmented.
Repository source: packages/components/src/segmented-control/segmented-control.ts.
Code Connect export/name: OddkinSegmentedControl.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/segmented-control';
import '@oddkin/components/define/segmented-control';
<odd-segmented-control></odd-segmented-control>
Optional side-effect-free class import: import { OddkinSegmentedControl } from '@oddkin/components/segmented-control'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/dateTime

```text
ODDKIN IMPLEMENTATION TYPE: Web component variation.
Figma asset: Oddkin/Common/dateTime.
Repository source: packages/components/src/input/input.ts.
Code Connect export/name: OddkinInput.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/input';
import '@oddkin/components/define/input';
<odd-input></odd-input>
Optional side-effect-free class import: import { OddkinInput } from '@oddkin/components/input'; this class import alone does not register the tag. Set type="datetime-local" on odd-input. This Figma family is a variation/configuration of its parent element, not a separate registered tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/fileUpload

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/fileUpload.
Repository source: packages/components/src/file-input/file-input.ts.
Code Connect export/name: OddkinFileInput.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/file-input';
import '@oddkin/components/define/file-input';
<odd-file-input></odd-file-input>
Optional side-effect-free class import: import { OddkinFileInput } from '@oddkin/components/file-input'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/CheckboxGroup

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/CheckboxGroup.
Repository source: packages/components/src/checkbox-group/checkbox-group.ts.
Code Connect export/name: OddkinCheckboxGroup.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/checkbox-group';
import '@oddkin/components/define/checkbox-group';
<odd-checkbox-group></odd-checkbox-group>
Optional side-effect-free class import: import { OddkinCheckboxGroup } from '@oddkin/components/checkbox-group'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/ValidationSummary

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/ValidationSummary.
Repository source: packages/components/src/validation-summary/validation-summary.ts.
Code Connect export/name: OddkinValidationSummary.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/validation-summary';
import '@oddkin/components/define/validation-summary';
<odd-validation-summary></odd-validation-summary>
Optional side-effect-free class import: import { OddkinValidationSummary } from '@oddkin/components/validation-summary'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/Form

```text
ODDKIN IMPLEMENTATION TYPE: Native composition.
Figma asset: Oddkin/Common/Form.
Repository source: examples/forms/index.html.
Use a native <form> with registered Oddkin controls, CSS layout classes, and validation summary. There is no OddkinForm element. The FormValue controller is not a Form component.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/Menu

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/Menu.
Repository source: packages/components/src/menu/menu.ts.
Code Connect export/name: OddkinMenu.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/menu';
import '@oddkin/components/define/menu';
<odd-menu></odd-menu>
Optional side-effect-free class import: import { OddkinMenu } from '@oddkin/components/menu'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/Tree

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/Tree.
Repository source: packages/components/src/tree/tree.ts.
Code Connect export/name: OddkinTree.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/tree';
import '@oddkin/components/define/tree';
<odd-tree></odd-tree>
Optional side-effect-free class import: import { OddkinTree } from '@oddkin/components/tree'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/Table

```text
ODDKIN IMPLEMENTATION TYPE: CSS recipe.
Figma asset: Oddkin/Common/Table.
Repository source: packages/components/src/css/index.ts.
Code Connect export/name: table.
CSS IMPORT: import '@oddkin/components/css/table.css';
`table.odd-table`: a native table on a bordered surface; header cells on the sunken surface, rows divided by rules, `aria-sort` headers in the primary colour, and a row holding a checked checkbox in the selection colours.
This is native HTML plus a stylesheet. Do not generate a fictional Oddkin class, custom-element tag, component registration, or TypeScript component import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/List

```text
ODDKIN IMPLEMENTATION TYPE: CSS recipe.
Figma asset: Oddkin/Common/List.
Repository source: packages/components/src/css/index.ts.
Code Connect export/name: list.
CSS IMPORT: import '@oddkin/components/css/list.css';
`ul.odd-list` / `ol.odd-list`: rows on a bordered surface, divided by rules; `.odd-list-meta` for secondary text; the item with `aria-current` takes the selection colours.
This is native HTML plus a stylesheet. Do not generate a fictional Oddkin class, custom-element tag, component registration, or TypeScript component import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/SideNavigation

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/SideNavigation.
Repository source: packages/components/src/side-nav/side-nav.ts.
Code Connect export/name: OddkinSideNav.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/side-nav';
import '@oddkin/components/define/side-nav';
<odd-side-nav></odd-side-nav>
Optional side-effect-free class import: import { OddkinSideNav } from '@oddkin/components/side-nav'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/Breadcrumbs

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/Breadcrumbs.
Repository source: packages/components/src/breadcrumbs/breadcrumbs.ts.
Code Connect export/name: OddkinBreadcrumbs.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/breadcrumbs';
import '@oddkin/components/define/breadcrumbs';
<odd-breadcrumbs></odd-breadcrumbs>
Optional side-effect-free class import: import { OddkinBreadcrumbs } from '@oddkin/components/breadcrumbs'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/Pagination

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/Pagination.
Repository source: packages/components/src/pagination/pagination.ts.
Code Connect export/name: OddkinPagination.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/pagination';
import '@oddkin/components/define/pagination';
<odd-pagination></odd-pagination>
Optional side-effect-free class import: import { OddkinPagination } from '@oddkin/components/pagination'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/Tabs

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/Tabs.
Repository source: packages/components/src/tabs/tabs.ts.
Code Connect export/name: OddkinTabs.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/tabs';
import '@oddkin/components/define/tabs';
<odd-tabs></odd-tabs>
Optional side-effect-free class import: import { OddkinTabs } from '@oddkin/components/tabs'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/Accordion

```text
ODDKIN IMPLEMENTATION TYPE: Web component composition.
Figma asset: Oddkin/Common/Accordion.
Repository source: packages/components/src/disclosure/disclosure.ts.
Code Connect export/name: OddkinDisclosure.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/disclosure';
import '@oddkin/components/define/disclosure';
<odd-disclosure></odd-disclosure>
Optional side-effect-free class import: import { OddkinDisclosure } from '@oddkin/components/disclosure'; this class import alone does not register the tag. Use several odd-disclosure elements with the same name attribute.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/Toolbar

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/Toolbar.
Repository source: packages/components/src/toolbar/toolbar.ts.
Code Connect export/name: OddkinToolbar.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/toolbar';
import '@oddkin/components/define/toolbar';
<odd-toolbar></odd-toolbar>
Optional side-effect-free class import: import { OddkinToolbar } from '@oddkin/components/toolbar'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/splitAction

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/splitAction.
Repository source: packages/components/src/split-button/split-button.ts.
Code Connect export/name: OddkinSplitButton.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/split-button';
import '@oddkin/components/define/split-button';
<odd-split-button></odd-split-button>
Optional side-effect-free class import: import { OddkinSplitButton } from '@oddkin/components/split-button'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/card

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/card.
Repository source: packages/components/src/card/card.ts.
Code Connect export/name: OddkinCard.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/card';
import '@oddkin/components/define/card';
<odd-card></odd-card>
Optional side-effect-free class import: import { OddkinCard } from '@oddkin/components/card'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/popover

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/popover.
Repository source: packages/components/src/popover/popover.ts.
Code Connect export/name: OddkinPopover.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/popover';
import '@oddkin/components/define/popover';
<odd-popover></odd-popover>
Optional side-effect-free class import: import { OddkinPopover } from '@oddkin/components/popover'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/dialog

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/dialog.
Repository source: packages/components/src/dialog/dialog.ts.
Code Connect export/name: OddkinDialog.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/dialog';
import '@oddkin/components/define/dialog';
<odd-dialog></odd-dialog>
Optional side-effect-free class import: import { OddkinDialog } from '@oddkin/components/dialog'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/alertDialog

```text
ODDKIN IMPLEMENTATION TYPE: Web component variation.
Figma asset: Oddkin/Common/alertDialog.
Repository source: packages/components/src/dialog/dialog.ts.
Code Connect export/name: OddkinDialog.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/dialog';
import '@oddkin/components/define/dialog';
<odd-dialog></odd-dialog>
Optional side-effect-free class import: import { OddkinDialog } from '@oddkin/components/dialog'; this class import alone does not register the tag. Set alert on odd-dialog. This Figma family is a variation/configuration of its parent element, not a separate registered tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/drawer

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/drawer.
Repository source: packages/components/src/drawer/drawer.ts.
Code Connect export/name: OddkinDrawer.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/drawer';
import '@oddkin/components/define/drawer';
<odd-drawer></odd-drawer>
Optional side-effect-free class import: import { OddkinDrawer } from '@oddkin/components/drawer'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/alert

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/alert.
Repository source: packages/components/src/alert/alert.ts.
Code Connect export/name: OddkinAlert.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/alert';
import '@oddkin/components/define/alert';
<odd-alert></odd-alert>
Optional side-effect-free class import: import { OddkinAlert } from '@oddkin/components/alert'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/toast

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/toast.
Repository source: packages/components/src/toast/toast.ts.
Code Connect export/name: OddkinToast.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/toast';
import '@oddkin/components/define/toast';
<odd-toast></odd-toast>
Optional side-effect-free class import: import { OddkinToast } from '@oddkin/components/toast'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/emptyState

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/emptyState.
Repository source: packages/components/src/empty-state/empty-state.ts.
Code Connect export/name: OddkinEmptyState.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/empty-state';
import '@oddkin/components/define/empty-state';
<odd-empty-state></odd-empty-state>
Optional side-effect-free class import: import { OddkinEmptyState } from '@oddkin/components/empty-state'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/CommandPalette

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/CommandPalette.
Repository source: packages/components/src/command-palette/command-palette.ts.
Code Connect export/name: OddkinCommandPalette.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/command-palette';
import '@oddkin/components/define/command-palette';
<odd-command-palette></odd-command-palette>
Optional side-effect-free class import: import { OddkinCommandPalette } from '@oddkin/components/command-palette'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/GridRow

```text
ODDKIN IMPLEMENTATION TYPE: Design specification.
Figma asset: Oddkin/Common/GridRow.
Implementation: design-only; no verified public component.
No corresponding implementation verified. Do not invent an element or import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/DataGrid

```text
ODDKIN IMPLEMENTATION TYPE: Design specification.
Figma asset: Oddkin/Common/DataGrid.
Implementation: design-only; no verified public component.
No corresponding implementation verified. Do not invent an element or import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/SplitPanels

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/SplitPanels.
Repository source: packages/components/src/split-panel/split-panel.ts.
Code Connect export/name: OddkinSplitPanel.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/split-panel';
import '@oddkin/components/define/split-panel';
<odd-split-panel></odd-split-panel>
Optional side-effect-free class import: import { OddkinSplitPanel } from '@oddkin/components/split-panel'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/Picker

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/Picker.
Repository source: packages/components/src/picker/picker.ts.
Code Connect export/name: OddkinPicker.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/picker';
import '@oddkin/components/define/picker';
<odd-picker></odd-picker>
Optional side-effect-free class import: import { OddkinPicker } from '@oddkin/components/picker'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/calendar

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/calendar.
Repository source: packages/components/src/calendar/calendar.ts.
Code Connect export/name: OddkinCalendar.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/calendar';
import '@oddkin/components/define/calendar';
<odd-calendar></odd-calendar>
Optional side-effect-free class import: import { OddkinCalendar } from '@oddkin/components/calendar'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/datePicker

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/datePicker.
Repository source: packages/components/src/date-picker/date-picker.ts.
Code Connect export/name: OddkinDatePicker.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/date-picker';
import '@oddkin/components/define/date-picker';
<odd-date-picker></odd-date-picker>
Optional side-effect-free class import: import { OddkinDatePicker } from '@oddkin/components/date-picker'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/colorPicker

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/colorPicker.
Repository source: packages/components/src/color-picker/color-picker.ts.
Code Connect export/name: OddkinColorPicker.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/color-picker';
import '@oddkin/components/define/color-picker';
<odd-color-picker></odd-color-picker>
Optional side-effect-free class import: import { OddkinColorPicker } from '@oddkin/components/color-picker'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/oneTimeCode

```text
ODDKIN IMPLEMENTATION TYPE: Web component.
Figma asset: Oddkin/Common/oneTimeCode.
Repository source: packages/components/src/one-time-code/one-time-code.ts.
Code Connect export/name: OddkinOneTimeCode.
REGISTRATION/PUBLIC IMPORT: import '@oddkin/components/define/one-time-code';
import '@oddkin/components/define/one-time-code';
<odd-one-time-code></odd-one-time-code>
Optional side-effect-free class import: import { OddkinOneTimeCode } from '@oddkin/components/one-time-code'; this class import alone does not register the tag.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/stepper

```text
ODDKIN IMPLEMENTATION TYPE: CSS recipe.
Figma asset: Oddkin/Common/stepper.
Repository source: packages/components/src/css/index.ts.
Code Connect export/name: stepper.
CSS IMPORT: import '@oddkin/components/css/stepper.css';
`ol.odd-stepper`: the steps of a task, each an `li` holding an `odd-status-marker` (a number, or complete or failed) and its words (`<div><a href>Name</a><span>Complete</span></div>`). The current step has `aria-current="step"` (on the `li` or its link) and the action colours; a failed step's words take the danger colour. Step links keep the text colour and their underline. Steps sit in a row and stack at 36rem of the list.
This is native HTML plus a stylesheet. Do not generate a fictional Oddkin class, custom-element tag, component registration, or TypeScript component import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/timeline

```text
ODDKIN IMPLEMENTATION TYPE: CSS recipe.
Figma asset: Oddkin/Common/timeline.
Repository source: packages/components/src/css/index.ts.
Code Connect export/name: timeline.
CSS IMPORT: import '@oddkin/components/css/timeline.css';
`ol.odd-timeline`: events newest first, each an `li` holding an `odd-status-marker` and its content (`<li><odd-status-marker status="complete"></odd-status-marker><div>title, time, detail</div></li>`). Markers sit on a rail joined by a connector; the title takes the UI role (the danger colour when the event failed), the time and detail the small secondary role.
This is native HTML plus a stylesheet. Do not generate a fictional Oddkin class, custom-element tag, component registration, or TypeScript component import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/descriptionList

```text
ODDKIN IMPLEMENTATION TYPE: CSS recipe.
Figma asset: Oddkin/Common/descriptionList.
Repository source: packages/components/src/css/index.ts.
Code Connect export/name: descriptionList.
CSS IMPORT: import '@oddkin/components/css/description-list.css';
`dl.odd-description-list`: term and value pairs, each pair a `div` row (`<div><dt>…</dt> <dd>…</dd></div>`) divided by rules, with one stable term column for every row (at most `--odd-description-list-term-width`). The list is an inline-size container: below 36rem of its own width each term stacks above its value. A missing value is author text ("Not provided").
This is native HTML plus a stylesheet. Do not generate a fictional Oddkin class, custom-element tag, component registration, or TypeScript component import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/carousel

```text
ODDKIN IMPLEMENTATION TYPE: Design specification.
Figma asset: Oddkin/Common/carousel.
Implementation: design-only; no verified public component.
No corresponding implementation verified. Do not invent an element or import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/hoverCard

```text
ODDKIN IMPLEMENTATION TYPE: Design specification.
Figma asset: Oddkin/Common/hoverCard.
Implementation: design-only; no verified public component.
No corresponding implementation verified. Do not invent an element or import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/contextMenu

```text
ODDKIN IMPLEMENTATION TYPE: Design specification.
Figma asset: Oddkin/Common/contextMenu.
Implementation: design-only; no verified public component.
No corresponding implementation verified. Do not invent an element or import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```

### Oddkin/Common/appHeader

```text
ODDKIN IMPLEMENTATION TYPE: Design specification.
Figma asset: Oddkin/Common/appHeader.
Implementation: design-only; no verified public component.
No corresponding implementation verified. Do not invent an element or import.
VARIANTS: appearance, size, selection, orientation and interaction-state examples inherit the parent implementation and imports. Translate an axis into a code property only when that property exists. Hover and focus are browser interaction states, not invented component props.
```
