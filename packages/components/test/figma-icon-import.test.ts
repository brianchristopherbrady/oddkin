import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

// The importer runs inside Figma; model only the documented geometry/paint API it uses.
it('imports scalable artwork even when the new component starts at a different canvas size', async () => {
  const opaque = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
  const vector = {
    id: 'vector',
    type: 'VECTOR',
    fills: opaque,
    strokes: opaque,
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
  };
  const nested = {
    id: 'nested',
    type: 'FRAME',
    fills: opaque,
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
  };
  const artwork = {
    id: 'artwork',
    type: 'FRAME',
    name: '',
    fills: opaque,
    width: 20,
    height: 20,
    x: 0,
    y: 0,
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
    findAll: () => [nested, vector],
  };
  let removed = false;
  const old = {
    remove: () => {
      removed = true;
    },
  };
  const component = {
    id: 'component',
    width: 100,
    height: 100,
    fills: opaque,
    clipsContent: true,
    children: [old] as any[],
    resize(width: number, height: number) {
      for (const child of this.children) {
        if (child.constraints?.horizontal === 'SCALE') child.width *= width / this.width;
        if (child.constraints?.vertical === 'SCALE') child.height *= height / this.height;
      }
      this.width = width;
      this.height = height;
    },
    appendChild(child: unknown) {
      this.children.push(child);
    },
    findAll: () => [artwork, nested, vector],
  };
  const source = readFileSync(
    new URL('../../../design/icons/figma-import.js', import.meta.url),
    'utf8',
  );
  const { replaceIconArtwork, auditIconArtwork } = runInNewContext(
    source + '\n({replaceIconArtwork, auditIconArtwork})',
    {
      figma: {
        createNodeFromSvg: () => artwork,
        variables: {
          setBoundVariableForPaint: (paint: object, field: string, variable: { id: string }) => ({
            ...paint,
            boundVariables: { [field]: { type: 'VARIABLE_ALIAS', id: variable.id } },
          }),
        },
      },
    },
  );
  const variable = { id: 'foreground' };
  await expect(replaceIconArtwork(component, '<svg/>', variable)).resolves.toBe(artwork);
  expect([artwork.width, artwork.height]).toEqual([20, 20]);
  expect(component.fills).toEqual([]);
  expect(component.clipsContent).toBe(false);
  expect(removed).toBe(true);
  expect(auditIconArtwork([component])).toEqual([]);
  artwork.constraints.horizontal = 'MIN';
  expect(auditIconArtwork([component])).toContainEqual({
    component: 'component',
    node: 'artwork',
    issue: 'non-scaling geometry',
  });
  expect(vector.strokes[0]).toMatchObject({ boundVariables: { color: { id: 'foreground' } } });
});
