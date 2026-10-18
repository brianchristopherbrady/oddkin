import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

export const taskPlanStyles = css`
  .base {
    display: grid;
    gap: ${token('space.sm')};
  }
  .title {
    margin: 0;
    font-weight: ${token('font.weight.semibold')};
  }
  .progress {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${token('space.xs')};
  }
  progress {
    inline-size: min(100%, 16rem);
  }
  .steps,
  .tasks {
    display: grid;
    gap: ${token('space.xs')};
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .step,
  .task {
    display: flex;
    gap: ${token('space.xs')};
    align-items: baseline;
  }
  .task {
    font-size: ${token('font.size.sm')};
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-inline-size: 0;
  }
  .symbol {
    inline-size: 1.25em;
    flex: none;
    text-align: center;
    color: ${token('color.text.secondary')};
  }
  [data-status='done'] > .symbol {
    color: ${token('color.success.foreground')};
  }
  [data-status='failed'] > .symbol,
  [data-status='blocked'] > .symbol {
    color: ${token('color.danger.foreground')};
  }
  [data-status='active'] > .body > .step-title,
  [data-status='needs-input'] > .body > .step-title {
    font-weight: ${token('font.weight.semibold')};
  }
  .detail,
  .request {
    font-size: ${token('font.size.sm')};
  }
  .parallel {
    margin: ${token('space.2xs')} 0 0;
  }
  .tasks {
    padding-inline-start: ${token('space.xs')};
    border-inline-start: ${token('border.width.default')} solid ${token('color.border.default')};
  }
`;
