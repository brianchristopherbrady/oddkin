// Read-only Figma Plugin API export behind design/figma/variables.json. To refresh the snapshot, run
// this function through the Figma MCP `use_figma` tool (drop `export`, call it, return the JSON in
// slices under the tool's return limit), join the slices, add `$schema` and `source`, and format.
// It only reads: variables, collections, text styles, effect styles. Tests never call Figma.

/** @param {any} figma The Plugin API global. @param {string} exportedAt Date only (YYYY-MM-DD). */
export async function exportVariables(figma, exportedAt) {
  const hex2 = (n) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, '0');
  const hex = (c) =>
    `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}${c.a === undefined || Math.round(c.a * 255) === 255 ? '' : hex2(c.a)}`;
  const round = (n) => Math.round(n * 10000) / 10000;
  const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const byName = (a, b) => order(a.name, b.name);

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();
  const collectionById = new Map(collections.map((c) => [c.id, c]));
  const variableById = new Map(variables.map((v) => [v.id, v]));
  const path = async (id) => {
    const v = variableById.get(id) ?? (await figma.variables.getVariableByIdAsync(id));
    if (!v) return `missing:${id}`;
    const c =
      collectionById.get(v.variableCollectionId) ??
      (await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId));
    return `${c ? c.name : v.variableCollectionId}/${v.name}`;
  };
  const bound = async (boundVariables) => {
    const entries = [];
    for (const [field, alias] of Object.entries(boundVariables ?? {})) {
      if (Array.isArray(alias))
        entries.push([field, await Promise.all(alias.map((a) => path(a.id)))]);
      else if (alias?.id) entries.push([field, await path(alias.id)]);
    }
    return entries.length ? Object.fromEntries(entries.sort(([a], [b]) => order(a, b))) : undefined;
  };

  const outCollections = [];
  for (const c of collections) {
    const modeName = new Map(c.modes.map((m) => [m.modeId, m.name]));
    const vars = [];
    for (const id of c.variableIds) {
      const v = variableById.get(id);
      if (!v) continue;
      const values = [];
      for (const [modeId, value] of Object.entries(v.valuesByMode)) {
        const entry =
          value && typeof value === 'object' && value.type === 'VARIABLE_ALIAS'
            ? { alias: await path(value.id) }
            : value && typeof value === 'object' && 'r' in value
              ? { value: hex(value) }
              : { value: typeof value === 'number' ? round(value) : value };
        values.push([modeName.get(modeId) ?? modeId, entry]);
      }
      vars.push({
        id: v.id,
        name: v.name,
        type: v.resolvedType,
        ...(v.description ? { description: v.description } : {}),
        scopes: [...v.scopes],
        ...(v.codeSyntax && Object.keys(v.codeSyntax).length
          ? { codeSyntax: { ...v.codeSyntax } }
          : {}),
        ...(v.hiddenFromPublishing ? { hiddenFromPublishing: true } : {}),
        valuesByMode: Object.fromEntries(values.sort(([a], [b]) => order(a, b))),
      });
    }
    outCollections.push({
      id: c.id,
      name: c.name,
      modes: c.modes.map((m) => ({ id: m.modeId, name: m.name })),
      defaultModeId: c.defaultModeId,
      variables: vars.sort(byName),
    });
  }

  const textStyles = [];
  for (const s of await figma.getLocalTextStylesAsync()) {
    const unitValue = (u) =>
      'value' in u ? { unit: u.unit, value: round(u.value) } : { unit: u.unit };
    const b = await bound(s.boundVariables);
    textStyles.push({
      id: s.id,
      name: s.name,
      ...(s.description ? { description: s.description } : {}),
      fontFamily: s.fontName.family,
      fontStyle: s.fontName.style,
      fontSize: round(s.fontSize),
      lineHeight: unitValue(s.lineHeight),
      letterSpacing: unitValue(s.letterSpacing),
      textCase: s.textCase,
      textDecoration: s.textDecoration,
      paragraphSpacing: round(s.paragraphSpacing),
      ...(b ? { boundVariables: b } : {}),
    });
  }

  const effectStyles = [];
  for (const s of await figma.getLocalEffectStylesAsync()) {
    const effects = [];
    for (const e of s.effects) {
      const b = await bound(e.boundVariables);
      effects.push({
        type: e.type,
        visible: e.visible,
        ...('color' in e
          ? { color: hex({ r: e.color.r, g: e.color.g, b: e.color.b }), alpha: round(e.color.a) }
          : {}),
        ...('offset' in e ? { offset: { x: round(e.offset.x), y: round(e.offset.y) } } : {}),
        ...('radius' in e ? { radius: round(e.radius) } : {}),
        ...('spread' in e ? { spread: round(e.spread) } : {}),
        ...('blendMode' in e ? { blendMode: e.blendMode } : {}),
        ...('showShadowBehindNode' in e ? { showShadowBehindNode: e.showShadowBehindNode } : {}),
        ...(b ? { boundVariables: b } : {}),
      });
    }
    const b = await bound(s.boundVariables);
    effectStyles.push({
      id: s.id,
      name: s.name,
      ...(s.description ? { description: s.description } : {}),
      effects,
      ...(b ? { boundVariables: b } : {}),
    });
  }

  return {
    fileKey: figma.fileKey,
    fileName: figma.root.name,
    exportedAt,
    collections: outCollections.sort(byName),
    textStyles: textStyles.sort(byName),
    effectStyles: effectStyles.sort(byName),
  };
}
