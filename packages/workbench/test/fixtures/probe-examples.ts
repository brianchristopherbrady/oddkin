// The probe's example module as Workbench serves it: the fixture the frame runs for `fixtureOnly`.
export default {
  component: 'wb-probe',
  examples: {
    fixtureOnly: {
      label: 'Fixture only',
      fixture({ element }: { element: HTMLElement }) {
        element.textContent = 'Set up by its fixture';
      },
    },
  },
};
