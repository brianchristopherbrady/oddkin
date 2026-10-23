// Run in the Figma Plugin API context. Preserve the component's existing ID.
// SVG import can supply a default fill on its wrapper frame. That frame must
// stay transparent; binding its fill to the foreground covers the icon.
async function replaceIconArtwork(component, svg, foregroundVariable) {
  const artwork = figma.createNodeFromSvg(svg);
  artwork.name = 'Artwork';
  component.appendChild(artwork);
  artwork.x = 0;
  artwork.y = 0;
  for (const node of [artwork, ...artwork.findAll()]) {
    if (node.type === 'FRAME') {
      node.fills = [];
      continue;
    }
    if (node.type !== 'VECTOR') continue;
    node.fills = [];
    node.strokes = node.strokes.map((paint) =>
      paint.type === 'SOLID'
        ? figma.variables.setBoundVariableForPaint(paint, 'color', foregroundVariable)
        : paint,
    );
  }
  for (const child of [...component.children]) if (child !== artwork) child.remove();
  component.fills = [];
  component.clipsContent = false;
  component.resize(20, 20);
  return artwork;
}

function auditIconArtwork(components) {
  const failures = [];
  for (const component of components) {
    for (const node of [component, ...component.findAll()]) {
      if (['COMPONENT', 'FRAME', 'VECTOR'].includes(node.type) && node.fills.length) {
        failures.push({ component: component.id, node: node.id, issue: 'opaque fill' });
      }
    }
  }
  return failures;
}
