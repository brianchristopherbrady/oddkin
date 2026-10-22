// An overlay placed against its anchor: @oddkin/core/controllers/position with a Scope, nothing else.
import { PositionController } from '@oddkin/core/controllers/position';
import { createScope } from '@oddkin/core/scope';

export function attach(anchor: Element, surface: HTMLElement) {
  const scope = createScope();
  scope.use(
    new PositionController({
      anchor: () => anchor,
      surface: () => surface,
      offset: 4,
      onPlace: (placement) =>
        surface.style.setProperty('max-block-size', `${placement.availableHeight}px`),
    }),
  );
  return scope;
}
