// Read-only Figma Plugin API export behind design/figma/components.json. To refresh the snapshot, run
// this function through the Figma MCP `use_figma` tool (drop `export`, call it, return the JSON text in
// equal slices under the tool's 48,000-byte return limit), join the slices, add `$schema` and `source`,
// and format. It only reads nodes, component properties, bound variables, and styles; tests never call Figma.

/**
 * @param {any} figma The Plugin API global.
 * @param {string[]} pageIds Pages to export, in this order.
 * @param {string} exportedAt Date only (YYYY-MM-DD).
 */
export async function exportComponents(figma, pageIds, exportedAt) {
  const hex2 = (n) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, '0');
  const hex = (c, opacity = 1) => {
    const a = (c.a === undefined ? 1 : c.a) * opacity;
    return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}${Math.round(a * 255) === 255 ? '' : hex2(a)}`;
  };
  const round = (n) => Math.round(n * 10000) / 10000;
  const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const comparePaths = (a, b) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++)
      if (a[i] !== b[i]) return order(a[i], b[i]);
    return a.length - b.length;
  };
  const mixed = figma.mixed;

  const variablePaths = new Map();
  const variablePath = async (id) => {
    if (!variablePaths.has(id)) {
      const v = await figma.variables.getVariableByIdAsync(id);
      const c = v && (await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId));
      variablePaths.set(
        id,
        v ? `${c ? c.name : v.variableCollectionId}/${v.name}` : `missing:${id}`,
      );
    }
    return variablePaths.get(id);
  };
  const styleNames = new Map();
  const styleName = async (id) => {
    if (!styleNames.has(id)) {
      const s = await figma.getStyleByIdAsync(id);
      styleNames.set(id, s ? s.name : `missing:${id}`);
    }
    return styleNames.get(id);
  };
  const propertyName = (key) => key.replace(/#[^#]*$/, '');

  // Per layer of one family: field -> value -> set of variant indexes.
  const add = (layer, kind, field, value, variant) => {
    const fields = (layer[kind] ??= new Map());
    const values = fields.get(field) ?? new Map();
    fields.set(field, values);
    const variants = values.get(value) ?? new Set();
    values.set(value, variants);
    variants.add(variant);
  };

  const RADII = ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius'];
  const PADDING = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];
  const STROKE_WEIGHTS = [
    'strokeTopWeight',
    'strokeRightWeight',
    'strokeBottomWeight',
    'strokeLeftWeight',
  ];

  const paints = (node, field, layer, variant, styleField) => {
    if (!(field in node)) return;
    const style = node[styleField];
    if (style && style !== mixed) return;
    const list = node[field];
    if (list === mixed) return add(layer, 'literals', field, 'mixed', variant);
    for (const paint of list) {
      if (paint.visible === false) continue;
      if (paint.type === 'SOLID') {
        if (!paint.boundVariables?.color)
          add(layer, 'literals', field, hex(paint.color, paint.opacity ?? 1), variant);
      } else add(layer, 'literals', field, paint.type, variant);
    }
  };

  // An instance's own styling belongs to its source family: record only its property references
  // here (overrides are listed on the instance reference).
  const visit = async (node, layer, variant) => {
    for (const [field, key] of Object.entries(node.componentPropertyReferences ?? {}))
      add(layer, 'properties', field, propertyName(key), variant);
    if (node.type === 'INSTANCE') return;
    const bound = node.boundVariables ?? {};
    for (const [field, alias] of Object.entries(bound)) {
      for (const a of Array.isArray(alias) ? alias : [alias])
        if (a?.id) add(layer, 'bound', field, await variablePath(a.id), variant);
    }
    for (const [styleField, field] of [
      ['fillStyleId', 'fillStyle'],
      ['strokeStyleId', 'strokeStyle'],
      ['effectStyleId', 'effectStyle'],
      ['textStyleId', 'textStyle'],
    ]) {
      if (!(styleField in node)) continue;
      const id = node[styleField];
      if (id === mixed) add(layer, 'bound', field, 'mixed', variant);
      else if (id) add(layer, 'bound', field, await styleName(id), variant);
    }

    paints(node, 'fills', layer, variant, 'fillStyleId');
    paints(node, 'strokes', layer, variant, 'strokeStyleId');
    const stroked =
      'strokes' in node && node.strokes !== mixed && node.strokes.some((p) => p.visible !== false);
    const weightBound = 'strokeWeight' in bound || STROKE_WEIGHTS.some((f) => f in bound);
    if (stroked && !weightBound) {
      if (node.strokeWeight !== mixed)
        add(layer, 'literals', 'strokeWeight', round(node.strokeWeight), variant);
      else
        for (const f of STROKE_WEIGHTS)
          if (f in node && node[f] > 0) add(layer, 'literals', f, round(node[f]), variant);
    } else if (stroked && !('strokeWeight' in bound)) {
      for (const f of STROKE_WEIGHTS)
        if (f in node && !(f in bound) && node[f] > 0)
          add(layer, 'literals', f, round(node[f]), variant);
    }
    if (RADII[0] in node) {
      const free = RADII.filter((f) => !(f in bound) && node[f] > 0);
      const values = free.map((f) => node[f]);
      if (free.length === 4 && values.every((v) => v === values[0]))
        add(layer, 'literals', 'cornerRadius', round(values[0]), variant);
      else for (const f of free) add(layer, 'literals', f, round(node[f]), variant);
    }
    if ('layoutMode' in node && node.layoutMode !== 'NONE') {
      if (!('itemSpacing' in bound) && node.itemSpacing !== 0 && node.children.length > 1)
        add(layer, 'literals', 'itemSpacing', round(node.itemSpacing), variant);
      if (node.layoutWrap === 'WRAP' && !('counterAxisSpacing' in bound) && node.counterAxisSpacing)
        add(layer, 'literals', 'counterAxisSpacing', round(node.counterAxisSpacing), variant);
      for (const f of PADDING)
        if (!(f in bound) && node[f] !== 0) add(layer, 'literals', f, round(node[f]), variant);
    }
    if (
      'effects' in node &&
      !(node.effectStyleId && node.effectStyleId !== mixed) &&
      !('effects' in bound)
    ) {
      for (const e of node.effects) {
        if (e.visible === false) continue;
        const parts = [e.type];
        if ('offset' in e) parts.push(round(e.offset.x), round(e.offset.y));
        if ('radius' in e) parts.push(round(e.radius));
        if ('spread' in e) parts.push(round(e.spread));
        if ('color' in e) parts.push(hex(e.color));
        add(layer, 'literals', 'effects', parts.join(' '), variant);
      }
    }
    if ('opacity' in node && node.opacity < 1 && !('opacity' in bound))
      add(layer, 'literals', 'opacity', round(node.opacity), variant);
    if (node.type === 'TEXT' && !(node.textStyleId && node.textStyleId !== mixed)) {
      if (!('fontSize' in bound))
        add(
          layer,
          'literals',
          'fontSize',
          node.fontSize === mixed ? 'mixed' : round(node.fontSize),
          variant,
        );
      if (!('fontFamily' in bound) && !('fontStyle' in bound) && !('fontWeight' in bound))
        add(
          layer,
          'literals',
          'fontName',
          node.fontName === mixed ? 'mixed' : `${node.fontName.family} ${node.fontName.style}`,
          variant,
        );
      if (!('lineHeight' in bound) && node.lineHeight !== mixed && node.lineHeight.unit !== 'AUTO')
        add(
          layer,
          'literals',
          'lineHeight',
          `${round(node.lineHeight.value)}${node.lineHeight.unit === 'PIXELS' ? 'px' : '%'}`,
          variant,
        );
      if (
        !('letterSpacing' in bound) &&
        node.letterSpacing !== mixed &&
        node.letterSpacing.value !== 0
      )
        add(
          layer,
          'literals',
          'letterSpacing',
          `${round(node.letterSpacing.value)}${node.letterSpacing.unit === 'PIXELS' ? 'px' : '%'}`,
          variant,
        );
    }
  };

  const familyOf = (component) =>
    component.parent?.type === 'COMPONENT_SET' ? component.parent : component;

  const exportFamily = async (node, page) => {
    let frame = node;
    while (frame.parent && frame.parent.type !== 'PAGE') frame = frame.parent;
    const members =
      node.type === 'COMPONENT_SET' ? node.children.filter((c) => c.type === 'COMPONENT') : [node];
    members.sort((a, b) => order(a.name, b.name));

    const properties = [];
    for (const [key, def] of Object.entries(node.componentPropertyDefinitions ?? {})) {
      const entry = { name: def.type === 'VARIANT' ? key : propertyName(key), type: def.type };
      if (def.type === 'INSTANCE_SWAP') {
        const target = await figma.getNodeByIdAsync(def.defaultValue);
        entry.defaultValue = target
          ? familyOf(target).name +
            (target.parent?.type === 'COMPONENT_SET' ? ` (${target.name})` : '')
          : def.defaultValue;
      } else entry.defaultValue = def.type === 'SLOT' ? '' : def.defaultValue;
      if (def.variantOptions) entry.variantOptions = [...def.variantOptions];
      properties.push(entry);
    }
    properties.sort((a, b) => order(a.name, b.name));

    const layers = new Map();
    const references = new Map();
    for (const [variant, member] of members.entries()) {
      // A path is the list of layer names below the variant; a repeated sibling name gets " [n]".
      const walk = async (n, path) => {
        const key = JSON.stringify(path);
        let layer = layers.get(key);
        if (!layer) layers.set(key, (layer = { key, path, types: new Set(), in: new Set() }));
        layer.types.add(n.type);
        layer.in.add(variant);
        await visit(n, layer, variant);
        if (n.type === 'INSTANCE') {
          const main = await n.getMainComponentAsync();
          const source = main ? familyOf(main) : null;
          const refKey = source ? source.id : 'missing';
          const ref = references.get(refKey) ?? {
            source: source ? source.name : 'missing',
            sourceId: refKey,
            ...(main?.remote ? { remote: true } : {}),
            count: 0,
            variants: new Set(),
            overriddenFields: new Set(),
          };
          references.set(refKey, ref);
          ref.count += 1;
          if (main && main.parent?.type === 'COMPONENT_SET') ref.variants.add(main.name);
          for (const o of n.overrides ?? [])
            for (const f of o.overriddenFields) ref.overriddenFields.add(f);
          // Source-owned layers stay with their source family. Slot contents are authored by
          // this composition, so export them here (including nested slots, once per owner).
          const slots = n.findAllWithCriteria({ types: ['SLOT'] });
          for (const slot of slots) {
            let owner = slot.parent;
            while (owner && owner.type !== 'INSTANCE') owner = owner.parent;
            if (owner !== n) continue;
            await walk(slot, [...path, slot.name]);
          }
          return;
        }
        if ('children' in n) {
          const seen = new Map();
          for (const child of n.children) {
            const count = (seen.get(child.name) ?? 0) + 1;
            seen.set(child.name, count);
            await walk(child, [...path, count === 1 ? child.name : `${child.name} [${count}]`]);
          }
        }
      };
      await walk(member, []);
    }

    const all = members.length;
    // A value used by every variant that has the layer is written bare; otherwise with its variant indexes.
    const fieldsOut = (fields, layerIn) => {
      if (!fields) return undefined;
      const out = {};
      for (const field of [...fields.keys()].sort(order)) {
        out[field] = [...fields.get(field)]
          .sort(([a], [b]) => order(String(a), String(b)))
          .map(([value, variants]) =>
            variants.size === layerIn.size
              ? value
              : { value, variants: [...variants].sort((a, b) => a - b) },
          );
      }
      return out;
    };

    return {
      id: node.id,
      name: node.name,
      page: page.id,
      frame: frame.name,
      kind: node.type,
      ...(node.description ? { description: node.description } : {}),
      properties,
      variants: members.map((m) => ({
        id: m.id,
        name: m.name,
        ...(node.type === 'COMPONENT_SET' ? { values: { ...m.variantProperties } } : {}),
      })),
      layers: [...layers.values()]
        .sort((a, b) => comparePaths(a.path, b.path))
        .map((l) => ({
          path: l.path,
          types: [...l.types].sort(order),
          ...(l.in.size === all ? {} : { in: [...l.in].sort((a, b) => a - b) }),
          ...(l.bound ? { bound: fieldsOut(l.bound, l.in) } : {}),
          ...(l.literals ? { literals: fieldsOut(l.literals, l.in) } : {}),
          ...(l.properties ? { properties: fieldsOut(l.properties, l.in) } : {}),
        })),
      instances: [...references.values()]
        .sort((a, b) => order(a.source, b.source) || order(a.sourceId, b.sourceId))
        .map((r) => ({
          ...r,
          variants: [...r.variants].sort(order),
          overriddenFields: [...r.overriddenFields].sort(order),
        })),
    };
  };

  const pages = [];
  const families = [];
  for (const pageId of pageIds) {
    const page = await figma.getNodeByIdAsync(pageId);
    await page.loadAsync();
    pages.push({ id: page.id, name: page.name });
    const found = page
      .findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] })
      .filter((n) => !(n.type === 'COMPONENT' && n.parent?.type === 'COMPONENT_SET'))
      .sort((a, b) => order(a.name, b.name) || order(a.id, b.id));
    for (const node of found) families.push(await exportFamily(node, page));
  }

  return { fileKey: figma.fileKey, fileName: figma.root.name, exportedAt, pages, families };
}
