/** Private docs host boundary, not a component or public Workbench protocol extension. */
export type BehaviorPurpose = 'flow' | 'bounded';
export interface BehaviorMetrics {
  readonly width: number;
  readonly capacity: number;
  readonly height: number;
  readonly shift: number;
  readonly purpose: BehaviorPurpose;
}
export interface BehaviorCanvas {
  configurePurpose(purpose: BehaviorPurpose): Promise<BehaviorMetrics>;
  settle(reset?: boolean): Promise<BehaviorMetrics>;
  subscribe(listener: (metrics: BehaviorMetrics) => void): () => void;
}
declare global {
  interface Window {
    oddkinBehaviorCanvas?: BehaviorCanvas;
  }
}
