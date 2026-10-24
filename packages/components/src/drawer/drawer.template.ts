import { dialogTemplate } from '../dialog/dialog.template.js';
import type { OddkinDrawer } from './drawer.js';

/**
 * Anatomy: odd-dialog's. `part="dialog"`, a native `<dialog>` with the shared sheet look, holds the
 * `header` (the `title`, the header slot, and, unless `no-close`, the `close` button), the `body`
 * with the default slot, and the `footer` with the footer slot, hidden while it is empty.
 */
export const drawerTemplate = (drawer: OddkinDrawer) => dialogTemplate(drawer);
