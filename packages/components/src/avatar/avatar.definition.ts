import { compose } from '@oddkin/core/element';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinAvatar } from './avatar.js';
import { avatarStructuralStyles } from './avatar.structural.styles.js';
import { avatarStyles } from './avatar.styles.js';
import { avatarTemplate } from './avatar.template.js';

export const avatarDefinition = compose({
  name: 'odd-avatar',
  element: OddkinAvatar,
  template: avatarTemplate,
  styles: [hostStyles, avatarStructuralStyles, avatarStyles],
});
