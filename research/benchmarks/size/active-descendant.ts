// A listbox that keeps DOM focus while arrows move the active option:
// @oddkin/core/controllers/active-descendant with a Scope, nothing else.
import { ActiveDescendant } from '@oddkin/core/controllers/active-descendant';
import { createScope } from '@oddkin/core/scope';

export function attach(listbox: HTMLElement) {
  const scope = createScope();
  scope.use(
    new ActiveDescendant({
      target: () => listbox,
      items: () => [...listbox.querySelectorAll<HTMLElement>('[role="option"]')],
      onActiveChange: (_index, item) => {
        for (const option of listbox.querySelectorAll('.active')) option.classList.remove('active');
        item?.classList.add('active');
      },
    }),
  );
  return scope;
}
