import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinMessageBranch } from './message-branch.js';
import { messageBranchStyles } from './message-branch.styles.js';
import { messageBranchTemplate } from './message-branch.template.js';

export const messageBranchDefinition = compose({
  name: 'odd-message-branch',
  element: OddkinMessageBranch,
  template: messageBranchTemplate,
  styles: [aiBaseStyles, messageBranchStyles],
});
