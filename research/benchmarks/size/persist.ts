// A store persisted under a key with a migration: @oddkin/state/persist with the store.
import { persist } from '@oddkin/state/persist';
import { createStore } from '@oddkin/state/store';

const prefs = createStore({ theme: 'light', dense: false });
export const persistence = persist(prefs, {
  key: 'prefs',
  version: 2,
  migrate: { 2: (data) => ({ ...(data as object), dense: false }) },
});
