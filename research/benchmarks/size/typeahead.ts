// Type-to-select over a list: @oddkin/core/controllers/typeahead with a Scope, nothing else.
import { Typeahead } from '@oddkin/core/controllers/typeahead';
import { createScope } from '@oddkin/core/scope';

export function attach(list: HTMLElement) {
  const scope = createScope();
  const items = () => [...list.querySelectorAll<HTMLElement>('[role="option"]')];
  let active = -1;
  scope.use(
    new Typeahead({
      target: () => list,
      items,
      active: () => active,
      onMatch: (index, item) => {
        active = index;
        item.focus();
      },
    }),
  );
  return scope;
}
