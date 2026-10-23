import { OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import type { ArtifactRecord, ArtifactRevision } from '../contracts/types.js';
import { announceEvent, artifactExportEvent, artifactRevisionEvent } from '../events.js';
import { format, strings } from '../internal/strings.js';
import { MarkdownView, type MarkdownOptions } from '../markdown/render.js';

export const ARTIFACT_STRINGS = {
  revision: 'Revision',
  revisionOption: 'Revision {number} of {count}',
  current: '(latest)',
  preview: 'Preview',
  source: 'Source',
  view: 'View',
  copy: 'Copy',
  download: 'Download',
  copied: 'Copied to clipboard.',
  copyFailed: 'Copying failed.',
  noPreview: 'No preview is available for this kind of artifact; showing the source.',
};

/**
 * Renders an artifact revision into `container`. Return a cleanup. Hosts register renderers per
 * artifact `kind`; content is untrusted, so executable previews belong in an isolated frame the
 * host controls.
 */
export type ArtifactRenderer = (
  revision: ArtifactRevision,
  artifact: ArtifactRecord,
  container: HTMLElement,
) => void | (() => void);

export interface ExportFormat {
  readonly format: string;
  readonly label: string;
}

/**
 * A generated artifact with a stable identity across revisions: revision history, preview and
 * source modes, application-provided renderers, and export actions. Copy and the default
 * download use the canonical revision content.
 *
 * @csspart header - Title, revision picker, view toggle, and actions.
 * @csspart preview - Preview container (renderer output).
 * @csspart source - Source view.
 * @a11y A labelled region. The view toggle uses `aria-pressed`; the revision picker is a native select.
 * @keyboard Tab through header controls; the source view is scrollable and focusable.
 * @useFor Documents, code, tables, and other outputs users keep, compare, and export.
 * @notFor Short inline answers; use the response.
 * @limitation `html` and other executable kinds never render without a host renderer; the built-in preview supports `markdown`, `code`, and `text`.
 * @category AI
 */
export class OddkinArtifact extends OddkinElement.with({
  artifact: prop.object<ArtifactRecord>({ description: 'The artifact record with all revisions.' }),
  revisionId: prop.string({
    default: '',
    attribute: 'revision-id',
    description: 'Revision to show; empty shows the current one.',
  }),
  view: prop.enum(['preview', 'source'], {
    default: 'preview',
    reflect: true,
    description: 'Preview or source view.',
  }),
  renderers: prop.object<Readonly<Record<string, ArtifactRenderer>>>({
    description: 'Host renderers by artifact kind.',
  }),
  exports: prop.array<ExportFormat>({
    description: 'Extra export formats offered through `odd-artifact-export`.',
  }),
  markdown: prop.object<MarkdownOptions>({
    description: 'Options for the built-in Markdown and code preview.',
  }),
  strings: prop.object<Partial<typeof ARTIFACT_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = {
    'odd-artifact-export': artifactExportEvent,
    'odd-artifact-revision-change': artifactRevisionEvent,
    'odd-announce': announceEvent,
  };
  declare readonly _events?: ElementEvents<typeof OddkinArtifact>;

  /** @internal Bumps whenever the preview is re-rendered. */
  readonly _previews = signal(0);

  /** @internal */
  get _strings(): typeof ARTIFACT_STRINGS {
    return strings(ARTIFACT_STRINGS, this.strings);
  }

  /** The revision on screen. */
  get revision(): ArtifactRevision | undefined {
    const a = this.artifact;
    if (!a) return undefined;
    return (
      a.revisions.find((r) => r.revisionId === (this.revisionId || a.currentRevisionId)) ??
      a.revisions[a.revisions.length - 1]
    );
  }

  /** @internal */
  get _previewable(): boolean {
    const kind = this.artifact?.kind;
    return (
      !!kind &&
      (!!this.renderers?.[kind] || kind === 'markdown' || kind === 'code' || kind === 'text')
    );
  }

  /** @internal */
  readonly _onRevision = (event: Event): void => {
    const revisionId = (event.target as HTMLSelectElement).value;
    const a = this.artifact;
    if (!a) return;
    this.revisionId = revisionId;
    this.emit(artifactRevisionEvent, { artifactId: a.artifactId, revisionId });
  };
  /** @internal */
  readonly _setMode = (event: Event): void => {
    this.view = (event.currentTarget as HTMLElement).dataset['view'] as 'preview' | 'source';
  };
  /** @internal */
  readonly _copy = async (): Promise<void> => {
    const t = this._strings;
    try {
      await navigator.clipboard.writeText(this.revision?.content ?? '');
      this.emit(announceEvent, {
        text: t.copied,
        priority: 'polite',
        key: `artifact-copy:${Date.now()}`,
      });
    } catch {
      this.emit(announceEvent, {
        text: t.copyFailed,
        priority: 'polite',
        key: `artifact-copy-failed:${Date.now()}`,
      });
    }
  };
  /** @internal */
  readonly _export = (event: Event): void => {
    const a = this.artifact;
    const revision = this.revision;
    if (!a || !revision) return;
    const format = (event.currentTarget as HTMLElement).dataset['format'] ?? 'source';
    if (
      !this.emit(artifactExportEvent, {
        artifactId: a.artifactId,
        revisionId: revision.revisionId,
        format,
      })
    )
      return;
    if (format !== 'source') return;
    const extension =
      a.kind === 'markdown' ? 'md' : a.kind === 'code' ? (a.language ?? 'txt') : 'txt';
    const url = URL.createObjectURL(
      new Blob([revision.content], { type: 'text/plain;charset=utf-8' }),
    );
    const link = this.ownerDocument.createElement('a');
    link.href = url;
    link.download = `${a.title.replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 80) || 'artifact'}.${extension.replace(/[^a-z0-9]/gi, '') || 'txt'}`;
    link.click();
    // The URL is owned here and released once the download has started.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  /** @internal */
  _revisionLabel(revision: ArtifactRevision, count: number): string {
    const t = this._strings;
    const current = revision.revisionId === this.artifact?.currentRevisionId ? ` ${t.current}` : '';
    return `${format(t.revisionOption, { number: revision.number, count })}${current}`;
  }

  protected override mounted(scope: Scope): void {
    let identity: string | undefined;
    scope.effect(
      (run) => {
        const a = this.artifact;
        const revision = this.revision;
        const mode = this.view;
        const options = this.markdown ?? {};
        const renderer = a ? this.renderers?.[a.kind] : undefined;
        // A different artifact resets the viewed revision (presentation state).
        if (a && identity !== undefined && identity !== a.artifactId && this.revisionId)
          this.revisionId = '';
        identity = a?.artifactId;
        const container = this.shadowRoot?.querySelector<HTMLElement>('[part="preview"]');
        if (!container) return;
        container.replaceChildren();
        if (!a || !revision || mode !== 'preview') return;
        if (renderer) {
          const cleanup = renderer(revision, a, container);
          if (typeof cleanup === 'function') run.add(cleanup, 'artifact renderer');
        } else if (a.kind === 'markdown' || a.kind === 'code') {
          const view = new MarkdownView(container, { ...options, headingOffset: 1 });
          const longest = Math.max(
            0,
            ...(revision.content.match(/`+/g) ?? []).map((run) => run.length),
          );
          const fence = '`'.repeat(Math.max(3, longest + 1));
          const source =
            a.kind === 'code'
              ? `${fence}${a.language ?? ''}\n${revision.content}\n${fence}`
              : revision.content;
          view.update(source, false);
          run.add(() => view.dispose(), 'artifact preview');
        } else if (a.kind === 'text') {
          const pre = this.ownerDocument.createElement('pre');
          pre.className = 'text';
          pre.textContent = revision.content;
          container.append(pre);
        }
        this._previews.value = this._previews.peek() + 1;
      },
      { phase: 'post', name: '<odd-artifact> preview' },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-artifact': OddkinArtifact;
  }
}
