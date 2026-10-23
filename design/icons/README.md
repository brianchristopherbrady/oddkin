# Oddkin icons

1,723 original outline SVG assets: **949 General**, **156 GIS**, and **618 Healthcare**, organized into 43 labeled categories. The [Icons page in Figma](https://www.figma.com/design/E7LfRysny8V3qU24tv082i/Untitled?node-id=359-2) has one library frame, with one labeled master catalog per domain. Each icon appears once as an editable main component. Existing component IDs are preserved; the former duplicate source and preview grids are removed.

General holds reusable interface symbols, files, typography, navigation, transport, objects, nature, recreation, accessibility and general science tools. GIS holds qualified spatial geometry, spatial analysis, terrain/raster tools, surveying and utility infrastructure. Healthcare holds clinical care, people/records, medicines/equipment, anatomy, diagnostic testing and vitals. Classify the artwork's meaning rather than its source collection: generic maps, layer controls, hearts and microscopes belong in General; spatial databases and utility inspection/leak markers belong in GIS. `classification.mjs` records these assignments and gives each asset a reason.

The artwork uses a 20 × 20 canvas, 1.5 px physical strokes, rounded caps and joins, no fill, and `currentColor`. In Figma, strokes are bound to `Component roles/color/text/primary`, supporting light and dark modes. SVGs contain editable paths, with no font or image dependencies. Use visible labels for unfamiliar symbols.

## Reference coverage

The original inputs were `gis-icons.json` (hyphen), containing 3,170 reference entries, and `healthcare-only-icons.json`, containing 746 healthcare entries. All **3,916 source IDs** are covered. The separate `gis_icons.json` fragment is not a source of this expansion.

Portable renderer inventories are retained in `inventories/gis.json` and `inventories/healthcare.json`. They preserve the verified source IDs and the metadata needed to regenerate the artwork. Generation and tests use these copies, so they do not depend on the original upload files remaining at the repository root. Full upstream SVG data is not embedded.

The supplied normalized GIS (342 entries) and Healthcare (746 entries) reference catalogs are retained in `inventories/reference-catalogs/`, with their IDs, source metadata, upstream preview URLs and review flags preserved. Only their `$schema` paths change to resolve the shared schema from that directory. These describe reference identities, not additional Oddkin drawings.

## Shared catalog contract

`general-only-icons.json`, `gis-only-icons.json` and `healthcare-only-icons.json` are generated catalogs of the **actual Oddkin SVG assets and Figma components**, one record per drawing. All three use `icon-catalog.schema.json`. Stable `oddkin/<name>` IDs survive gallery changes; source reference IDs remain searchable aliases and are indexed exactly once in `source_metadata.reference_ids`.

Every record includes its category, search metadata, actual inline SVG, repository asset path, existing Figma node ID/name/link and measured 20 px / 1.5 px rounded outline contract. Generated assets advertise only `outline` and `default`; they do not claim the upstream filled/color variants. Reference naming ambiguities remain visible in `review`. General, GIS and Healthcare package names are metadata suggestions; no consuming package or import path is fabricated.

The common schema explicitly accepts all three galleries and checks their suggested package names and Oddkin geometry/Figma metadata. `catalog-validation.mjs` additionally verifies IDs, category/source joins, counts, search casing and every filter facet. The catalog tests compare every inline SVG with its file and every Figma mapping with the snapshot, and check preservation of all input reference identities.

The healthcare expansion adds 570 assets and reuses 37 existing canonical icons. Its 18 categories cover anatomy, blood and transfusion, conditions and symptoms, diagnostics, devices, clinical imaging, medicines, departments and services, community care, reproductive and maternal care, infection control, quarantine, public health, and health informatics. ABO/Rh groups, rapid-test results, pack counts, gestational stages, and numbered alternatives retain their source identities. Rapid-test symbols use semantic result marks rather than manufacturer-specific band positions. Two source display names reverse their death-rate trend; the original IDs determine the drawn direction, while the raw names are preserved in the reference index.

Reference names, categories and search metadata guide original Oddkin interpretations. No reference SVG paths are downloaded, copied or embedded. Equivalent concepts share canonical assets; `reference-map.json` accounts for every source ID exactly once. Filled and outlined reference entries both map to Oddkin's outline treatment. Application references use original functional marks or letter badges, not official brand logos. This is a concept inventory mapping, not visual parity with the reference collections.

The 34 former Core UI component IDs and their existing names remain stable. Their vector contents have been replaced with the original artwork supplied here, alongside the preserved domain component IDs. The artwork in this folder is distributed under the repository's [MIT license](../../LICENSE).

## Files and maintenance

- `general/`, `gis/`, `healthcare/`: ready-to-use SVG assets.
- `catalog.json`: canonical names, labels, categories, vector bodies, asset paths and reference aliases.
- `general-only-icons.json`, `gis-only-icons.json`, `healthcare-only-icons.json`: schema-valid gallery records for the actual 1,723 Oddkin assets.
- `icon-catalog.schema.json`: shared General/GIS/Healthcare metadata and Oddkin artwork contract.
- `reference-map.json`: all 3,916 source IDs mapped to canonical assets, with inventory provenance.
- `inventories/`: retained source identities and renderer metadata, independent of temporary uploads.
- `inventories/reference-catalogs/`: supplied normalized source catalogs, including their original source metadata and naming flags.
- `figma-map.json`: canonical assets mapped to stable Figma component IDs and names.
- `figma-import.js`: safe Plugin API import helper and an audit for opaque fills. Imported SVG wrapper frames must stay transparent; only vector strokes receive the foreground binding.
- `catalog.mjs`, `outline-art.mjs`, `reference-art.mjs`, `extended-art.mjs`, `healthcare-art.mjs`: original artwork and semantic composition rules.
- `preview.html`: labeled contact sheets at native size.
- `generate.mjs`: regenerate assets, manifests and previews with `node design/icons/generate.mjs`.
- `classification.mjs`: semantic gallery/category assignments, independent of reference origin.
- `build-catalogs.mjs`: regenerate the three schema-valid gallery catalogs, or verify freshness with `node design/icons/build-catalogs.mjs --check`.
- `catalog-validation.mjs`: shared schema and catalog-integrity checks used by the regression tests.
- `validate.mjs`: check coverage, names, SVG geometry, canvas bounds, strokes, color inheritance and stale assets with `node design/icons/validate.mjs`.

Generation and validation use the repository's Playwright Chromium installation to measure real vector geometry. Generation also updates the three gallery catalogs and removes obsolete SVGs from these three generated asset folders. Validation checks centered geometry, the 17 px safe area, physical stroke weight and rounded caps/joins. Small/inset geometry and secondary badges remain intentionally smaller within the same native canvas. Keep new artwork in the source modules and regenerate. The consuming icon package is left for the planned IDE work.

SVGs include an accessible title and image label. Beside text that already names the action, mark the SVG `aria-hidden="true"` and remove its image role and label. Icons do not replace a control's accessible name.
