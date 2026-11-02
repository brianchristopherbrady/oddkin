// An element that finishes rendering after a delay, as an Oddkin element's `updateComplete` does.
class FrameFixtureUpdating extends HTMLElement {
  get updateComplete(): Promise<void> {
    return new Promise((resolve) =>
      setTimeout(() => {
        this.setAttribute('data-updated', '');
        resolve();
      }, 50),
    );
  }
}

customElements.define('fixture-updating', FrameFixtureUpdating);
