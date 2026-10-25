import { describe, expect, it } from 'vitest';
import { exportComponents } from '../../../design/figma/components.export.js';

// A composition owns what it places into an instance's slots. Inherited source internals
// belong to the source family, including when a slotted instance itself contains a slot.
function node(id: string, name: string, type = 'FRAME', children: any[] = []): any {
  const result: any = { id, name, type, children, componentPropertyDefinitions: {} };
  for (const child of children) child.parent = result;
  result.findAllWithCriteria = ({ types }: { types: string[] }) => {
    const all: any[] = [];
    const visit = (parent: any) => {
      for (const child of parent.children ?? []) {
        if (types.includes(child.type)) all.push(child);
        visit(child);
      }
    };
    visit(result);
    return all;
  };
  return result;
}
function instance(id: string, name: string, main: any, children: any[] = []) {
  const result = node(id, name, 'INSTANCE', children);
  result.getMainComponentAsync = async () => main;
  return result;
}

describe('Figma component exporter: composition slots', () => {
  it('exports nested slot contents once and leaves inherited source internals with the source', async () => {
    const sourcePage = node('2:1', 'Sources', 'PAGE');
    const main = (id: string, name: string) => {
      const result = node(id, name, 'COMPONENT');
      result.parent = sourcePage;
      return result;
    };
    const outerMain = main('2:2', 'Popover');
    const innerMain = main('2:3', 'Tree');
    const leafMain = main('2:4', 'Selected value');
    const inheritedMain = main('2:5', 'Inherited source detail');
    const leaf = instance('1:6', 'Leaf', leafMain);
    const nestedSlot = node('1:5', 'Content', 'SLOT', [leaf]);
    const inner = instance('1:4', 'Inner', innerMain, [nestedSlot]);
    const slot = node('1:3', 'Content', 'SLOT', [inner]);
    const inherited = instance('1:7', 'Source detail', inheritedMain);
    const outer = instance('1:2', 'Outer', outerMain, [slot, inherited]);
    const composition = node('1:1', 'Picker', 'COMPONENT', [outer]);
    const page = node('0:1', 'Composed components', 'PAGE', [composition]);
    page.loadAsync = async () => {};
    // Source definitions live on another page, so this export selects the composition only.
    page.findAllWithCriteria = () => [composition];
    const figma = {
      fileKey: 'test',
      root: { name: 'Fixture' },
      mixed: Symbol('mixed'),
      getNodeByIdAsync: async () => page,
    };
    const snapshot = await exportComponents(figma, ['0:1'], '2026-10-24');
    const family = snapshot.families[0]!;
    expect(family.instances.map((r: any) => [r.source, r.count])).toEqual([
      ['Popover', 1],
      ['Selected value', 1],
      ['Tree', 1],
    ]);
    expect(family.layers.map((l: any) => l.path)).toContainEqual([
      'Outer',
      'Content',
      'Inner',
      'Content',
      'Leaf',
    ]);
    expect(family.instances.some((r: any) => r.source === inheritedMain.name)).toBe(false);
  });
});
