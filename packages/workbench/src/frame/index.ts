/** Runtime entry loaded only by a Workbench preview document. */
import { createScope, scopeStats, type Scope } from '@oddkin/core/scope';
import {
  frameEnvelope,
  isCompatibleFrameMessage,
  isFrameMountPayload,
  isFrameRequest,
  isJsonValue,
  type FrameIdentity,
  type FrameMountPayload,
  type FrameRequest,
  type FrameSettings,
  type JsonValue,
} from '../protocol/index.js';

interface Runtime {
  readonly identity: FrameIdentity;
  readonly window: Window;
  readonly document: Document;
  scope: Scope | undefined;
  mountScope: Scope | undefined;
  port: MessagePort | undefined;
  lastRequest: number;
  mount: FrameMountPayload | undefined;
  element: HTMLElement | undefined;
  theme: CSSStyleSheet | undefined;
  wrapper: HTMLElement;
  registrations: Map<string, string>;
  rejectedRequests: number;
  staleRequests: number;
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
const errorCode = (error: unknown, kind: FrameRequest['kind']) =>
  error instanceof RegistrationIncompatibleError ? error.code : `frame.${kind}.failed`;

class RegistrationIncompatibleError extends Error {
  readonly code = 'frame.registration.incompatible';
}

function readIdentity(win: Window): FrameIdentity {
  const params = new URLSearchParams(win.location.search);
  const frame = params.get('frame');
  const generation = Number(params.get('generation'));
  if (!frame || !Number.isSafeInteger(generation) || generation < 1)
    throw new Error('Preview frame URL must include a frame id and positive generation.');
  return { frame, generation };
}

function post(runtime: Runtime, kind: 'event' | 'error' | 'state' | 'size', payload: JsonValue) {
  const port = runtime.port;
  if (!port) return;
  port.postMessage({ ...frameEnvelope(runtime.identity, kind), payload });
}

function fail(runtime: Runtime, phase: string, error: unknown) {
  const message = errorMessage(error);
  clearElement(runtime);
  runtime.mount = undefined;
  runtime.wrapper.replaceChildren();
  const alert = runtime.document.createElement('p');
  alert.setAttribute('role', 'alert');
  alert.textContent = `Preview ${phase} failed: ${message}`;
  runtime.wrapper.append(alert);
  post(runtime, 'error', { phase, message });
}

function applySettings(runtime: Runtime, settings: FrameSettings | undefined) {
  const root = runtime.document.documentElement;
  const container = runtime.wrapper;
  if (settings?.container) {
    container.style.inlineSize = `${settings.container.width}px`;
    container.style.blockSize =
      settings.container.height === undefined ? 'auto' : `${settings.container.height}px`;
  } else {
    container.style.inlineSize = '';
    container.style.blockSize = '';
  }
  if (settings?.direction) container.dir = settings.direction;
  else container.removeAttribute('dir');
  const attributes = ['oddMode', 'oddDensity', 'oddProduct', 'oddProfile'] as const;
  const values = [settings?.mode, settings?.density, settings?.product, settings?.profile];
  attributes.forEach((key, index) => {
    const value = values[index];
    if (value === undefined) delete container.dataset[key];
    else container.dataset[key] = value;
  });
  if (settings?.mode) root.dataset['oddMode'] = settings.mode;
  else delete root.dataset['oddMode'];
}

function clearElement(runtime: Runtime) {
  runtime.mountScope?.dispose();
  runtime.mountScope = undefined;
  runtime.element?.remove();
  runtime.element = undefined;
}

function loadRegistration(runtime: Runtime, registration: string): Promise<void> {
  if (runtime.registrations.has(registration)) return Promise.resolve();
  const scope = runtime.scope;
  if (!scope || scope.disposed) return Promise.reject(new Error('The preview frame was disposed.'));
  const script = runtime.document.createElement('script');
  script.type = 'module';
  script.textContent = `try {
    await import(${JSON.stringify(registration)});
    document.dispatchEvent(new CustomEvent('oddkin:registration', {
      detail: { registration: ${JSON.stringify(registration)}, ok: true }
    }));
  } catch (error) {
    document.dispatchEvent(new CustomEvent('oddkin:registration', {
      detail: { registration: ${JSON.stringify(registration)}, ok: false, message: String(error) }
    }));
  }`;
  const releaseScript = scope.add(() => script.remove(), 'registration module');
  return new Promise<void>((resolve, reject) => {
    let complete = false;
    let releaseLoad = () => {};
    let releaseError = () => {};
    const finish = (error?: Error) => {
      if (complete) return;
      complete = true;
      releaseLoad();
      releaseError();
      releaseAbort();
      releaseScript();
      if (error) reject(error);
      else resolve();
    };
    releaseLoad = scope.listen(
      runtime.document,
      'oddkin:registration',
      (event: CustomEvent<{ registration: string; ok: boolean; message?: string }>) => {
        if (event.detail.registration !== registration) return;
        finish(
          event.detail.ok
            ? undefined
            : new Error(event.detail.message ?? `Could not load registration "${registration}".`),
        );
      },
    );
    releaseError = scope.listen(script, 'error', () =>
      finish(new Error(`Could not execute registration "${registration}".`)),
    );
    const releaseAbort = scope.add(() => {
      if (!complete) finish(new Error('The preview frame was disposed.'));
    });
    runtime.document.head.append(script);
  });
}

async function mount(runtime: Runtime, config: FrameMountPayload): Promise<void> {
  const existing = runtime.registrations.get(config.tag);
  if (existing && existing !== config.registration)
    throw new RegistrationIncompatibleError(
      `The <${config.tag}> registration changed; replace this frame before mounting it again.`,
    );
  clearElement(runtime);
  runtime.wrapper.replaceChildren();
  applySettings(runtime, config.settings);
  await loadRegistration(runtime, config.registration);
  const constructor = runtime.window.customElements.get(config.tag);
  if (!constructor) throw new Error(`Registration did not define <${config.tag}>.`);
  runtime.registrations.set(config.tag, config.registration);
  const element = runtime.document.createElement(config.tag);
  runtime.element = element;
  for (const [name, value] of Object.entries(config.properties ?? {}))
    Reflect.set(element, name, value);
  for (const [name, value] of Object.entries(config.attributes ?? {})) {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }
  for (const [name, text] of Object.entries(config.slots ?? {})) {
    const slot = runtime.document.createElement('span');
    if (name) slot.slot = name;
    slot.textContent = text;
    element.append(slot);
  }
  runtime.wrapper.append(element);
  runtime.mount = config;
  runtime.mountScope = runtime.scope?.child({ name: `preview-example:${config.example}` });
}

function replaceTheme(runtime: Runtime, cssText: string) {
  if (runtime.theme) {
    runtime.theme.replaceSync(cssText);
    return;
  }
  const Sheet = (runtime.window as Window & typeof globalThis).CSSStyleSheet;
  if (!Sheet || !('adoptedStyleSheets' in runtime.document))
    throw new Error('Constructable stylesheets are unavailable in the preview frame.');
  const sheet = new Sheet();
  sheet.replaceSync(cssText);
  runtime.document.adoptedStyleSheets = [...runtime.document.adoptedStyleSheets, sheet];
  runtime.theme = sheet;
}

function listenToElement(runtime: Runtime, scope: Scope) {
  const element = runtime.element;
  if (!element) return;
  for (const name of runtime.mount?.events ?? [])
    scope.listen(
      runtime.wrapper,
      name,
      (event) => {
        const payload: Record<string, JsonValue> = {
          id: `event:${runtime.mount?.tag ?? element.localName}#${name}`,
          name,
          time: runtime.window.performance.now(),
          bubbles: event.bubbles,
          composed: event.composed,
          cancelable: event.cancelable,
          target: element.localName,
        };
        const detail = (event as CustomEvent).detail;
        if (detail !== undefined && isJsonValue(detail)) payload['detail'] = detail;
        post(runtime, 'event', payload);
      },
      true,
    );
}

async function handle(runtime: Runtime, scope: Scope, request: FrameRequest) {
  try {
    switch (request.kind) {
      case 'mount':
        if (!isFrameMountPayload(request.payload))
          throw new TypeError('mount requires a valid example payload.');
        await mount(runtime, request.payload);
        if (runtime.mountScope) listenToElement(runtime, runtime.mountScope);
        post(runtime, 'state', { scopeStats: scopeStats() });
        return { mounted: true };
      case 'set': {
        if (!runtime.element) throw new Error('There is no mounted component to update.');
        if (request.payload.property !== undefined) {
          if (request.payload.unset === true)
            Reflect.deleteProperty(runtime.element, request.payload.property);
          else if (Object.hasOwn(request.payload, 'value'))
            Reflect.set(runtime.element, request.payload.property, request.payload.value);
          else throw new TypeError('A property update needs a value or unset: true.');
        } else {
          const value = request.payload.attributeValue;
          if (request.payload.attribute === undefined)
            throw new TypeError('A set request needs a property or attribute name.');
          if (value === null) runtime.element.removeAttribute(request.payload.attribute);
          else if (typeof value === 'string')
            runtime.element.setAttribute(request.payload.attribute, value);
          else throw new TypeError('An attribute update needs a string or null value.');
        }
        return { updated: true };
      }
      case 'slot': {
        if (!runtime.element) throw new Error('There is no mounted component to update.');
        for (const child of [...runtime.element.children])
          if ((child.getAttribute('slot') ?? '') === request.payload.name) child.remove();
        const slot = runtime.document.createElement('span');
        if (request.payload.name) slot.slot = request.payload.name;
        slot.textContent = request.payload.text;
        runtime.element.append(slot);
        return { updated: true };
      }
      case 'reset':
        if (!runtime.mount) throw new Error('There is no mounted example to reset.');
        await mount(runtime, runtime.mount);
        if (runtime.mountScope) listenToElement(runtime, runtime.mountScope);
        post(runtime, 'state', { scopeStats: scopeStats() });
        return { reset: true };
      case 'theme': {
        replaceTheme(runtime, request.payload.cssText);
        return { updated: true };
      }
      case 'settings': {
        applySettings(runtime, request.payload);
        return { updated: true };
      }
      case 'inspect':
        throw new Error(
          'inspectPreview types are available; frame inspection is not implemented yet.',
        );
      case 'dispose':
        return { disposed: true };
    }
  } catch (error) {
    fail(runtime, request.kind, error);
    throw error;
  }
}

/** Install the runtime on a frame's own Window. Exported for controlled browser tests. */
export function installFrameRuntime(win: Window = window): void {
  const doc = win.document;
  const identity = readIdentity(win);
  const wrapper = doc.querySelector<HTMLElement>('[data-oddkin-preview]');
  if (!wrapper) throw new Error('Preview frame document is missing its preview container.');
  const runtime: Runtime = {
    identity,
    window: win,
    document: doc,
    scope: undefined,
    mountScope: undefined,
    port: undefined,
    lastRequest: 0,
    mount: undefined,
    element: undefined,
    theme: undefined,
    wrapper,
    registrations: new Map(),
    rejectedRequests: 0,
    staleRequests: 0,
  };
  const hello = frameEnvelope(identity, 'hello');
  win.parent.postMessage(hello, win.location.origin);

  win.addEventListener('message', (event: MessageEvent) => {
    if (
      event.source !== win.parent ||
      event.origin !== win.location.origin ||
      event.ports.length !== 1
    )
      return;
    const message: unknown = event.data;
    if (
      !isCompatibleFrameMessage(message) ||
      message.kind !== 'connect' ||
      message.frame !== identity.frame ||
      message.generation !== identity.generation ||
      runtime.scope
    )
      return;
    const port = event.ports[0];
    if (!port) return;
    runtime.port = port;
    const scope = createScope({ name: `preview-frame:${identity.frame}:${identity.generation}` });
    runtime.scope = scope;
    scope.add(() => port.close(), 'message port');
    scope.listen(port, 'message', (portEvent: MessageEvent) => {
      const request: unknown = portEvent.data;
      if (!isFrameRequest(request)) {
        runtime.rejectedRequests++;
        post(runtime, 'state', { rejectedRequests: runtime.rejectedRequests });
        return;
      }
      if (
        request.frame !== identity.frame ||
        request.generation !== identity.generation ||
        request.id <= runtime.lastRequest
      ) {
        runtime.staleRequests++;
        post(runtime, 'state', { staleRequests: runtime.staleRequests });
        return;
      }
      runtime.lastRequest = request.id;
      void handle(runtime, scope, request).then(
        (payload) => {
          if (scope.disposed) return;
          const reply = {
            ...frameEnvelope(identity, 'reply'),
            replyTo: request.id,
            ...(payload && isJsonValue(payload) ? { payload } : {}),
          };
          port.postMessage(reply);
          if (request.kind === 'dispose') scope.dispose();
        },
        (error: unknown) => {
          if (scope.disposed) return;
          port.postMessage({
            ...frameEnvelope(identity, 'reply'),
            replyTo: request.id,
            error: { code: errorCode(error, request.kind), message: errorMessage(error) },
          });
        },
      );
    });
    port.start();
    scope.listen(win, 'error', (event: ErrorEvent) =>
      fail(runtime, 'runtime', event.error ?? event.message),
    );
    scope.listen(win, 'unhandledrejection', (event: PromiseRejectionEvent) =>
      fail(runtime, 'runtime', event.reason),
    );
    const observer = new (win as Window & typeof globalThis).ResizeObserver((entries) => {
      const size = entries[0]?.contentRect;
      if (size) post(runtime, 'size', { width: size.width, height: size.height });
    });
    observer.observe(wrapper);
    scope.add(() => observer.disconnect(), 'resize observer');
    post(runtime, 'state', { connected: true, scopeStats: scopeStats() });
  });
}

if (typeof window !== 'undefined' && window.parent !== window) installFrameRuntime(window);
