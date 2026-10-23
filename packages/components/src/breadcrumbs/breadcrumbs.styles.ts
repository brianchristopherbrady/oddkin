import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default breadcrumbs: Figma `Breadcrumbs` (a default surface with `control/radius`;
 * links in the link colour, the current page in primary text, chevrons between).
 */
export const breadcrumbsStyles = css`
  .breadcrumbs {
    padding: ${token('space.xs')} ${token('space.sm')};
    border-radius: var(--odd-breadcrumbs-radius, ${token('control.radius')});
    background: ${token('color.surface.default')};
    color: ${token('color.text.primary')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
  }
  .list,
  .item {
    gap: ${token('space.sm')};
  }
  .link,
  .current,
  .more {
    min-block-size: ${token('control.height.sm')};
  }
  .link {
    border-radius: ${token('control.radius')};
    color: ${token('color.link')};
  }
  .more {
    min-inline-size: ${token('control.height.sm')};
    border-radius: ${token('control.radius')};
    color: ${token('color.text.primary')};
    font-size: ${token('icon.size.md')};
  }
  .separator {
    font-size: ${token('icon.size.sm')};
  }
  @media (hover: hover) {
    .more:hover {
      background: ${token('color.surface.hover')};
    }
  }
`;
