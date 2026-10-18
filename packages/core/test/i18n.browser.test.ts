import { afterEach, describe, expect, it } from 'vitest';
import { dirOf, langOf } from '../src/i18n/index.js';

let container: HTMLElement | undefined;
afterEach(() => container?.remove());

describe('langOf and dirOf', () => {
  it('find the nearest lang and the resolved direction across shadow roots', () => {
    container = document.createElement('div');
    container.lang = 'ar';
    container.dir = 'rtl';
    document.body.append(container);
    const host = document.createElement('section');
    container.append(host);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<p id="inner">x</p><div lang="fr" dir="ltr"><span id="fr">y</span></div>';
    const inner = root.getElementById('inner') as HTMLElement;
    const fr = root.getElementById('fr') as HTMLElement;
    expect(langOf(inner)).toBe('ar');
    expect(dirOf(inner)).toBe('rtl');
    expect(langOf(fr)).toBe('fr');
    expect(dirOf(fr)).toBe('ltr');
    container.removeAttribute('lang');
    expect(langOf(inner)).toBe(document.documentElement.lang || undefined);
  });
});
