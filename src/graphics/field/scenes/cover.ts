export type CoverPoint = { x: number; y: number };

export type CoverRect = { x: number; y: number; width: number; height: number };

/** Diagonal half centroids, or the box center for a full spread. */
export function halfTarget(half: number | null | undefined): CoverPoint {
  if (half === 0) return { x: 1 / 3, y: 1 / 3 };

  if (half === 1) return { x: 2 / 3, y: 2 / 3 };

  return { x: 0.5, y: 0.5 };
}

/** Smallest length that lets the `focus` fraction of an image sit at the `target` fraction of `box` while covering it. */
function reachLength(box: number, target: number, focus: number): number {
  const before = focus > 0 ? (target * box) / focus : 0;
  const after = focus < 1 ? ((1 - target) * box) / (1 - focus) : 0;

  return Math.max(before, after);
}

/**
 * Cover `boxW`×`boxH` with an image of `nw`×`nh`, placing its `focus` point at `target`.
 * Zooms past object-fit: cover only as far as that placement needs.
 */
export function coverPlacement(
  nw: number,
  nh: number,
  boxW: number,
  boxH: number,
  target: CoverPoint = { x: 0.5, y: 0.5 },
  focus: CoverPoint = { x: 0.5, y: 0.5 },
): CoverRect {
  const naturalW = Math.max(nw, 1);
  const naturalH = Math.max(nh, 1);

  const scale = Math.max(
    boxW / naturalW,
    boxH / naturalH,
    reachLength(boxW, target.x, focus.x) / naturalW,
    reachLength(boxH, target.y, focus.y) / naturalH,
  );

  const width = naturalW * scale;
  const height = naturalH * scale;
  const x = Math.min(0, Math.max(boxW - width, target.x * boxW - focus.x * width));
  const y = Math.min(0, Math.max(boxH - height, target.y * boxH - focus.y * height));

  return { x, y, width, height };
}

function readHalf(photo: HTMLImageElement): number | null {
  const halfAttr = photo.dataset.half;

  if (halfAttr === undefined || halfAttr === "") return null;

  const half = Number.parseInt(halfAttr, 10);

  return Number.isFinite(half) ? half : null;
}

/** The photo's subject from `data-focus-x` / `data-focus-y`, or its center. */
export function readFocus(photo: HTMLImageElement): CoverPoint {
  const x = Number.parseFloat(photo.dataset.focusX ?? "");
  const y = Number.parseFloat(photo.dataset.focusY ?? "");

  return { x: Number.isFinite(x) ? x : 0.5, y: Number.isFinite(y) ? y : 0.5 };
}

/** Applies the same cover rect the canvas uses, reading `data-half` and `data-focus-*`. */
export function frameSpreadPhoto(photo: HTMLImageElement, boxW: number, boxH: number): void {
  const nw = photo.naturalWidth;
  const nh = photo.naturalHeight;

  if (nw < 1 || nh < 1 || boxW < 1 || boxH < 1) return;

  const rect = coverPlacement(nw, nh, boxW, boxH, halfTarget(readHalf(photo)), readFocus(photo));

  photo.classList.remove("inset-0", "size-full", "object-cover");
  photo.style.position = "absolute";
  photo.style.left = `${rect.x}px`;
  photo.style.top = `${rect.y}px`;
  photo.style.width = `${rect.width}px`;
  photo.style.height = `${rect.height}px`;
  photo.style.maxWidth = "none";
  photo.style.objectFit = "fill";
}

/** Frames every `[data-spread-photo]` inside a spread figure. */
export function frameSpread(spread: HTMLElement): void {
  const boxW = spread.clientWidth;
  const boxH = spread.clientHeight;

  for (const photo of spread.querySelectorAll<HTMLImageElement>("[data-spread-photo]")) {
    frameSpreadPhoto(photo, boxW, boxH);
  }
}
