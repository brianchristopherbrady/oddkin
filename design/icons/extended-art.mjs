// Original Oddkin geometry for the expanded inventory. No source SVG paths.
import {
  get,
  register,
  path,
  line,
  polygon,
  circle,
  rect,
  grid,
  arrow,
  lettering,
  textGlyph,
  transform,
  badge,
  slash,
  enclosure,
  repeated,
} from './outline-art.mjs';
const draw = (key, ...d) => register(key, d.map((v) => path(v)).join(''));
const art = (key, body, category = 'Tools') => ({ key, body, category });
export const combine = (base, mark) =>
  base && mark
    ? art(
        `${base.key}-${mark.key}`,
        transform(base.body, 0.8, 0.8, 0.61) + transform(mark.body, 11.7, 11.7, 0.36),
        base.category,
      )
    : null;
draw(
  'paperclip',
  'M 7 7 L 12 2 C 17 -2 22 5 17 10 L 9 18 C 3 22 -2 14 3 9 L 11 2 M 6 10 L 13 3 C 16 1 19 4 16 7 L 8 15 C 5 18 2 14 5 11',
);
draw(
  'beaker',
  line(7, 2, 7, 7, 2, 16, 3, 18, 17, 18, 18, 16, 13, 7, 13, 2),
  line(5, 2, 15, 2),
  line(5, 12, 15, 12),
  circle(8, 15, 0.6),
  circle(12, 14, 0.6),
);
draw(
  'calculator',
  rect(3, 2, 14, 16, 1),
  rect(6, 5, 8, 3, 0.2),
  line(6, 11, 7, 11),
  line(10, 11, 11, 11),
  line(14, 11, 14, 15),
  line(6, 15, 7, 15),
  line(10, 15, 11, 15),
);
draw('banana', 'M 3 4 Q 6 18 16 5 L 18 3 Q 20 18 9 18 Q 1 18 2 6 Z', line(16, 5, 16, 2));
draw('brackets', line(6, 2, 3, 2, 3, 18, 6, 18), line(14, 2, 17, 2, 17, 18, 14, 18));
draw(
  'braces',
  'M 7 2 Q 3 1 4 7 Q 5 10 2 10 Q 5 10 4 13 Q 3 19 7 18 M 13 2 Q 17 1 16 7 Q 15 10 18 10 Q 15 10 16 13 Q 17 19 13 18',
);
draw('asterisk', line(10, 2, 10, 18), line(3, 6, 17, 14), line(3, 14, 17, 6));
draw(
  'puzzle',
  'M 2 4 H 7 C 3 -2 16 -2 12 4 H 18 V 9 C 12 5 12 17 18 13 V 18 H 12 C 16 12 3 12 7 18 H 2 V 13 C 8 17 8 5 2 9 Z',
);
draw('cursor', polygon(3, 2, 17, 11, 11, 12, 14, 18, 11, 19, 8, 13, 4, 17));
draw('lasso', 'M 3 13 C -3 2 21 -2 18 10 C 17 16 4 16 3 11 C 3 8 10 8 8 14 Q 6 19 2 18');
draw('curve', 'M 2 17 C 15 17 2 3 18 3', rect(1, 15, 3, 3, 0.2), rect(16, 1, 3, 3, 0.2));
draw('arc-segment', 'M 2 17 A 15 15 0 0 1 17 2', circle(2, 17, 1), circle(17, 2, 1));
draw('crop', line(5, 2, 5, 15, 18, 15), line(2, 5, 15, 5, 15, 18));
draw('scissors', circle(5, 5, 3), circle(5, 15, 3), line(7, 7, 18, 18), line(7, 13, 18, 2));
draw(
  'print',
  rect(4, 2, 12, 5, 0.2),
  rect(2, 7, 16, 8, 1),
  rect(5, 12, 10, 6, 0.2),
  line(14, 10, 15, 10),
);
draw('tag', polygon(2, 2, 10, 2, 18, 10, 10, 18, 2, 10), circle(6, 6, 1));
draw(
  'certificate',
  rect(3, 2, 14, 13, 0.5),
  line(6, 5, 14, 5),
  line(6, 8, 11, 8),
  circle(11, 13, 3),
  line(9, 15, 8, 19, 11, 17, 14, 19, 13, 15),
);
draw(
  'megaphone',
  polygon(2, 8, 8, 8, 16, 3, 16, 17, 8, 12, 2, 12),
  line(5, 12, 6, 18, 9, 18, 8, 12),
);
draw(
  'inbox',
  polygon(2, 4, 18, 4, 18, 17, 2, 17),
  line(2, 11, 6, 11, 8, 14, 12, 14, 14, 11, 18, 11),
);
draw('pin', polygon(6, 2, 14, 2, 13, 7, 17, 12, 11, 12, 10, 19, 9, 12, 3, 12, 7, 7));
draw(
  'rocket',
  'M 3 12 C 4 4 12 1 18 2 C 19 8 16 16 8 17 L 6 13 Z',
  circle(13, 7, 2),
  line(5, 8, 2, 8, 2, 14, 6, 13),
  line(12, 15, 12, 18, 6, 18, 7, 14),
  line(4, 16, 2, 18),
);
draw(
  'desk',
  rect(2, 6, 16, 3, 0.3),
  line(4, 9, 4, 18),
  line(16, 9, 16, 18),
  rect(11, 9, 5, 5, 0.3),
);
draw(
  'bug',
  circle(10, 4, 2),
  'M 5 9 C 5 4 15 4 15 9 V 13 A 5 5 0 0 1 5 13 Z',
  line(10, 7, 10, 18),
  line(2, 8, 5, 10),
  line(15, 10, 18, 8),
  line(2, 14, 5, 13),
  line(15, 13, 18, 14),
  line(5, 19, 7, 17),
  line(13, 17, 15, 19),
);
draw(
  'robot',
  rect(3, 5, 14, 12, 2),
  line(10, 2, 10, 5),
  circle(10, 1.5, 0.5),
  circle(7, 10, 1),
  circle(13, 10, 1),
  line(7, 14, 13, 14),
  line(1, 9, 3, 9),
  line(17, 9, 19, 9),
);
draw('toggle', rect(2, 5, 16, 10, 5), circle(13, 10, 3));
draw(
  'hourglass',
  line(4, 2, 16, 2),
  line(4, 18, 16, 18),
  'M 5 2 C 5 10 15 10 15 18 M 15 2 C 15 10 5 10 5 18',
);
draw(
  'translate',
  line(2, 5, 12, 5),
  line(7, 2, 7, 5),
  'M 4 5 Q 4 12 11 14 M 10 5 Q 10 12 2 16',
  line(11, 18, 15, 8, 19, 18),
  line(13, 14, 17, 14),
);
draw(
  'fingerprint',
  'M 2 10 C 2 -2 18 -2 18 10 M 5 16 V 10 C 5 2 15 2 15 10 V 14 M 8 18 V 10 C 8 7 12 7 12 10 V 17 M 2 13 V 16',
);
draw(
  'face-id',
  line(2, 6, 2, 2, 6, 2),
  line(14, 2, 18, 2, 18, 6),
  line(18, 14, 18, 18, 14, 18),
  line(6, 18, 2, 18, 2, 14),
  circle(7, 8, 0.5),
  circle(13, 8, 0.5),
  line(10, 8, 10, 12, 8, 12),
  'M 6 14 Q 10 17 14 14',
);
draw(
  'touch',
  circle(9, 5, 3),
  'M 7 10 V 5 Q 9 2 10 5 V 10 L 13 8 L 17 10 L 16 17 L 9 18 L 3 13 Q 2 10 5 11 L 7 13 Z',
);
draw(
  'contrast',
  circle(10, 10, 8),
  line(10, 2, 10, 18),
  line(10, 5, 14, 5),
  line(10, 8, 17, 8),
  line(10, 11, 17, 11),
  line(10, 14, 15, 14),
);
draw(
  'thumb-up',
  polygon(2, 9, 6, 9, 10, 2, 12, 2, 12, 8, 18, 8, 16, 18, 7, 18, 6, 16, 2, 16),
  line(6, 9, 6, 16),
);
draw(
  'thumb-down',
  polygon(2, 4, 6, 4, 7, 2, 16, 2, 18, 12, 12, 12, 12, 18, 10, 18, 6, 11, 2, 11),
  line(6, 4, 6, 11),
);
draw(
  'sort-ascending',
  line(3, 4, 13, 4),
  line(3, 9, 10, 9),
  line(3, 14, 7, 14),
  line(15, 7, 15, 18),
  line(12, 15, 15, 18, 18, 15),
);
draw(
  'sort-descending',
  line(3, 4, 7, 4),
  line(3, 9, 10, 9),
  line(3, 14, 13, 14),
  line(15, 7, 15, 18),
  line(12, 15, 15, 18, 18, 15),
);
draw('spinner', 'M 10 2 A 8 8 0 1 1 2 10');
draw(
  'legend',
  rect(2, 3, 4, 4, 0.5),
  circle(4, 11, 2),
  polygon(2, 18, 6, 18, 4, 14),
  line(9, 5, 18, 5),
  line(9, 11, 18, 11),
  line(9, 17, 18, 17),
);
draw(
  'contour',
  'M 2 6 C 1 -1 19 -1 18 8 C 17 17 4 21 2 14 Z M 5 7 C 4 2 16 2 15 8 C 14 14 5 18 5 12 Z M 8 8 C 8 5 13 5 12 9 Q 10 13 8 10 Z',
);
draw(
  'viewshed',
  polygon(2, 10, 17, 2, 17, 18),
  circle(2, 10, 1),
  'M 7 7 Q 10 10 7 13 M 12 4 Q 17 10 12 16',
);
draw(
  'parcel',
  polygon(2, 3, 10, 2, 18, 6, 17, 18, 2, 16),
  line(10, 2, 9, 10, 2, 9),
  line(9, 10, 17, 12),
  line(9, 10, 8, 17),
);
draw(
  'cluster',
  circle(10, 10, 4),
  circle(3, 3, 1.5),
  circle(17, 3, 1.5),
  circle(3, 17, 1.5),
  circle(17, 17, 1.5),
);
draw(
  'intersection',
  rect(2, 2, 11, 11, 1),
  circle(12, 12, 6),
  line(7, 9, 11, 5),
  line(8, 12, 13, 7),
);
draw('midpoint', line(2, 16, 18, 4), circle(2, 16, 1), circle(18, 4, 1), circle(10, 10, 2));
draw(
  'crosshair',
  circle(10, 10, 5),
  line(10, 1.5, 10, 6),
  line(10, 14, 10, 18.5),
  line(1.5, 10, 6, 10),
  line(14, 10, 18.5, 10),
);
draw(
  'scan-area',
  rect(2, 2, 16, 16, 0.5),
  line(5, 5, 15, 5, 15, 8, 5, 8, 5, 11, 15, 11, 15, 14, 5, 14),
);
draw(
  'dimension',
  line(3, 3, 3, 17),
  line(17, 3, 17, 17),
  line(3, 10, 17, 10),
  line(6, 7, 3, 10, 6, 13),
  line(14, 7, 17, 10, 14, 13),
);
draw(
  'expand',
  line(3, 8, 3, 3, 8, 3),
  line(12, 17, 17, 17, 17, 12),
  line(3, 3, 8, 8),
  line(12, 12, 17, 17),
);
draw(
  'contract',
  line(2, 2, 8, 8),
  line(8, 3, 8, 8, 3, 8),
  line(18, 18, 12, 12),
  line(12, 17, 12, 12, 17, 12),
);
draw('rotate', 'M 3 7 A 7 7 0 1 1 3 14', line(3, 2, 3, 7, 8, 7));
draw(
  'flip',
  polygon(8, 3, 2, 17, 8, 17),
  polygon(12, 3, 18, 17, 12, 17),
  line(10, 2, 10, 4),
  line(10, 7, 10, 9),
  line(10, 12, 10, 14),
  line(10, 17, 10, 19),
);
draw(
  'recurrence',
  'M 3 7 A 7 7 0 0 1 16 5 M 17 13 A 7 7 0 0 1 4 15',
  line(12, 5, 16, 5, 16, 1),
  line(8, 15, 4, 15, 4, 19),
);
draw(
  'pipe-backflow',
  line(2, 6, 18, 6),
  line(2, 14, 18, 14),
  line(15, 10, 5, 10),
  line(8, 8, 5, 10, 8, 12),
);
draw(
  'pipe-strainer',
  line(2, 7, 7, 7, 10, 10, 18, 10),
  line(2, 11, 6, 11, 10, 15, 18, 15),
  line(7, 7, 11, 3, 14, 6, 10, 10),
  line(10, 5, 12, 7),
);
draw(
  'pipe-vent',
  line(2, 17, 2, 8, 6, 4, 14, 4, 18, 8, 18, 17),
  line(5, 17, 5, 9, 7, 7, 13, 7, 15, 9, 15, 17),
  line(3, 2, 6, 2),
  line(8, 1.5, 11, 1.5),
  line(14, 2, 17, 2),
);
draw(
  'pipe-heater',
  line(2, 6, 18, 6),
  line(2, 14, 18, 14),
  'M 6 18 C 2 14 10 14 6 10 M 10 18 C 6 14 14 14 10 10 M 14 18 C 10 14 18 14 14 10',
);
draw('anomaly', line(2, 6, 18, 6), line(2, 14, 7, 14, 9, 10, 11, 16, 13, 14, 18, 14));
draw(
  'fence',
  line(2, 2, 2, 18),
  line(18, 2, 18, 18),
  line(2, 5, 18, 5),
  line(2, 15, 18, 15),
  line(6, 5, 6, 15),
  line(10, 5, 10, 15),
  line(14, 5, 14, 15),
);
draw(
  'beach',
  'M 2 10 A 8 8 0 0 1 18 10 Z M 10 2 V 17',
  line(6, 18, 13, 18),
  'M 6 10 Q 6 2 10 2 Q 14 2 14 10',
);
draw(
  'braille',
  circle(6, 4, 0.8),
  circle(13, 4, 0.8),
  circle(6, 10, 0.8),
  circle(13, 10, 0.8),
  circle(6, 16, 0.8),
);
draw(
  'dice',
  rect(2, 2, 16, 16, 2),
  circle(6, 6, 0.7),
  circle(14, 6, 0.7),
  circle(10, 10, 0.7),
  circle(6, 14, 0.7),
  circle(14, 14, 0.7),
);
draw('yield', polygon(2, 3, 18, 3, 10, 18));
draw('rings', circle(7, 10, 5), circle(13, 10, 5));
draw(
  'corridor',
  line(2, 6, 8, 6, 12, 14, 18, 14),
  line(2, 2, 10, 2, 14, 10, 18, 10),
  line(2, 10, 6, 10, 10, 18, 18, 18),
);
draw(
  'heatmap',
  circle(10, 10, 2),
  circle(10, 10, 5),
  circle(10, 10, 8),
  line(3, 3, 5, 5),
  line(15, 15, 17, 17),
);

// Curated synonyms are semantic aliases, not mechanically assigned placeholders.
const mappings = {
  paperclip: 'attachment attachment-plus no-attachment',
  beaker: 'beaker',
  calculator: 'calculator',
  banana: 'banana',
  brackets: 'brackets square-brackets-x clipboard-brackets members-brackets',
  braces: 'brackets-curly braces',
  asterisk: 'asterisk-large asterisk-small bullet-point bullet-point-large',
  puzzle: 'add-in puzzle-piece',
  cursor: 'cursor-click pointer click select-click',
  lasso: 'lasso lasso-select select-lasso cursor-marquee',
  curve: 'bezier-curve curve tangent-curve freehand trace',
  'arc-segment': 'arc-segment',
  crop: 'crop slice',
  scissors: 'cut',
  print: 'print printing print-preview',
  tag: 'tag label',
  certificate: 'certificate ribbon ribbon-rosette rosette',
  megaphone: 'mega-phone megaphone',
  inbox: 'inbox outbox',
  pin: 'pushpin-two unpin',
  rocket: 'launch launch-2 rocket',
  desk: 'desk',
  bug: 'debug debug-script',
  robot: 'ai-agent ai-agents automation deep-learning-project',
  toggle: 'toggle-on buttons',
  hourglass: 'hourglass-active hourglass-expired pending',
  translate: 'language-2 language-translate language-switcher',
  touch: 'touch',
  contrast: 'contrast shadow halo',
  'thumb-up': 'thumb-up speech-bubble-like add-reaction',
  'thumb-down': 'thumb-down',
  'sort-ascending': 'sort sort-ascending sort-ascending-arrow sort-ascending-view',
  'sort-descending': 'sort-descending sort-descending-arrow sort-descending-view',
  spinner: 'spinner',
  legend: 'legend legend-left legend-right',
  contour: 'contour surface seamlines',
  viewshed: 'viewshed service-create-viewshed',
  parcel: 'parcel parcel-dataset zoning-parameter',
  cluster: 'cluster-radius clustering classify-objects object-detection compactness',
  intersection:
    'intersection circle-intersection line-intersection line-and-circle-intersection analysis-overlay superimpose mask-inside mask-outside',
  midpoint: 'midpoint point-along-a-line point-line',
  crosshair: 'ground-control-point absolute-direction relative-direction snap-to-point',
  'scan-area': 'scan-area scan-crosshatch scan-perimeter scan-vertical scan-corridor',
  dimension:
    'dimensions dimensions-centered dimensions-unit dimensions-wall width-and-height height antenna-height',
  expand: 'expand maximize fullscreen-exit full-screen-exit expand-window max-all',
  contract: 'contract collapse minimize',
  rotate: 'rotate move-and-rotate rotate-device',
  flip: 'flip flip-vertical',
  recurrence: 'recurrence break-recurrence',
  'pipe-backflow': 'backflow',
  'pipe-strainer': 'strainer scrubber',
  'pipe-vent': 'vent',
  'pipe-heater': 'line-heater',
  anomaly: 'anomaly squeeze-off',
  fence: 'fence-point',
  beach: 'beach',
  braille: 'braille',
  dice: 'dice dominos',
  yield: 'yield-ahead-triangle',
  rings: 'marriage divorce',
  corridor: 'scan-corridor',
  map: 'placeholder-map plans map-contents color-coded-map follow oriented-imagery-widget classroom-gis e-learning-gis learning-gis-workflow mooc storymap-experience',
  'elevation-profile':
    'altitude measure-building-height-shadow measure-building-height-top-base measure-building-height-top-shadow image-mensuration',
  layers:
    'features feature feature-dataset feature-collection joined-view-layer media-layer imagery-layer tiled-imagery-layer imagery-tile-layer parquet-feature-layer subtype-group-layer subtype-sublayer group-layers ungroup-layers show-one-layer-at-a-time show-required-parameters',
  polygon:
    'autocomplete-polygon polygon-from-feature polygon-line-check polygon-select polygon-vertices new-complete-part reshape-tool explode-geometry offset stretch',
  hexagon: 'h3-hexagon transverse-hexagon',
  diamond: 'rhombus diamond-two',
  'rounded-rectangle': 'rounded-square square-border-rounded',
  circle: 'ring circle-double circle-stop',
  octagon: 'x-octagon',
  network:
    'connection-end-left connection-end-right connection-middle connection-to-connection channels entity-types relationship-class provenance hub related',
  route:
    'routing find-path find-add-path filtered-find-add-path find-path-origin find-path-destination find-path-exclude find-path-include find-path-mandatory-waypoint find-path-optional-waypoint group-off-set-start-of-line',
  image:
    'image-chips image-collection-explorer image-display-order image-segmentation image-space image-unit image-inverse dual-image-area dual-image-location oriented-imagery-full-superimpose oriented-imagery-half-superimpose oriented-imagery-overlays oriented-imagery-scene-only',
  'raster-grid':
    'mosaic-method-blend mosaic-method-by-attribute mosaic-method-closest-to-center mosaic-method-closest-to-nadir mosaic-method-first mosaic-method-last mosaic-method-maximum mosaic-method-mean mosaic-method-minimum mosaic-method-none mosaic-method-north-west mosaic-method-seamline mosaic-method-sum',
  'chart-line':
    'activity-monitor spike-data-visualization spike-data-visualization-open spike-data-visualization-outlined-color-locked spike-data-visualization-outlined-f spike-data-visualization-outlined-gradient spike-data-visualization-outlined-open spike-data-visualization-outlined-open-color-locked spike-data-visualization-outlined-open-f spike-data-visualization-outlined-open-gradient',
  'chart-pie': 'chord-diagram',
  table: 'add-cell-above add-cell-below tables duplicate-values',
  grid: 'dashboard group-content group-items ungroup-items widgets-source widget widgets-source widgets-group shapes shapes-2d-3d shape miscellaneous-collection',
  panel:
    'access-string-results selection-manager dock-bottom dock-left dock-right reorder-cards reorder-stack section section-view fixed-panel framework accordion sidebar inline inline-block float unfloat simple demo place-holder building-explorer floor-filter controller fly-controller desktop-mobile desktop-tablet tablet-mobile',
  list: 'list-bullet list-button list-check-all list-merge list-number list-radio list-rectangle list-show-all list-visible justify center-align',
  form: 'derived-value contingent-values-retire apply-changes apply-selection-to-existing-view assign-classification configure-editing return-to-default validate select-option test-data',
  check: 'success apply-changes validate',
  close: 'clear close-rectangle error',
  warning: 'warning-triangle hazardous natural-disaster overhead-hazard',
  question: 'help question-mark',
  globe: 'shared-public urban-model',
  people: 'invite shared-organization',
  'person-id': 'address-book developer-credentials register unregister',
  file: 'custom-print files-csv-collection services card one-call-ticket script',
  box: 'package',
  folder: 'folder-open folders folder-archive',
  mail: 'envelope-open',
  search:
    'select-range range select-by-attributes select-category selected-items-filter select-nonspatial-data filter-by-map find-by-attributes-and-locations filter-expand',
  compass: 'compass-needle compass-north-circle navigator direction',
  'map-pin':
    'location-label location-referencing-dataset location-sharing location-sharing-off near-me track follow',
  sun: 'lamp flash',
  lightning: 'camera-flash-on',
  camera: 'camera-switch-front-back',
  battery: 'signal-health',
  code: 'custom-web-tool 3d-toolbox',
  gear: 'system-management app-run app-update action action-group action-layers',
  share: 'share-ios share-arrow',
  'arrows-move': 'transfer exchange convert merge merge-units unmerge split split-units',
  download: 'import load download-to',
  upload: 'export upload-to',
  resize: 'drag-resize-horizontal drag-resize-vertical resize-area max-width max-height',
  separator: 'separator divider',
  grip: 'handle-dot-horizontal handle-dot-vertical handle-horizontal handle-vertical',
  door: 'entrance exit sign-in sign-out login walk-through-door',
  walking: 'embark disembark take-pedestrian-ramp wheelchair-ramp',
  bicycle: 'biking cyclist bike-park bike-repair',
  school: 'learning-steps learning-web-course video-learning',
  play: 'preview',
  monitor: 'monitor-share',
  mobile: 'mobile-vibrate user-to-device',
  'pie-chart': 'subtype',
  satellite: 'satellite-0 satellite-1 satellite-2 satellite-3',
  volume: 'unreasonable-noise unlawful-use-of-electronic-calls',
  hammer: 'hammer-coin workshop',
  shield: 'shield-coin security-checkpoint police-station',
  money: 'pay-station',
  plant: 'manipulated-vegetation',
  pipe: 'coating cp-bond-junction cp-rectifier cp-test-point da-survey-readings gas-leak-inspection ili-ground-ref-marker ili-survey-reading plastic-fusion temp-source-location-rural-tap town-border-station temp-source-location-town-border-station inter-basin-water-transfer',
  valve: 'excess-flow-valve flow-device electro-stop',
  pump: 'pump-station-utility-and-pipeline pump-station-water-and-sewer dehydration-equipment odorizer vacuum-station',
  transformer: 'arrester arrester-bank',
  sensor: 'line-monitor pedestal platform',
  dam: 'atoll-pool',
  truck: 'ready-mix-concrete-facilities',
  road: 'road-problems preferential-lane interstate-shield trail',
  'shield-health': 'mobile-pop-up-vaccination-location',
  pill: 'drug-seizure',
  horse: 'mounted-horse',
  person: 'indigenous curfew-loitering-vagrancy-violations trespass trespass-of-real-property',
  gun: 'assault-with-firearm homicide-with-firearm rape-with-firearm robbery-with-firearm indirect-fire shooting-range',
  bird: 'migratory-bird-hunting federal-duck-stamp-violation',
  warning: 'refuge-specific-violations',
  swimming: 'country-club',
  skating: 'sledding shuffleboard',
  carousel: 'carousel',
  airplane: 'airport-lounge',
  text: 'alt-text rich-text change-font-size indicator globally-unique-identifier character-space line-space lowercase uppercase uppercase-lowercase learning-steps',
  italic: 'italicize italic-none',
  bold: 'bold-none',
  underline: 'underscore underscore-none',
  'strike-through': 'strike-through-none',
  scales: 'conditional-rules conditional-rules-down conditional-rules-path',
};
const synonyms = new Map();
for (const [base, names] of Object.entries(mappings))
  for (const name of names.split(' ')) synonyms.set(name, base);
// These primitives have independent drawings so they do not depend on a label font.
draw('resize', line(2, 2, 2, 18, 18, 18), line(6, 15, 15, 6), line(10, 6, 15, 6, 15, 11));
draw('separator', line(2, 10, 18, 10));
draw(
  'grip',
  circle(7, 4, 0.6),
  circle(13, 4, 0.6),
  circle(7, 10, 0.6),
  circle(13, 10, 0.6),
  circle(7, 16, 0.6),
  circle(13, 16, 0.6),
);
draw(
  'carousel',
  line(2, 17, 18, 17),
  line(4, 6, 4, 16),
  line(10, 6, 10, 16),
  line(16, 6, 16, 16),
  polygon(2, 6, 10, 2, 18, 6),
);
draw(
  'road',
  line(4, 2, 2, 18),
  line(16, 2, 18, 18),
  line(10, 2, 10, 5),
  line(10, 8, 10, 11),
  line(10, 14, 10, 18),
);
draw(
  'transformer',
  rect(4, 3, 12, 14, 1),
  line(1, 6, 4, 6),
  line(16, 6, 19, 6),
  line(1, 14, 4, 14),
  line(16, 14, 19, 14),
  polygon(11, 5, 7, 10, 11, 10, 9, 15),
);
draw('door', rect(3, 2, 14, 16, 0.5), line(7, 2, 7, 18), circle(13, 10, 0.7));
draw('mobile', rect(5, 2, 10, 16, 2), line(8, 5, 12, 5), line(9, 15, 11, 15));
draw(
  '360-view',
  'M 2 10 C 2 3 18 3 18 10 C 18 17 2 17 2 10',
  line(2, 10, 6, 7),
  line(2, 10, 6, 13),
  line(18, 10, 14, 7),
);

export function resolveExtension(name, entry, resolve, depth) {
  const own = get(name);
  if (own) return own;
  if (/^mosaic-method-/.test(name)) {
    const mode = name.slice(14);
    const marks = {
      maximum: 'up',
      minimum: 'down',
      first: '1',
      last: 'N',
      mean: 'M',
      sum: '+',
      none: '0',
      'by-attribute': 'A',
      'closest-to-center': 'C',
      'closest-to-nadir': 'N',
      'north-west': 'NW',
      blend: 'B',
      seamline: 'S',
    };
    const base = get('raster-grid');
    return combine(
      base,
      marks[mode] === 'up' || marks[mode] === 'down'
        ? art(mode, arrow(marks[mode]))
        : textGlyph(marks[mode] || mode.slice(0, 2)),
    );
  }
  if (/^scan-(area|corridor|crosshatch|perimeter|vertical)$/.test(name)) {
    const mode = name.slice(5);
    let d = rect(2, 2, 16, 16, 0.4);
    if (mode === 'perimeter') d += rect(5, 5, 10, 10, 0.2);
    else if (mode === 'corridor')
      d =
        line(2, 4, 6, 4, 13, 16, 18, 16) +
        line(2, 8, 4, 8, 11, 19, 18, 19) +
        line(2, 1, 8, 1, 15, 13, 18, 13);
    else
      for (let k = 5; k <= 15; k += 5) {
        d += mode === 'vertical' ? line(k, 3, k, 17) : line(3, k, 17, k);
        if (mode === 'crosshatch') d += line(k, 3, k, 17);
      }
    return art(name, path(d), 'Survey & capture');
  }
  if (/^spike-data-visualization/.test(name)) {
    let d = line(2, 18, 18, 18) + line(5, 18, 5, 10) + line(10, 18, 10, 2) + line(15, 18, 15, 6);
    if (/open/.test(name)) d += circle(5, 10, 1) + circle(10, 2, 1) + circle(15, 6, 1);
    if (/lock/.test(name)) return badge(art('spike-chart', path(d)), 'lock');
    return art(/open/.test(name) ? 'spike-chart-open' : 'spike-chart', path(d), 'Charts');
  }
  const finalAliases = {
    'add-constant': 'number',
    'browser-join': 'network',
    'change-detection': 'compare',
    'display-selection-lock': 'lock',
    'display-selection-unlock': 'unlock',
    'highway-change': 'road',
    'highway-change-right': 'road',
    images: 'image',
    'parcel-parameter': 'parcel',
    'paste-with-attribute': 'clipboard',
    'paste-without-attribute': 'clipboard',
    'replica-sync-enable': 'recurrence',
    'save-as': 'save',
    spaces: 'building',
    'spaces-parameter': 'building',
    'spatiotemporal-catalog': 'database',
    'speech-bubble-exclamation': 'warning',
    'speech-bubble-social': 'speech-bubble',
    'speech-bubbles': 'speech-bubble',
    'star-values': 'star',
    'stored-as-new-query': 'search',
    'suitability-analysis-output': 'chart-bar',
    unselected: 'square',
    'variable-plus': 'text',
    webhook: 'network',
    'border-crossing': 'barrier',
    'broken-lock': 'unlock',
    'city-planning': 'building',
    'damaged-electrical': 'transformer',
    guy: 'antenna',
    hazardous: 'warning',
    'identified-issue-odor': 'pipe',
    'leak-severity-critical': 'blood-drop',
    'line-end': 'polyline',
    'point-end': 'point',
    'point-start': 'point',
    'natural-disaster': 'warning',
    'overhead-hazard': 'warning',
    'police-car': 'car',
    'take-during-closed-season': 'calendar',
    'more-vertical': 'more',
    'color-fill': 'palette',
    'warning-triangle': 'warning',
    speed: 'gauge',
    'add-line-events': 'polyline',
    'add-point-events': 'point',
    'basemap-gallery': 'map',
    'business-analysis': 'chart-bar',
    'coordinate-conversion': 'crosshair',
    editor: 'pencil',
    'feature-info': 'layers',
    'feature-report': 'file',
    measurement: 'measure-distance',
    'suitability-modeler': 'terrain',
    swipe: 'compare',
    'version-management': 'recurrence',
    'batch-edit': 'pencil',
    'change-symbol': 'star',
    'clear-format': 'text',
    'clear-selection-general': 'square',
    'duplicate-page': 'file',
    'edit-position': 'arrows-move',
    'filter-apply': 'filter',
    'insert-after': 'panel',
    'insert-below': 'panel',
    sum: 'plus',
    'sync-on': 'recurrence',
    'sync-remove': 'recurrence',
    'tab-left': 'panel',
    'tab-right': 'panel',
    'turn-off': 'toggle',
    'wrap-off': 'list',
    'wrap-on': 'list',
    'create-buffers': 'buffer',
    'draw-line': 'polyline',
    'service-find-hot-spots': 'heatmap',
    'shadow-cast': 'sun',
  };
  if (finalAliases[name]) {
    const g = resolve(finalAliases[name], entry, depth + 1);
    if (!g) return null;
    if (name === 'more-vertical') return art(name, transform(g.body, 0, 0, 1, 90), 'Interface');
    if (/-off|without-|clear-/.test(name)) return slash(g);
    if (/-remove/.test(name)) return badge(g, 'minus');
    if (/-apply|sync-on|replica-sync/.test(name)) return badge(g, 'check');
    if (/add-|insert-|duplicate|save-as|stored-as-new/.test(name)) return badge(g, 'plus');
    if (/-parameter|version-management/.test(name)) return badge(g, 'gear');
    if (/police-car/.test(name)) return combine(g, get('shield'));
    if (/spee[ch].*exclamation/.test(name)) return combine(get('speech-bubble'), g);
    if (/speech-bubbles|images|batch-edit/.test(name)) return repeated(g);
    if (/hazard|critical|damaged|issue-odor/.test(name)) return badge(g, 'warning');
    return g;
  }
  if (name === 'divide')
    return art(name, path(line(3, 10, 17, 10) + circle(10, 4, 0.8) + circle(10, 16, 0.8)), 'Math');
  if (name === 'compare')
    return art(
      name,
      path(
        rect(2, 3, 16, 14, 0.5) +
          line(10, 1, 10, 19) +
          line(2, 13, 6, 8, 10, 12) +
          line(10, 7, 14, 5, 18, 10),
      ),
      'Imaging',
    );
  if (name === 'radial-lines')
    return art(
      name,
      path(line(10, 2, 10, 18) + line(2, 10, 18, 10) + line(4, 4, 16, 16) + line(4, 16, 16, 4)),
      'Geometry',
    );
  if (name === 'x-axis-guide' || name === 'y-axis-guide')
    return art(
      name,
      path(
        line(3, 2, 3, 17, 18, 17) +
          line(
            name[0] === 'x' ? 2 : 12,
            name[0] === 'x' ? 9 : 2,
            name[0] === 'x' ? 18 : 12,
            name[0] === 'x' ? 9 : 18,
          ),
      ),
      'Charts',
    );
  if (name === 'three-way-arrow')
    return art(
      name,
      path(
        line(10, 18, 10, 2) +
          line(7, 5, 10, 2, 13, 5) +
          line(2, 10, 18, 10) +
          line(5, 7, 2, 10, 5, 13) +
          line(15, 7, 18, 10, 15, 13),
      ),
      'Navigation',
    );
  if (name === '360-view') return get(name);
  // Rounded/sharp corner specimens remain visually distinct.
  if (name.startsWith('border-radius-'))
    return art(
      name,
      path(
        rect(2, 2, 16, 16, name.endsWith('fully-rounded') ? 8 : name.endsWith('rounded') ? 4 : 0),
      ),
      'Shape & layout',
    );
  if (/^line-(solid|dashed|dotted)$/.test(name)) {
    let d = '';
    for (let x = 2; x < 18; x += name.endsWith('dotted') ? 3 : 6)
      d += line(x, 10, Math.min(18, x + (name.endsWith('dotted') ? 0.1 : 3)), 10);
    return art(name, path(name.endsWith('solid') ? line(2, 10, 18, 10) : d), 'Drawing');
  }
  if (/^(?:up|down|next|previous|vertical|horizontal)$/.test(name))
    return art(
      'direction-' + name,
      arrow({ next: 'right', previous: 'left', vertical: 'up', horizontal: 'right' }[name] || name),
      'Navigation',
    );
  if (/^(bring|send)-(?:to-|back|front|forward)/.test(name)) {
    const front = /front|forward/.test(name);
    return art(
      front ? 'bring-front' : 'send-back',
      path(rect(front ? 2 : 7, front ? 2 : 7, 11, 11, 0.5)) +
        path(
          line(
            front ? 7 : 2,
            front ? 17 : 2,
            front ? 17 : 2,
            front ? 17 : 12,
            front ? 17 : 12,
            front ? 7 : 2,
          ),
        ),
      'Layers',
    );
  }
  if (/^snap-(?:bottom|top|left|right|horizontal-middle|vertical-middle)$/.test(name))
    return art(
      name,
      path(
        line(2, 18, 18, 18) +
          rect(6, name.includes('top') ? 2 : name.includes('middle') ? 7 : 12, 8, 4, 0.4),
      ),
      'Alignment',
    );
  if (/^block-(center|left|right)$/.test(name))
    return art(
      name,
      path(
        line(2, 3, 18, 3) +
          line(2, 17, 18, 17) +
          rect(name.endsWith('left') ? 2 : name.endsWith('right') ? 10 : 6, 7, 8, 6, 0.4),
      ),
      'Alignment',
    );
  if (/^date-(max|min|now|today|tomorrow|yesterday)$/.test(name))
    return badge(
      get('calendar'),
      /max|tomorrow/.test(name) ? 'plus' : /min|yesterday/.test(name) ? 'minus' : 'clock',
    );
  if (/^(corner-all|corners)$/.test(name))
    return art(
      'corners',
      path(
        line(2, 7, 2, 2, 7, 2) +
          line(13, 2, 18, 2, 18, 7) +
          line(18, 13, 18, 18, 13, 18) +
          line(7, 18, 2, 18, 2, 13),
      ),
      'Drawing',
    );
  if (/^(zoom-in|zoom-out)(?:-window|-fixed)?$/.test(name))
    return combine(get('search'), get(name.startsWith('zoom-in') ? 'plus' : 'minus'));
  if (name === 'zoom-to-object' || name === 'select-zoom-to')
    return combine(get('search'), get('crosshair'));
  if (/^summarize-center/.test(name)) return combine(get('chart-scatter'), get('crosshair'));
  if (/^service-/.test(name)) {
    const raw = name.slice(8);
    const base = resolve(raw, entry, depth + 1);
    if (base) return base;
    const known = {
      'aggregate-points': 'cluster',
      'enrich-layer': 'layers',
      'find-centroids': 'midpoint',
      'find-closest': 'measure-distance',
      'find-hot-spots': 'heatmap',
      'find-outliers': 'cluster',
      'join-features': 'intersection',
      proximity: 'buffer',
      'summarize-nearby': 'buffer',
      'summarize-within': 'polygon',
      'trace-downstream': 'watershed',
      'create-watershed': 'watershed',
    };
    if (known[raw]) return get(known[raw]);
  }
  if (/^identified-issue-/.test(name)) {
    const base = /meter/.test(name)
      ? get('meter')
      : /odor/.test(name)
        ? get('air-quality')
        : get('pipe');
    return base && badge(base, 'warning');
  }
  if (/^damaged-/.test(name)) {
    const base = resolve(name.slice(8), entry, depth + 1);
    return base && badge(base, 'warning');
  }
  if (
    /^(add-and-update-features|delete-and-replace-features|enable-disable-feature-selection|overwrite-features|update-features)$/.test(
      name,
    )
  )
    return badge(
      get('layers'),
      /delete/.test(name)
        ? 'x'
        : /enable/.test(name)
          ? 'check'
          : /update|overwrite/.test(name)
            ? 'edit'
            : 'plus',
    );
  if (/^reshape-(add|subtract)-geometry$/.test(name))
    return badge(get('polygon'), name.includes('subtract') ? 'minus' : 'plus');
  if (/^(extend-trim|editing-trim-to-length)$/.test(name))
    return combine(get('polyline'), get('scissors'));
  if (/^(bulldozer-area|cut-and-fill-volume-calculation)$/.test(name))
    return combine(get('polygon'), get('digger'));
  if (/^(drag-resize-vertical|flip-vertical)$/.test(name)) {
    const g = get(name === 'flip-vertical' ? 'flip' : 'resize');
    return art(name, transform(g.body, 0, 0, 1, 90), 'Layout');
  }
  if (
    /^(share-no|shared-no|unlink-chain|unlink|link-chain|link-horizontal|link-tilted|link-combined|url)$/.test(
      name,
    )
  ) {
    const g = get('link');
    return /unlink|no/.test(name) ? slash(g) : g;
  }
  if (name === 'circle-stop') return enclosure(get('stop'));
  if (name === 'x-octagon')
    return art(
      'close-octagon',
      get('octagon').body + transform(get('close').body, 4, 4, 0.6),
      'Status',
    );
  if (/^(expand-all|collapse-all)$/.test(name))
    return repeated(get(name.startsWith('expand') ? 'expand' : 'contract'));
  if (name === 'distribute' || name === 'separate') return get('expand');
  if (/^alert-off-circle/.test(name)) return enclosure(slash(get('bell')));
  if (name === 'fingerprint' || name === 'face-id') return get(name);
  const base = synonyms.get(name);
  if (base) {
    const g = get(base) || resolve(base, entry, depth + 1);
    if (!g) return null;
    if (
      /^(no-|un)|-off$|-none$/.test(name) &&
      ![
        'underline',
        'underscore',
        'unfloat',
        'unmerge',
        'unregister',
        'unpin',
        'unselected',
      ].includes(name)
    )
      return slash(g);
    if (/plus|add-cell|new|add-reaction/.test(name)) return badge(g, 'plus');
    if (/-check|validate|success/.test(name)) return badge(g, 'check');
    if (/camera-flash/.test(name)) return combine(get('camera'), get('lightning'));
    if (/print-preview/.test(name)) return badge(g, 'search');
    if (/group-layers|tables|folders|images|ai-agents/.test(name)) return repeated(g);
    return g;
  }
  return null;
}
