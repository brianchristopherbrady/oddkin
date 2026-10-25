# Figma parity cleanup — 2026-10-22

Updated the existing Figma file E7LfRysny8V3qU24tv082i, pages 0:1 and 158:22.

## Changes

- Removed the two incorrect unsuffixed selection variables.
- Restored all 39 retained alias chains from the reported list of 41; the other two entries were the deleted selection variables.
- Rebound legacy theme references and removed the 89-variable Shared theme collection, including the misleading space/40 name. Existing 32 px spacing keeps the canonical space/xl token.
- Reassigned duplicate text styles before removing Wordmark, Home display, Button/sm, and Button/md. The library now has 13 text styles.
- Bound font family, size, and weight to variables; zero tracking also uses a variable.
- Added the repository's selected-row surface and neutral-tone roles with proper alias chains and Light/Dark modes.
- Standardized 31 anchored overlay/list surfaces on surface.raised, control.radius (8 px), border.default, border.width.default, and one mode-aware elevation.md effect.
- Removed duplicate inner dropdown shadows. Closed, invalid, and disabled field treatments remain distinct.
- Confirmed all 130 selected-row instances inherit selection.surface, separate from hover.
- Unified neutral badge and alert colors.
- Bound all four radio and switch focus indicators to radius/full.
- Corrected border.strong/light's description to #868997.

## Observed verification

- Token package TypeScript build completed successfully.
- Live Figma repository variables: 336 comparisons matched; zero mismatches, missing mappings, or flattened alias gaps.
- Component roles: 134 Light/Dark comparisons matched.
- Text styles: 52 metric comparisons matched the current repository theme.
- Overlay shadow colors: all four mode/layer comparisons matched elevation.md.
- Both pages were scanned with no missing variable, collection, or text-style references.
- Inspected light select, combobox, and selection-manager renders, plus a dark preview covering dropdowns, menus, popover, tooltip, neutral tones, radio, and switch.
- Removed the temporary preview after visual inspection. No new persistent page or file was created.

## Typography constraint

Figma numeric variable bindings force line height and tracking into pixel units. Line height therefore retains the repository's proportional ratios as percentages; nonzero em tracking also remains a percentage. This preserves proportional behavior when font size changes. Font family uses explicit Roboto/Roboto Mono adapters for the repository's system font stacks.

## Repository snapshot

Validation used live Figma exports and the rebuilt token generator from the current working copy. The committed design/figma/variables.json snapshot and figma-parity.test.ts baseline were not changed. The detailed live export and check results are in audit.json.

