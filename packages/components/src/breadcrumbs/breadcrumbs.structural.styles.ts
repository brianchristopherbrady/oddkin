import { css } from '@oddkin/core/styles';

/**
 * One wrapping row of items with separators between them. No brand or visual tokens.
 */
export const breadcrumbsStructuralStyles = css`
  :host {
    display: block;
  }
  .list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .item {
    display: inline-flex;
    align-items: center;
    min-inline-size: 0;
  }
  .link,
  .current,
  .more {
    display: inline-flex;
    align-items: center;
  }
  .link {
    text-decoration: none;
  }
  .link:hover {
    text-decoration: underline;
  }
  .more {
    justify-content: center;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    cursor: pointer;
  }
  .separator {
    display: inline-flex;
  }
  ::slotted(svg) {
    flex: none;
  }
  @media (forced-colors: active) {
    .breadcrumbs .link {
      color: LinkText;
    }
    .breadcrumbs .current,
    .breadcrumbs .separator {
      color: CanvasText;
    }
    .breadcrumbs .more {
      color: ButtonText;
    }
  }
`;
