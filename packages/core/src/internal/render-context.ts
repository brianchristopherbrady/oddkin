/**
 * Render-phase marker shared by DOM and DOM-free modules (no DOM access). `MoteElement`
 * increments it around `render()` so definition-time APIs can diagnose calls made
 * during rendering.
 * @internal
 */
let depth = 0;

export function enterRender(): void {
  depth++;
}

export function exitRender(): void {
  depth--;
}

export function isRendering(): boolean {
  return depth > 0;
}
