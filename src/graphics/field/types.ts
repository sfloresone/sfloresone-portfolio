import type { SectionId } from "../../data/site";

/** Texels per side of every scene field. */
export const sceneTexels = 256;

/**
 * A scene the halftone can take the shape of, stretched over the whole canvas.
 * Channels: relief (blurred shape), ink (sharp shape), luminance, coverage.
 */
export interface SceneField {
  /** `sceneTexels * sceneTexels * 4` bytes, row-major, top row first. */
  data: Uint8Array;
}

/** Canvas geometry a scene is painted for, in CSS pixels. */
export interface SceneLayout {
  width: number;
  height: number;
  /** Right edge of the pane column inside the canvas. */
  band: number;
}

/** Rectangle in canvas CSS pixels. */
export interface Placement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Field {
  readonly tier: 0 | 1;
  setSection(id: SectionId | null): void;
  /**
   * Blends the halftone toward `scene`; `null` returns to the open swell.
   * With `fromCol`, the front starts at that column and runs right to left.
   */
  setScene(scene: SceneField | null, fromCol?: number): void;
  /** Keeps `scene` on the field over any section scene; `null` hands it back to the section. */
  setOverride(scene: SceneField | null): void;
  /** Resolves once any in-flight scene morph has settled. */
  whenSceneIdle(): Promise<void>;
  prewarm(id: SectionId): void;
  upgrade(module: SceneModule): void;
  dispose(): void;
}

/** Lazily loaded builders that turn a section into a scene field. */
export interface SceneModule {
  build(id: SectionId, layout: SceneLayout): Promise<SceneField>;
  /** Builds ahead of time so activating the section does no heavy work. */
  prewarm(id: SectionId, layout: SceneLayout): void;
}

export type Vec4 = [number, number, number, number];

export interface FieldUniformValues {
  canvas: Vec4;
  grid: Vec4;
  pointer: Vec4;
  base: Vec4;
  crest: Vec4;
  ripple0: Vec4;
  ripple1: Vec4;
  ripple2: Vec4;
  ripple3: Vec4;
  scene: Vec4;
  breath: Vec4;
}
