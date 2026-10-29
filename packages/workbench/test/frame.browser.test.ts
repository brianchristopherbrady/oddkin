import { afterEach, describe, expect, it } from 'vitest';
import { scopeStats } from '@oddkin/core/scope';
import { userEvent } from 'vitest/browser';
import { createIsolatedPreview, previewProtocolStats } from '../src/preview/frame.js';
import { frameEnvelope } from '../src/protocol/index.js';
import type { FrameNotification, FrameMountPayload } from '../src/protocol/index.js';

const previews: ReturnType<typeof createIsolatedPreview>[] = [];
afterEach(() => {
  for (const preview of previews.splice(0)) preview.dispose();
});

async function until(check: () => boolean, message: string) {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((resolve) => setTimeout(resolve, 10));
  if (!check()) throw new Error(`Timed out waiting for ${message}.`);
}

const frameUrl = new URL('./fixtures/frame-test.html', import.meta.url).href;
const registration = new URL('./fixtures/frame-element.ts', import.meta.url).href;
const alternateRegistration = new URL('./fixtures/frame-element-alt.ts', import.meta.url).href;

function createPreview(messages: FrameNotification[] = []) {
  const preview = createIsolatedPreview({
    document,
    container: document.body,
    frameUrl,
    title: 'Fixture preview',
    onMessage: (message) => messages.push(message),
  });
  previews.push(preview);
  return preview;
}

const payload = (overrides: Partial<FrameMountPayload> = {}): FrameMountPayload => ({
  tag: 'fixture-button',
  registration,
  example: 'example:fixture-button/default',
  properties: { label: 'Save' },
  events: ['fixture-action'],
  ...overrides,
});

describe('isolated preview frames', () => {
  it('handshakes and keeps registries, styles, themes, and sizing independent', async () => {
    const before = scopeStats();
    const firstMessages: FrameNotification[] = [];
    const first = createPreview(firstMessages);
    const second = createPreview();
    await Promise.all([first.ready, second.ready]);
    expect(first.identity.frame).not.toBe(second.identity.frame);
    expect(first.identity.generation).toBe(1);

    await first.request('settings', { mode: 'dark' });
    try {
      await first.request('mount', payload());
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}; frame notifications: ${JSON.stringify(firstMessages)}; frame document: ${first.iframe.contentDocument?.documentElement.outerHTML}`,
      );
    }
    await second.request('mount', payload({ properties: { label: 'Cancel' } }));
    await second.request('settings', { mode: 'light' });
    const firstDoc = first.iframe.contentDocument!;
    const secondDoc = second.iframe.contentDocument!;
    const firstButton = firstDoc.querySelector('fixture-button')!;
    const secondButton = secondDoc.querySelector('fixture-button')!;
    expect(firstButton).not.toBe(secondButton);
    expect(firstButton.shadowRoot?.textContent).toContain('Save');
    expect(secondButton.shadowRoot?.textContent).toContain('Cancel');

    await first.request('set', { property: 'label', value: 'Continue' });
    expect(firstButton.shadowRoot?.textContent).toContain('Continue');
    expect(secondButton.shadowRoot?.textContent).toContain('Cancel');
    await first.request('settings', {
      container: { width: 320 },
      direction: 'rtl',
      mode: 'dark',
    });
    expect(firstDoc.querySelector<HTMLElement>('[data-oddkin-preview]')?.style.inlineSize).toBe(
      '320px',
    );
    expect(firstDoc.querySelector('[data-oddkin-preview]')?.getAttribute('dir')).toBe('rtl');
    expect(firstDoc.documentElement.dataset['oddMode']).toBe('dark');
    expect(secondDoc.querySelector('[data-oddkin-preview]')?.getAttribute('dir')).toBeNull();
    expect(secondDoc.documentElement.dataset['oddMode']).toBe('light');
    expect(firstDoc.defaultView?.getComputedStyle(firstButton).marginInlineStart).toBe('10px');
    await first.request('settings', { container: { width: 240 }, mode: 'dark' });
    expect(firstDoc.defaultView?.getComputedStyle(firstButton).marginInlineStart).toBe('0px');

    await first.request('theme', { cssText: ':root { --frame-test: #123; }' });
    expect(firstDoc.adoptedStyleSheets[0]).toBeDefined();
    expect(firstDoc.adoptedStyleSheets[0]?.constructor).toBe(firstDoc.defaultView?.CSSStyleSheet);
    expect(secondDoc.adoptedStyleSheets).toHaveLength(0);

    const clicked = new Promise<FrameNotification>((resolve) => {
      const check = () => {
        const event = firstMessages.find((message) => message.kind === 'event');
        if (event) resolve(event);
        else setTimeout(check, 5);
      };
      check();
    });
    await userEvent.click(firstButton.shadowRoot!.querySelector('button')!);
    const event = await clicked;
    expect(event).toMatchObject({
      kind: 'event',
      payload: {
        id: 'event:fixture-button#fixture-action',
        name: 'fixture-action',
        detail: { label: 'Continue' },
      },
    });

    first.setViewport(480, 360);
    expect(first.iframe.width).toBe('480');
    expect(first.iframe.height).toBe('360');
    expect(scopeStats().scopes).toBeGreaterThan(before.scopes);
  });

  it('runs the example fixture from its module once the element is connected', async () => {
    const preview = createPreview();
    await preview.ready;
    const fixture = new URL('./fixtures/frame-examples.ts', import.meta.url).href;
    await preview.request('mount', payload({ example: 'example:fixture-button/staged', fixture }));
    const doc = preview.iframe.contentDocument!;
    expect(doc.querySelector('fixture-button')?.getAttribute('data-fixture')).toBe('connected');
    // What the fixture mounts goes beside the element: a node as is, a template through its renderer.
    const mounted = () =>
      [...doc.querySelectorAll('[data-oddkin-preview] > div')].map((host) => host.textContent);
    expect(mounted()).toEqual(['Mounted node', 'Mounted template']);
    // Another example replaces the element and everything its fixture added.
    await preview.request('mount', payload());
    expect(mounted()).toEqual([]);
    expect(doc.querySelector('fixture-button')?.hasAttribute('data-fixture')).toBe(false);
  });

  it('keeps the element when an example module cannot load or its fixture throws', async () => {
    const messages: FrameNotification[] = [];
    const preview = createPreview(messages);
    await preview.ready;
    const doc = preview.iframe.contentDocument!;
    const errors = () =>
      messages.filter((m) => m.kind === 'error').map((m) => m.payload as Record<string, unknown>);
    // A host that does not serve the module (the docs did not, 2026-10-29).
    const missing = new URL('./fixtures/missing-examples.js', import.meta.url).href;
    await preview.request(
      'mount',
      payload({ example: 'example:fixture-button/staged', fixture: missing }),
    );
    expect(doc.querySelector('fixture-button')?.shadowRoot?.textContent).toContain('Save');
    await until(() => errors().length === 1, 'the setup notice');
    expect(errors()[0]?.['phase']).toBe('fixture');
    expect(doc.querySelector('[role="alert"]')).toBeNull();

    const fixture = new URL('./fixtures/frame-examples.ts', import.meta.url).href;
    await preview.request('mount', payload({ example: 'example:fixture-button/broken', fixture }));
    expect(doc.querySelector('fixture-button')?.shadowRoot?.textContent).toContain('Save');
    await until(() => errors().length === 2, 'the second setup notice');
    expect(errors()[1]).toMatchObject({ phase: 'fixture', message: 'Setup failed' });
    // The frame still serves requests.
    await preview.request('set', { property: 'label', value: 'Continue' });
    expect(doc.querySelector('fixture-button')?.shadowRoot?.textContent).toContain('Continue');
  });

  it('sets CSS custom properties on the element, on mount and one at a time', async () => {
    const preview = createPreview();
    await preview.ready;
    await preview.request('mount', payload({ styles: { '--frame-accent': 'rgb(1, 2, 3)' } }));
    const view = preview.iframe.contentWindow!;
    const element = preview.iframe.contentDocument!.querySelector<HTMLElement>('fixture-button')!;
    expect(view.getComputedStyle(element).getPropertyValue('--frame-accent')).toBe('rgb(1, 2, 3)');

    await preview.request('set', { cssProperty: '--frame-gap', cssValue: '2px' });
    expect(element.style.getPropertyValue('--frame-gap')).toBe('2px');
    await preview.request('set', { cssProperty: '--frame-accent', cssValue: 'teal' });
    expect(element.style.getPropertyValue('--frame-accent')).toBe('teal');
    await preview.request('set', { cssProperty: '--frame-accent', cssValue: null });
    expect(element.style.getPropertyValue('--frame-accent')).toBe('');
    expect(element.style.getPropertyValue('--frame-gap')).toBe('2px');
    // Only custom properties: anything else is refused before it reaches the frame.
    await expect(
      preview.request('set', { cssProperty: 'color', cssValue: 'red' } as never),
    ).rejects.toThrow();
    expect(element.style.getPropertyValue('color')).toBe('');
  });

  it('rejects wrong sources and stale generations, isolates errors, and releases host scopes', async () => {
    const before = scopeStats();
    const protocolBefore = previewProtocolStats();
    const first = createPreview();
    const second = createPreview();
    await Promise.all([first.ready, second.ready]);
    const rejected = previewProtocolStats().rejectedMessages;
    window.postMessage(
      {
        protocol: 'oddkin.frame',
        version: 1,
        frame: first.identity.frame,
        generation: first.identity.generation,
        kind: 'hello',
      },
      location.origin,
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://invalid.example',
        source: first.iframe.contentWindow,
        data: {
          protocol: 'oddkin.frame',
          version: 1,
          frame: first.identity.frame,
          generation: first.identity.generation,
          kind: 'hello',
        },
      }),
    );
    const staleMessage = {
      protocol: 'oddkin.frame',
      version: 1,
      frame: first.identity.frame,
      generation: first.identity.generation + 1,
      kind: 'hello',
    };
    const script = first.iframe.contentDocument!.createElement('script');
    script.textContent = `parent.postMessage(${JSON.stringify(staleMessage)}, location.origin)`;
    first.iframe.contentDocument!.head.append(script);
    script.remove();
    await until(
      () =>
        previewProtocolStats().rejectedMessages > rejected &&
        previewProtocolStats().staleMessages > protocolBefore.staleMessages,
      'protocol rejections',
    );

    await expect(
      first.request(
        'mount',
        payload({ registration: new URL('./missing-registration.ts', import.meta.url).href }),
      ),
    ).rejects.toThrow();
    expect(first.iframe.contentDocument?.querySelector('[role="alert"]')).not.toBeNull();
    await first.request('mount', payload());
    await expect(
      first.request('mount', payload({ registration: alternateRegistration })),
    ).rejects.toMatchObject({ code: 'frame.registration.incompatible' });
    expect(first.identity.generation).toBe(1);
    await first.reload();
    expect(first.identity.generation).toBe(2);
    await first.request('mount', payload({ registration: alternateRegistration }));
    expect(
      first.iframe.contentDocument?.querySelector('fixture-button')?.shadowRoot?.textContent,
    ).toContain('Alternate');
    await second.request('mount', payload());
    expect(second.iframe.contentDocument?.querySelector('fixture-button')).not.toBeNull();
    expect(previewProtocolStats().liveFrames).toBe(protocolBefore.liveFrames + 2);

    for (const preview of previews.splice(0)) preview.dispose();
    await until(() => scopeStats().scopes === before.scopes, 'host Scope cleanup');
    expect(previewProtocolStats().liveFrames).toBe(protocolBefore.liveFrames);
  });

  it('lets a mount wait for a slow module graph, bounded by its own timeout', async () => {
    const slow = new URL('./fixtures/frame-element-slow.ts', import.meta.url).href;
    const create = (limits: { timeoutMs?: number; mountTimeoutMs?: number }) => {
      const preview = createIsolatedPreview({
        document,
        container: document.body,
        frameUrl,
        title: 'Slow preview',
        ...limits,
      });
      previews.push(preview);
      return preview;
    };
    // The 2.5 s import outlasts the 2 s request timeout, but not the mount timeout.
    const patient = create({ timeoutMs: 2_000 });
    await patient.ready;
    await patient.request('mount', payload({ registration: slow }));
    expect(patient.iframe.contentDocument?.querySelector('fixture-button')?.shadowRoot).not.toBe(
      null,
    );
    // Theme Studio's specimens import module graphs too.
    const specimens = create({ timeoutMs: 2_000 });
    await specimens.ready;
    await specimens.request('specimen', {
      items: [{ ...payload({ registration: slow }), role: 'primaryAction', label: 'Primary' }],
    });
    expect(specimens.iframe.contentDocument?.querySelector('fixture-button')?.shadowRoot).not.toBe(
      null,
    );
    // A fetch that never settles within the mount timeout is still reported.
    const bounded = create({ mountTimeoutMs: 500 });
    await bounded.ready;
    await expect(bounded.request('mount', payload({ registration: slow }))).rejects.toMatchObject({
      code: 'frame.request.timeout',
    });
  });

  it('sends requests one at a time: a change made during a slow mount reaches its element', async () => {
    const slow = new URL('./fixtures/frame-element-slow.ts', import.meta.url).href;
    // Each request's timeout counts from when it is sent: the set waits out the 2.5 s mount.
    const preview = createIsolatedPreview({
      document,
      container: document.body,
      frameUrl,
      title: 'Ordered preview',
      timeoutMs: 1_000,
    });
    previews.push(preview);
    await preview.ready;
    const results = await Promise.all([
      preview.request('mount', payload({ registration: slow })),
      preview.request('set', { property: 'label', value: 'Later' }),
      preview.request('set', { attribute: 'data-step', attributeValue: '2' }),
    ]);
    expect(results).toEqual([{ mounted: true }, { updated: true }, { updated: true }]);
    const button = preview.iframe.contentDocument?.querySelector('fixture-button') as
      (HTMLElement & { label?: string }) | null | undefined;
    expect([button?.label, button?.getAttribute('data-step')]).toEqual(['Later', '2']);
  });

  it('handles the requests of any host one at a time, in order', async () => {
    // A host that does not wait for replies (not createIsolatedPreview) sends a set right behind
    // a slow mount; the frame applies it to the mounted element instead of failing it.
    const slow = new URL('./fixtures/frame-element-slow.ts', import.meta.url).href;
    const identity = { frame: 'raw-host', generation: 1 };
    const url = new URL(frameUrl);
    url.searchParams.set('frame', identity.frame);
    url.searchParams.set('generation', '1');
    const iframe = document.createElement('iframe');
    const hello = new Promise<void>((resolve) => {
      const onMessage = (event: MessageEvent) => {
        if (event.source !== iframe.contentWindow || event.data?.kind !== 'hello') return;
        removeEventListener('message', onMessage);
        resolve();
      };
      addEventListener('message', onMessage);
    });
    iframe.src = url.href;
    document.body.append(iframe);
    const channel = new MessageChannel();
    try {
      await hello;
      const replies = new Map<number, { payload?: unknown; error?: unknown }>();
      channel.port1.onmessage = (event: MessageEvent) => {
        if (event.data?.kind === 'reply') replies.set(event.data.replyTo, event.data);
      };
      iframe.contentWindow!.postMessage(frameEnvelope(identity, 'connect'), location.origin, [
        channel.port2,
      ]);
      const send = (id: number, kind: 'mount' | 'set', body: unknown) =>
        channel.port1.postMessage({ ...frameEnvelope(identity, kind), id, payload: body });
      send(1, 'mount', payload({ registration: slow }));
      send(2, 'set', { property: 'label', value: 'Later' });
      for (let i = 0; i < 600 && !replies.has(2); i++)
        await new Promise((resolve) => setTimeout(resolve, 10));
      expect(replies.get(1)).toEqual(expect.objectContaining({ payload: { mounted: true } }));
      expect(replies.get(2)).toEqual(expect.objectContaining({ payload: { updated: true } }));
      const button = iframe.contentDocument?.querySelector('fixture-button') as
        (HTMLElement & { label?: string }) | null | undefined;
      expect(button?.label).toBe('Later');
    } finally {
      channel.port1.close();
      iframe.remove();
    }
  });

  it('refuses superseded generations, disposed frames, and incompatible protocol versions', async () => {
    const preview = createPreview();
    await preview.ready;
    await preview.request('mount', payload());

    // A request made for generation 1 just before generation 2 replaces it is refused, never sent
    // to the new frame.
    const superseded = preview.request('reset');
    const reloading = preview.reload();
    await expect(superseded).rejects.toMatchObject({ code: 'frame.generation.superseded' });
    await reloading;
    expect(preview.identity.generation).toBe(2);
    await preview.request('mount', payload());

    // Pending and later requests on a disposed frame fail, and the frame is gone.
    const pending = preview.request('mount', payload({ properties: { label: 'Late' } }));
    const stats = previewProtocolStats();
    preview.dispose();
    await expect(pending).rejects.toMatchObject({ code: 'frame.disposed' });
    await expect(preview.request('reset')).rejects.toMatchObject({ code: 'frame.disposed' });
    await expect(preview.reload()).rejects.toMatchObject({ code: 'frame.disposed' });
    expect(preview.iframe.isConnected).toBe(false);
    expect(previewProtocolStats().liveFrames).toBe(stats.liveFrames - 1);

    // A frame runtime that speaks another protocol version never connects.
    const incompatible = createIsolatedPreview({
      document,
      container: document.body,
      frameUrl: new URL('./fixtures/frame-v2.html', import.meta.url).href,
      title: 'Incompatible preview',
    });
    previews.push(incompatible);
    await expect(incompatible.ready).rejects.toMatchObject({
      code: 'frame.version.incompatible',
    });
    expect(incompatible.iframe.isConnected).toBe(false);
  });
});
