// Classify the artwork's meaning, independently of which reference supplied its name.
const generalNavigation = new Set(
  'map map-information map-off map-search map-up map-export map-print offline-map geotag-photo location-history route waypoint north-arrow'.split(
    ' ',
  ),
);
const generalLayers = new Set(
  'layers-check layers-cube layers-edit layers-filter layers-gear layers-image layers-minus layers-multiple layers-network layers-off layers-plus layers-text-csv layers-video layers-video-plus layers-x grid-snap-to-pixel'.split(
    ' ',
  ),
);
const generalScience = new Set(
  'magnet lab-flask microscope test-tube petri-dish dna dna-helix-alt dna-helix-alt-off dna-off thermometer weight-scale mortar'.split(
    ' ',
  ),
);
const generalOther = new Map([
  ['appointment', 'Date & time'],
  ['heart', 'Controls, objects & actions'],
  ['wheelchair', 'Accessibility & support'],
  ['biohazard', 'Controls, objects & actions'],
  ['sanitizer', 'Controls, objects & actions'],
  ['sanitizer-spray', 'Controls, objects & actions'],
  ['arc-segment', 'Symbols & shapes'],
  ['curve', 'Symbols & shapes'],
  ['radial-lines', 'Symbols & shapes'],
  ['midpoint', 'Symbols & shapes'],
  ['centroid', 'Symbols & shapes'],
]);
const spatialData = new Set(
  'database-map database-point database-polygon database-polyline database-raster-grid server-map panel-map camera-sensor-map point-plus polygon-area polygon-check polygon-digger polygon-off polygon-plus clipboard-blood-drop map-pin-blood-drop'.split(
    ' ',
  ),
);

export function generalCategory(name, previous) {
  if (previous === 'Core controls') return previous;
  if (
    generalNavigation.has(name) ||
    /^(?:direction-|arrows-|compass$|globe$|locate$|map-pin(?:-|$)|text-direction-|three-way-arrow$|video-globe$)/.test(
      name,
    )
  )
    return 'Navigation & location';
  if (generalScience.has(name) || /^(?:beaker|ruler|scales|gauge)(?:-|$)/.test(name))
    return 'Science & measurement';
  if (generalOther.has(name)) return generalOther.get(name);
  if (/^(?:wheelchair|braille)(?:-|$)/.test(name)) return 'Accessibility & support';
  if (/^(?:calendar|clock|hourglass|recurrence|person-clock)(?:-|$)/.test(name))
    return 'Date & time';
  if (
    /^(?:file|folder|clipboard|book|open-book|print|paperclip|certificate|tag|archive|server-file|database-file|database-folder)(?:-|$)/.test(
      name,
    )
  )
    return 'Files & documents';
  if (
    /^(?:text|font|heading|paragraph|bold|italic|underline|strike-through|brackets|braces)(?:-|$)/.test(
      name,
    )
  )
    return 'Typography & formatting';
  if (
    generalLayers.has(name) ||
    /^(?:align|border|bounding-box|chart|grid|layer|layers|database|network|server|panel|list|table|layout|dimension|resize|drag-resize|ltr-elements|rtl-elements|pie-chart|spike-chart|box-chart|distribute|horizontal-distribute|vertical-distribute|space-|spaced-|stretch-|snap-)/.test(
      name,
    )
  )
    return 'Data & layout';
  if (
    /^(?:person|people|speech-bubble|mail|phone|mobile|megaphone|collaboration|dialog)(?:-|$)/.test(
      name,
    )
  )
    return 'People & communication';
  if (
    /^(?:camera|video|image|music|microphone|monitor|computer|tablet|keyboard|volume|play|pause|stop|antenna|wifi)(?:-|$)/.test(
      name,
    )
  )
    return 'Media & devices';
  if (
    /^(?:alligator|bear|bird|cat|coral|cow|crab|deer|dog|elephant|fish|flower|frog|horse|leaf|moon|mosquito|mushroom|paw|plant|rain|snake|snowflake|sun|tree|turtle|wind|windmill|cloud|earthquake|tornado|water)(?:-|$)/.test(
      name,
    )
  )
    return 'Nature & weather';
  if (
    /^(?:airplane|bicycle|boat|bus|car|truck|train|motorcycle|parking|road|walking|running|building|school|shop|bank|church|factory|lighthouse|stadium|bridge|ship|credit-card)(?:-|$)/.test(
      name,
    )
  )
    return 'Transport & places';
  if (
    /^(?:circle|square|triangle|rectangle|rounded-rectangle|diamond|pentagon|hexagon|octagon|ellipse|cube|trapezoid|line-|rings|crosshair|corners)/.test(
      name,
    )
  )
    return 'Symbols & shapes';
  if (
    /^(?:ball|baseball|basketball|beach|dice|golf|racket|rugby|skating|skiing|swimming|volleyball|carousel)(?:-|$)/.test(
      name,
    )
  )
    return 'Recreation & objects';
  return 'Controls, objects & actions';
}

export function classifyArtwork(icon) {
  let { domain, category } = icon;
  let reason;
  if (
    generalNavigation.has(icon.name) ||
    generalLayers.has(icon.name) ||
    generalScience.has(icon.name) ||
    generalOther.has(icon.name)
  ) {
    domain = 'general';
    reason =
      'Reusable navigation, interface, accessibility, science or everyday-object artwork without a GIS or clinical qualifier.';
  }
  if (spatialData.has(icon.name)) {
    domain = 'gis';
    category = /blood-drop|digger/.test(icon.name) ? 'Utilities & infrastructure' : 'Layers & data';
    reason = /blood-drop/.test(icon.name)
      ? 'Utility inspection or leak marker; the droplet references liquid/gas infrastructure, not a clinical blood record.'
      : 'Spatial feature geometry, geospatial data or map-specific infrastructure tooling.';
  }
  if (domain === 'general') category = generalCategory(icon.name, category);
  if (domain === 'healthcare') {
    if (/^(?:condition-|disease-|asthma$)/.test(icon.name)) category = 'Conditions & symptoms';
    if (
      ['neurosurgery', 'pediatric-surgery', 'speech-therapy', 'internal-medicine'].includes(
        icon.name,
      )
    )
      category = 'Departments & care services';
    if (icon.name === 'telemedicine') category = 'Clinical care & procedures';
    if (/^places-/.test(icon.name)) category = 'Facilities & care transport';
  }
  reason ||=
    domain === 'general'
      ? 'Reusable interface symbol or general-purpose object; reference origin does not make the artwork industry-specific.'
      : domain === 'gis'
        ? 'Mapping, geospatial feature construction, surveying, spatial analysis, terrain/raster or utility-network concept.'
        : 'Clinical anatomy, diagnostics, treatment, care delivery, medical equipment or public-health concept.';
  return { domain, category, reason };
}
