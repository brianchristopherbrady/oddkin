# Code Connect corrections for the owner (Agent 1, 2026-10-27)

Checked against the code at main (a40e980 and later) with `.tmp/check-code-connect.mjs` in oddkin-a1: every proposed
mapping in artifacts/code-connect/implementation-audit.json names a source that exists, an export that file has, and an
import the package publishes (Form is an example: no export, as intended). The code needs no change. Every saved binding
below differs from that mapping; the "current" names marked † do not exist anywhere in the code.

| Asset | Current mapping | Correct mapping | Import |
| --- | --- | --- | --- |
| Oddkin/Common/link | (blank) @ packages/components/src/css/index.ts † | link @ packages/components/src/css/index.ts | @oddkin/components/css/link.css |
| Oddkin/Common/button/sm | (blank) @ packages/components/src/button/button.ts † | OddkinButton @ packages/components/src/button/button.ts | @oddkin/components/define/button |
| Oddkin/Common/button/lg | (blank) @ packages/components/src/button/button.ts † | OddkinButton @ packages/components/src/button/button.ts | @oddkin/components/define/button |
| Oddkin/Common/field | (blank) @ packages/components/src/css/index.ts † | field @ packages/components/src/css/index.ts | @oddkin/components/css/field.css |
| Oddkin/Common/radio | (blank) @ packages/components/src/form-control/radio-input.ts † | radioInput @ packages/components/src/form-control/radio-input.ts | @oddkin/components/define/radio-group |
| Oddkin/Common/ListboxSurface | ListboxSurface @ packages/components/src/collection/option-rows.template.ts † | optionListTemplate @ packages/components/src/collection/option-rows.template.ts | @oddkin/components/define/listbox |
| Oddkin/Common/ListboxOption | ListboxOption @ packages/components/src/collection/option-rows.template.ts † | optionListTemplate @ packages/components/src/collection/option-rows.template.ts | @oddkin/components/define/listbox |
| Oddkin/Common/CheckboxOption | OddkinCheckbox @ packages/components/src/checkbox/checkbox.ts | optionListTemplate @ packages/components/src/collection/option-rows.template.ts | @oddkin/components/define/combobox |
| Oddkin/Common/MenuItem | (blank) @ packages/components/src/menu/menu.template.ts † | menuTemplate @ packages/components/src/menu/menu.template.ts | @oddkin/components/define/menu |
| Oddkin/Common/NavigationItem | NavigationItem @ packages/components/src/side-nav/side-nav.template.ts † | sideNavTemplate @ packages/components/src/side-nav/side-nav.template.ts | @oddkin/components/define/side-nav |
| Oddkin/Common/CommandItem | (blank) @ packages/app/src/command/command.ts † | commandPaletteTemplate @ packages/components/src/command-palette/command-palette.template.ts | @oddkin/components/define/command-palette |
| Oddkin/Common/divider | (blank) @ packages/components/src/css/index.ts † | divider @ packages/components/src/css/index.ts | @oddkin/components/css/divider.css |
| Oddkin/Common/typography | (blank) @ packages/components/src/css/index.ts † | typography @ packages/components/src/css/index.ts | @oddkin/components/css/typography.css |
| Oddkin/Common/multiselect/Value/chips | OddkinChip @ packages/components/src/chip/chip.ts | valueTemplate @ packages/components/src/collection/option-field.template.ts | @oddkin/components/define/combobox |
| Oddkin/Common/multiselect/Value/avatars | OddkinAvatar @ packages/components/src/avatar/avatar.ts | valueTemplate @ packages/components/src/collection/option-field.template.ts | @oddkin/components/define/combobox |
| Oddkin/Common/multiselect/Field | OddkinField @ packages/components/src/combobox/combobox.template.ts † | comboboxTemplate @ packages/components/src/combobox/combobox.template.ts | @oddkin/components/define/combobox |
| Oddkin/Common/calendar/Day | OddkinCalendarDay @ packages/components/src/calendar/calendar.ts † | calendarTemplate @ packages/components/src/calendar/calendar.template.ts | @oddkin/components/define/calendar |
| Oddkin/Common/oneTimeCode/Cell | OddkinOneTimeCodeCell @ onet-time-code.cell.template.ts † | oneTimeCodeTemplate @ packages/components/src/one-time-code/one-time-code.template.ts | @oddkin/components/define/one-time-code |
| Oddkin/Common/color/Swatch | (blank) @ packages/components/src/one-time-code/one-time-code.template.ts † | colorPickerTemplate @ packages/components/src/color-picker/color-picker.template.ts | @oddkin/components/define/color-picker |
| Oddkin/Common/rating/Item | (blank) @ packages/components/src/rating/rating.template.ts † | ratingTemplate @ packages/components/src/rating/rating.template.ts | @oddkin/components/define/rating |
| Oddkin/Common/select | (blank) @ packages/components/src/select/select.ts † | OddkinSelect @ packages/components/src/select/select.ts | @oddkin/components/define/select |
| Oddkin/Common/multiselect | (blank) @ packages/components/src/combobox/combobox.ts † | OddkinCombobox @ packages/components/src/combobox/combobox.ts | @oddkin/components/define/combobox |
| Oddkin/Common/multiselect/Display | OddkindMultiSelectDisplay @ packages/components/src/collection/option-field.template.ts † | valueTemplate @ packages/components/src/collection/option-field.template.ts | @oddkin/components/define/combobox |
| Oddkin/Common/multiselect/SelectionPanel | (blank) @ packages/components/src/collection/option-field.template.ts † | selectionTemplate @ packages/components/src/collection/option-field.template.ts | @oddkin/components/define/combobox |
| Oddkin/Common/multiselect/SelectedItems | (blank) @ packages/components/src/collection/option-field.template.ts † | reviewTemplate @ packages/components/src/collection/option-field.template.ts | @oddkin/components/define/combobox |
| Oddkin/Common/dateTime | OddkinDateTime @ packages/components/src/input/input.ts † | OddkinInput @ packages/components/src/input/input.ts | @oddkin/components/define/input |
| Oddkin/Common/CheckboxGroup | (blank) @ packages/components/src/checkbox-group/checkbox-group.ts † | OddkinCheckboxGroup @ packages/components/src/checkbox-group/checkbox-group.ts | @oddkin/components/define/checkbox-group |
| Oddkin/Common/Form | FormValue @ packages/core/src/controllers/form.ts | (blank) @ examples/forms/index.html | — |
| Oddkin/Common/Table | OddkinTable @ packages/components/src/css/index.ts † | table @ packages/components/src/css/index.ts | @oddkin/components/css/table.css |
| Oddkin/Common/List | List @ packages/components/src/css/index.ts † | list @ packages/components/src/css/index.ts | @oddkin/components/css/list.css |
| Oddkin/Common/SideNavigation | (blank) @ packages/components/src/side-nav/side-nav.ts † | OddkinSideNav @ packages/components/src/side-nav/side-nav.ts | @oddkin/components/define/side-nav |
| Oddkin/Common/Breadcrumbs | (blank) @ packages/components/src/breadcrumbs/breadcrumbs.ts † | OddkinBreadcrumbs @ packages/components/src/breadcrumbs/breadcrumbs.ts | @oddkin/components/define/breadcrumbs |
| Oddkin/Common/Pagination | (blank) @ packages/components/src/pagination/pagination.ts † | OddkinPagination @ packages/components/src/pagination/pagination.ts | @oddkin/components/define/pagination |
| Oddkin/Common/Accordion | (blank) @ packages/components/src/disclosure/disclosure.ts † | OddkinDisclosure @ packages/components/src/disclosure/disclosure.ts | @oddkin/components/define/disclosure |
| Oddkin/Common/splitAction | OddkinSplitAction @ packages/components/src/split-button/split-button.ts † | OddkinSplitButton @ packages/components/src/split-button/split-button.ts | @oddkin/components/define/split-button |
| Oddkin/Common/alertDialog | OddkinAlert @ packages/components/src/alert/alert.ts | OddkinDialog @ packages/components/src/dialog/dialog.ts | @oddkin/components/define/dialog |
| Oddkin/Common/CommandPalette | (blank) @ packages/components/src/command-palette/command-palette.ts † | OddkinCommandPalette @ packages/components/src/command-palette/command-palette.ts | @oddkin/components/define/command-palette |
| Oddkin/Common/SplitPanels | (blank) @ packages/components/src/split-panel/split-panel.ts † | OddkinSplitPanel @ packages/components/src/split-panel/split-panel.ts | @oddkin/components/define/split-panel |
| Oddkin/Common/Picker | (blank) @ packages/components/src/picker/picker.ts † | OddkinPicker @ packages/components/src/picker/picker.ts | @oddkin/components/define/picker |
| Oddkin/Common/stepper | (blank) @ packages/components/src/css/index.ts † | stepper @ packages/components/src/css/index.ts | @oddkin/components/css/stepper.css |
| Oddkin/Common/timeline | (blank) @ packages/components/src/css/index.ts † | timeline @ packages/components/src/css/index.ts | @oddkin/components/css/timeline.css |
| Oddkin/Common/descriptionList | (blank) @ packages/components/src/css/index.ts † | descriptionList @ packages/components/src/css/index.ts | @oddkin/components/css/description-list.css |

## The four new families (implemented today; previously design-only)

| Asset | Current mapping | Correct mapping | Import | Usage |
| --- | --- | --- | --- | --- |
| Oddkin/Common/hoverCard | OddkinCardHover @ packages/components/src/card/card.ts † | OddkinPopover @ packages/components/src/popover/popover.ts | @oddkin/components/define/popover | <odd-popover anchor="…" interest> |
| Oddkin/Common/carousel | (none) | OddkinCarousel @ packages/components/src/carousel/carousel.ts | @oddkin/components/define/carousel | <odd-carousel label="…"> |
| Oddkin/Common/contextMenu | (none) | OddkinMenu @ packages/components/src/menu/menu.ts | @oddkin/components/define/menu | <odd-menu context="…"> |
| Oddkin/Common/appHeader | (none) | (blank) @ examples/app-header/index.html | — | an example composition (no element, no export) |
