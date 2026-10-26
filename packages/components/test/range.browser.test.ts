import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createScope, scopeStats } from '@oddkin/core/scope';
import { pointerDrag } from '../src/form-control/range.js';

// The pointer drag of the shared range pieces (src/form-control/range.ts), used by odd-slider and
// the colour picker. Stepping, snapping, and keys are tested through odd-input and odd-slider.
let area: HTMLElement;
beforeEach(() => {
  area = document.createElement('div');
  area.style.cssText = 'position: fixed; left: 100px; top: 100px; width: 220px; height: 120px';
  document.body.append(area);
});
afterEach(() => area.remove());

const at = (type: string, x: number, y: number, pointerId = 7) =>
  (type === 'pointerdown' ? area : document).dispatchEvent(
    new PointerEvent(type, { clientX: x, clientY: y, pointerId, bubbles: true, composed: true }),
  );
const press = () => new PointerEvent('pointerdown', { clientX: 210, clientY: 160, pointerId: 7 });

describe('pointerDrag', () => {
  it('reports fractions inside the inset, clamped to 0..1, mirrored right to left', () => {
    const scope = createScope();
    const moves: number[][] = [];
    pointerDrag(scope, area, press(), { inset: 10, move: (x, y) => moves.push([x, y]) });
    at('pointermove', 110, 110);
    at('pointermove', 50, 400);
    at('pointermove', 330, 40);
    at('pointerup', 330, 40);
    expect(moves).toEqual([
      [0.5, 0.5],
      [0, 0],
      [0, 1],
      [1, 0],
    ]);
    area.dir = 'rtl';
    pointerDrag(scope, area, press(), { inset: 10, move: (x, y) => moves.push([x, y]) });
    at('pointermove', 110, 110);
    at('pointerup', 110, 110);
    expect(moves.slice(-2)).toEqual([
      [0.5, 0.5],
      [1, 0],
    ]);
    scope.dispose();
  });

  it('follows only its pointer, ends once on release or cancel, and leaves no listeners', () => {
    const before = scopeStats();
    const scope = createScope();
    for (const finish of ['pointerup', 'pointercancel']) {
      const log: string[] = [];
      pointerDrag(scope, area, press(), {
        inset: 0,
        move: (x) => log.push(`move ${x}`),
        end: () => log.push('end'),
      });
      at('pointermove', 320, 160, 8);
      at(finish, 320, 160, 8);
      at('pointermove', 100, 160);
      at(finish, 100, 160);
      at('pointermove', 320, 160);
      at(finish, 320, 160);
      expect([finish, log]).toEqual([finish, ['move 0.5', 'move 0', 'end']]);
    }
    scope.dispose();
    expect(scopeStats()).toEqual(before);
  });

  it('captures the pointer it follows', async () => {
    const scope = createScope();
    const captured: boolean[] = [];
    area.addEventListener('pointerdown', (event) => {
      pointerDrag(scope, area, event, { inset: 0, move: () => {} });
      captured.push(area.hasPointerCapture(event.pointerId));
    });
    // A real pointer (synthetic ones cannot be captured).
    await userEvent.click(area);
    expect(captured).toEqual([true]);
    scope.dispose();
  });
});
