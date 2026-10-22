// Read-only Figma Plugin API check behind the text-contrast findings in design/figma/reuse.json (`figmaIssues`).
// Run through the Figma MCP `use_figma` tool (drop `export`, call it, return the result). For every visible text
// layer in every component on the given pages, it composites the solid fills painted below the text's centre
// (depth-first paint order, ancestors and earlier siblings) and reports WCAG 2.2 contrast below 4.5:1 (3:1 for
// large text: >= 24px, or >= 18.66px bold). Colours are the values Figma resolved for the mode each component shows.

/** @param {any} figma The Plugin API global. @param {string[]} pageIds */
export async function checkTextContrast(figma, pageIds) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const over = (top, alpha, bottom) => ({
    r: top.r * alpha + bottom.r * (1 - alpha),
    g: top.g * alpha + bottom.g * (1 - alpha),
    b: top.b * alpha + bottom.b * (1 - alpha),
  });
  const hex2 = (n) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, '0');
  const hex = (c) => `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
  const solids = (n) =>
    'fills' in n && n.fills !== figma.mixed
      ? n.fills.filter((p) => p.visible !== false && p.type === 'SOLID')
      : [];
  const inside = (box, x, y) =>
    box && x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;

  const failures = [];
  let checked = 0;
  for (const pageId of pageIds) {
    const page = await figma.getNodeByIdAsync(pageId);
    await page.loadAsync();
    for (const component of page.findAllWithCriteria({ types: ['COMPONENT'] })) {
      const order = [];
      const walk = (n) => {
        if (n.visible === false) return;
        order.push(n);
        if ('children' in n) for (const c of n.children) walk(c);
      };
      walk(component);
      // What lies under the component on the page: the nearest filled ancestor, else white.
      let base = { r: 1, g: 1, b: 1 };
      for (let a = component.parent; a && a.type !== 'PAGE'; a = a.parent) {
        const f = solids(a);
        if (f.length) {
          base = f.reduce(
            (acc, p) => over(p.color, (p.opacity ?? 1) * (a.opacity ?? 1), acc),
            base,
          );
          break;
        }
      }
      const family =
        component.parent?.type === 'COMPONENT_SET' ? component.parent.name : component.name;
      for (const [i, text] of order.entries()) {
        if (text.type !== 'TEXT' || !text.characters.trim()) continue;
        const fg = solids(text);
        if (!fg.length || text.fontSize === figma.mixed || text.fontName === figma.mixed) continue;
        const box = text.absoluteBoundingBox;
        if (!box) continue;
        const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
        let bg = base;
        for (const n of order.slice(0, i)) {
          if (n.type === 'TEXT') continue;
          if (!inside(n.absoluteBoundingBox, x, y)) continue;
          for (const p of solids(n)) bg = over(p.color, (p.opacity ?? 1) * (n.opacity ?? 1), bg);
        }
        const top = fg[fg.length - 1];
        const color = over(top.color, (top.opacity ?? 1) * (text.opacity ?? 1), bg);
        const bold =
          /bold|black|heavy/i.test(text.fontName.style) && !/semi/i.test(text.fontName.style);
        const large = text.fontSize >= 24 || (bold && text.fontSize >= 18.66);
        const need = large ? 3 : 4.5;
        const r = ratio(color, bg);
        checked++;
        if (r < need)
          failures.push({
            page: pageId,
            family,
            variant: component.parent?.type === 'COMPONENT_SET' ? component.name : undefined,
            text: text.characters.slice(0, 40),
            fg: hex(color),
            bg: hex(bg),
            ratio: Math.round(r * 100) / 100,
            need,
            font: `${text.fontSize}px ${text.fontName.style}`,
          });
      }
    }
  }
  return { checked, failures };
}
