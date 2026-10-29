import { CUSTOM_ELEMENTS_SCHEMA, Component, signal } from '@angular/core';

// Angular does not type-check custom elements in templates: CUSTOM_ELEMENTS_SCHEMA allows them.
@Component({
  selector: 'app-root',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <main class="odd-stack">
      <odd-card>
        <h1 slot="header">Sign up</h1>
        <form id="signup" class="odd-stack" (submit)="submit($event)">
          <odd-input
            name="email"
            label="Email"
            type="email"
            required
            (input)="typed.set(valueOf($event))"
          ></odd-input>
          <odd-checkbox name="updates" value="yes">Send me updates</odd-checkbox>
          <odd-button type="submit" appearance="primary">Join</odd-button>
        </form>
        <p id="typed">{{ typed() }}</p>
        <output id="result">{{ result() }}</output>
      </odd-card>
    </main>
  `,
})
export class App {
  protected readonly typed = signal('');
  protected readonly result = signal('');

  protected valueOf(event: Event): string {
    return (event.currentTarget as HTMLElementTagNameMap['odd-input']).value;
  }

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    this.result.set(JSON.stringify(Object.fromEntries(new FormData(form))));
  }
}
