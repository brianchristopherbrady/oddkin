import { MoteElement, css, html, prop, when } from '@mote/core';
import { styleMap } from '@mote/core/helpers/style-map';

const toneColors = { plain: 'currentcolor', warm: '#9a3412', formal: '#1e3a5f' } as const;

/** A greeting with typed public properties, attribute conversion, and opt-in reflection. */
export class DemoGreeting extends MoteElement.with({
  name: prop.string({ default: 'world', description: 'Who to greet.' }),
  excited: prop.boolean({ reflect: true, description: 'Adds emphasis; reflected for styling.' }),
  tone: prop.enum(['plain', 'warm', 'formal'], { default: 'plain', reflect: true }),
  history: prop.array<string>({ description: 'Previous names (property only).' }),
}) {
  static override styles = css`
    :host {
      display: block;
    }
    p {
      margin: 0;
      font-size: 1.5rem;
    }
    :host([excited]) p {
      font-style: italic;
    }
    small {
      display: block;
      opacity: 0.75;
    }
  `;

  protected override render() {
    const salutation =
      this.tone === 'formal' ? 'Good day' : this.tone === 'warm' ? 'Lovely to see you' : 'Hello';
    return html`
      <p style=${styleMap({ color: toneColors[this.tone] })}>
        ${salutation}, ${this.name}${this.excited ? '!' : '.'}
      </p>
      ${when(this.history.length > 0, () => html`<small>Earlier: ${this.history.join(', ')}</small>`)}
    `;
  }
}
