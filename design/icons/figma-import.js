// Run in the Figma Plugin API context. Preserve the component's existing ID.
// SVG import can supply a default fill on its wrapper frame. That frame must
// stay transparent; binding its fill to the foreground covers the icon.
async function replaceIconArtwork(component, svg, foregroundVariable) {
  const artwork = figma.createNodeFromSvg(svg);
  artwork.name = 'Artwork';
  // Establish the native canvas before enabling proportional constraints on the SVG.
  component.resize(20, 20);
  component.appendChild(artwork);
  artwork.x = 0;
  artwork.y = 0;
  for (const node of [artwork, ...artwork.findAll()]) {
    if (node.type === 'FRAME') {
      node.fills = [];
      node.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
      continue;
    }
    if (node.type !== 'VECTOR') continue;
    node.fills = [];
    node.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
    node.strokes = node.strokes.map((paint) =>
      paint.type === 'SOLID'
        ? figma.variables.setBoundVariableForPaint(paint, 'color', foregroundVariable)
        : paint,
    );
  }
  for (const child of [...component.children]) if (child !== artwork) child.remove();
  component.fills = [];
  component.clipsContent = false;
  return artwork;
}

function auditIconArtwork(components) {
  const failures = [];
  for (const component of components) {
    for (const node of [component, ...component.findAll()]) {
      if (['COMPONENT', 'FRAME', 'VECTOR'].includes(node.type) && node.fills.length) {
        failures.push({ component: component.id, node: node.id, issue: 'opaque fill' });
      }
      if (
        ['FRAME', 'VECTOR'].includes(node.type) &&
        (node.constraints.horizontal !== 'SCALE' || node.constraints.vertical !== 'SCALE')
      ) {
        failures.push({ component: component.id, node: node.id, issue: 'non-scaling geometry' });
      }
    }
  }
  return failures;
}
