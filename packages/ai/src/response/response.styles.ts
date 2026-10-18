import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/** Typography for rendered Markdown plus response states. */
export const responseStyles = css`
  .content > :first-child {
    margin-block-start: 0;
  }
  .content > :last-child {
    margin-block-end: 0;
  }
  .content :is(p, ul, ol, blockquote, .code-block, .table-scroll, hr) {
    margin-block: 0 ${token('space.sm')};
  }
  .content :is(h2, h3, h4, h5, h6) {
    margin-block: ${token('space.md')} ${token('space.xs')};
    line-height: ${token('line-height.tight')};
  }
  .content h3 {
    font-size: ${token('font.size.lg')};
  }
  .content :is(h4, h5, h6) {
    font-size: ${token('font.size.md')};
  }
  .content :is(ul, ol) {
    padding-inline-start: ${token('space.lg')};
  }
  .content blockquote {
    margin-inline: 0;
    padding-inline-start: ${token('space.sm')};
    border-inline-start: ${token('border.width.strong')} solid ${token('color.border.strong')};
    color: ${token('color.text.secondary')};
  }
  .content a {
    color: ${token('color.text.link')};
  }
  .content .unsafe-link {
    text-decoration-line: underline;
    text-decoration-style: dotted;
  }
  .content code {
    font-family: ${token('font.family.mono')};
    font-size: 0.9em;
  }
  .content :not(pre) > code {
    padding-inline: 0.25em;
    border-radius: ${token('radius.sm')};
    background: ${token('color.surface.sunken')};
  }
  .code-block {
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('radius.md')};
    background: var(--odd-response-code-background, ${token('color.surface.sunken')});
  }
  .code-block pre {
    margin: 0;
    padding: ${token('space.sm')};
    overflow-x: auto;
    white-space: pre;
  }
  .code-block .copy-code {
    margin: 0 ${token('space.2xs')} ${token('space.2xs')};
  }
  .tok-keyword {
    color: ${token('color.text.link')};
    font-weight: ${token('font.weight.semibold')};
  }
  .tok-string {
    color: ${token('color.text.success')};
  }
  .tok-comment {
    color: ${token('color.text.secondary')};
    font-style: italic;
  }
  .tok-number {
    color: ${token('color.text.danger')};
  }
  .table-scroll {
    overflow-x: auto;
  }
  .content table {
    border-collapse: collapse;
    font-size: ${token('font.size.sm')};
  }
  .content :is(th, td) {
    padding: ${token('space.2xs')} ${token('space.xs')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    text-align: start;
    vertical-align: top;
  }
  .content [data-align='center'] {
    text-align: center;
  }
  .content [data-align='right'] {
    text-align: end;
  }
  .content .raw-html {
    font-family: ${token('font.family.mono')};
    font-size: ${token('font.size.sm')};
    white-space: pre-wrap;
  }
  .status-line {
    margin: ${token('space.xs')} 0 0;
    color: ${token('color.text.secondary')};
    font-size: ${token('font.size.sm')};
  }
  .status-line[data-status='failed'] {
    color: ${token('color.text.danger')};
  }
  .status-line[data-status='streaming']::before {
    content: '';
    display: inline-block;
    inline-size: 0.5em;
    block-size: 0.5em;
    margin-inline-end: ${token('space.2xs')};
    border-radius: ${token('radius.full')};
    background: currentColor;
    animation: odd-response-pulse 1.2s ease-in-out infinite;
  }
  @keyframes odd-response-pulse {
    50% {
      opacity: 0.3;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .status-line[data-status='streaming']::before {
      animation: none;
    }
  }
  .actions {
    margin-block-start: ${token('space.2xs')};
  }
  @media (forced-colors: active) {
    .code-block,
    .content :is(th, td) {
      border-color: CanvasText;
    }
  }
`;
