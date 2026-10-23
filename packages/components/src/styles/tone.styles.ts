import { css } from '@oddkin/core/styles';
import type { TemplateResult } from '@oddkin/core/template';
import { token } from '@oddkin/tokens/refs';
import { checkCircleGlyph, infoGlyph, warningGlyph } from './glyphs.js';

/** Meaning colours (ADR 0045 §3), in one place for every element that takes `tone`. */
export const TONES = ['neutral', 'info', 'success', 'warning', 'danger'] as const;
export type Tone = (typeof TONES)[number];

/**
 * Tone colours for the host's `tone` attribute or a `data-tone` element in the shadow root, as
 * private properties the element's own styles read: `--_tone-foreground`, `--_tone-surface`,
 * `--_tone-border`. Neutral when no tone is set.
 */
export const toneStyles = css`
  :host,
  [data-tone] {
    --_tone-foreground: ${token('color.neutral.foreground')};
    --_tone-surface: ${token('color.neutral.surface')};
    --_tone-border: ${token('color.neutral.border')};
  }
  :host([tone='info']),
  [data-tone='info'] {
    --_tone-foreground: ${token('color.info.foreground')};
    --_tone-surface: ${token('color.info.surface')};
    --_tone-border: ${token('color.info.border')};
  }
  :host([tone='success']),
  [data-tone='success'] {
    --_tone-foreground: ${token('color.success.foreground')};
    --_tone-surface: ${token('color.success.surface')};
    --_tone-border: ${token('color.success.border')};
  }
  :host([tone='warning']),
  [data-tone='warning'] {
    --_tone-foreground: ${token('color.warning.foreground')};
    --_tone-surface: ${token('color.warning.surface')};
    --_tone-border: ${token('color.warning.border')};
  }
  :host([tone='danger']),
  [data-tone='danger'] {
    --_tone-foreground: ${token('color.danger.foreground')};
    --_tone-surface: ${token('color.danger.surface')};
    --_tone-border: ${token('color.danger.border')};
  }
`;

/** The glyph that marks a tone, so meaning never depends on colour alone (Figma's choices). */
export function toneGlyph(tone: Tone): TemplateResult {
  return tone === 'success'
    ? checkCircleGlyph
    : tone === 'warning' || tone === 'danger'
      ? warningGlyph
      : infoGlyph;
}
