import { css } from '@oddkin/core/styles';

/**
 * The slider is a block. The label and the output share a row; the endpoint labels sit under the
 * track's ends. The slider area insets the track by half a thumb, so the thumb's centre travels the
 * track from end to end, and takes touch drags itself (`touch-action: none`). The fill and the thumb
 * follow `--_fraction` (0 to 1), mirrored in right-to-left text. No brand tokens.
 */
export const sliderStructuralStyles = css`
  :host {
    display: block;
    --_thumb: 1.25rem;
  }
  .heading,
  .endpoints {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .heading > .output {
    margin-inline-start: auto;
  }
  .slider {
    position: relative;
    display: grid;
    align-items: center;
    padding-inline: calc(var(--_thumb) / 2);
    touch-action: none;
    cursor: pointer;
  }
  :host(:disabled) .slider {
    cursor: not-allowed;
  }
  .track {
    position: relative;
    block-size: 0.25rem;
  }
  .fill {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    inline-size: calc(var(--_fraction) * 100%);
  }
  .thumb {
    position: absolute;
    box-sizing: border-box;
    inline-size: var(--_thumb);
    block-size: var(--_thumb);
    inset-inline-start: calc(var(--_fraction) * (100% - var(--_thumb)));
  }
  @media (forced-colors: active) {
    .track {
      background: GrayText;
    }
    .slider > .track > .fill {
      background: Highlight;
    }
    .slider > .thumb {
      border: 2px solid ButtonText;
      background: ButtonFace;
    }
    :host(:disabled) .slider > .track > .fill {
      background: GrayText;
    }
  }
`;
