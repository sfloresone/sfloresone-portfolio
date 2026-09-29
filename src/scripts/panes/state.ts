import type { SectionId } from "../../data/site";

/** Rows the reveal can describe; the pane column never gets taller than this many cells. */
export const maxRevealRows = 128;

export interface PaneState {
  active: SectionId | null;
  /** In-place lost (404) mode. */
  lost: boolean;
  /** Some pane layer is on screen, even partly. */
  hasLayers: boolean;
  /** Id of the story spread whose text is being read, if any. */
  spread: string | null;
  /**
   * Per pane row, 4 floats: open cells, row shows a layer (1) or the veil (0), crest of the
   * horizontal front, crest of a switch band. The DOM clip and the field both read these.
   */
  rows: Float32Array<ArrayBuffer>;
}

type SectionListener = (id: SectionId | null) => void;

type LostListener = (lost: boolean) => void;

type SpreadListener = (src: string | null) => void;

/** Reveal timing and texture, in grid cells and seconds. */
export const revealTuning = {
  openSeconds: 1.1,
  closeSeconds: 0.95,
  switchSeconds: 1.25,
  bandRows: 3,
  flowCols: 2.2,
  crestTailSeconds: 1.5,
} as const;

export const paneState: PaneState = {
  active: null,
  lost: false,
  hasLayers: false,
  spread: null,
  rows: new Float32Array(maxRevealRows * 4),
};

const sectionListeners = new Set<SectionListener>();

const intentListeners = new Set<SectionListener>();

const lostListeners = new Set<LostListener>();

const spreadListeners = new Set<SpreadListener>();

export function onSectionChange(listener: SectionListener): () => void {
  sectionListeners.add(listener);

  return () => sectionListeners.delete(listener);
}

export function onSectionIntent(listener: SectionListener): () => void {
  intentListeners.add(listener);

  return () => intentListeners.delete(listener);
}

export function onLostChange(listener: LostListener): () => void {
  lostListeners.add(listener);

  return () => lostListeners.delete(listener);
}

export function onSpreadChange(listener: SpreadListener): () => void {
  spreadListeners.add(listener);

  return () => spreadListeners.delete(listener);
}

export function announceSection(id: SectionId | null): void {
  paneState.active = id;

  for (const listener of sectionListeners) listener(id);
}

export function announceIntent(id: SectionId | null): void {
  for (const listener of intentListeners) listener(id);
}

export function announceLost(lost: boolean): void {
  if (paneState.lost === lost) return;

  paneState.lost = lost;

  for (const listener of lostListeners) listener(lost);
}

export function announceSpread(src: string | null): void {
  if (paneState.spread === src) return;

  paneState.spread = src;

  for (const listener of spreadListeners) listener(src);
}

/** `pathname` without trailing slashes, so each shell route has one key. */
export function routeKey(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

export function isSectionId(value: string | undefined): value is SectionId {
  return value === "about" || value === "work" || value === "blog";
}
