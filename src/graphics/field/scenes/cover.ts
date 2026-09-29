export type CoverPoint = { x: number; y: number };

export type CoverRect = { x: number; y: number; width: number; height: number };

/** Diagonal half centroids, or the box center for a full spread. */
export function halfTarget(half: number | null | undefined): CoverPoint {
  if (half === 0) return { x: 1 / 3, y: 1 / 3 };

  if (half === 1) return { x: 2 / 3, y: 2 / 3 };

  return { x: 0.5, y: 0.5 };
}

/**
 * Cover `boxW`×`boxH` with an image of `nw`×`nh` (object-fit: cover, no zoom),
 * placing the image center at `target`.
 */
export function coverPlacement(
  nw: number,
  nh: number,
  boxW: number,
  boxH: number,
  target: CoverPoint = { x: 0.5, y: 0.5 },
): CoverRect {
  const naturalW = Math.max(nw, 1);
  const naturalH = Math.max(nh, 1);
  const scale = Math.max(boxW / naturalW, boxH / naturalH);
  const width = naturalW * scale;
  const height = naturalH * scale;
  const x = Math.min(0, Math.max(boxW - width, target.x * boxW - width / 2));
  const y = Math.min(0, Math.max(boxH - height, target.y * boxH - height / 2));

  return { x, y, width, height };
}

function readHalf(photo: HTMLImageElement): number | null {
  const halfAttr = photo.dataset.half;

  if (halfAttr === undefined || halfAttr === "") return null;

  const half = Number.parseInt(halfAttr, 10);

  return Number.isFinite(half) ? half : null;
}

/** Applies the same cover rect the canvas uses, reading only `data-half`. */
export function frameSpreadPhoto(photo: HTMLImageElement, boxW: number, boxH: number): void {
  const nw = photo.naturalWidth;
  const nh = photo.naturalHeight;

  if (nw < 1 || nh < 1 || boxW < 1 || boxH < 1) return;

  const rect = coverPlacement(nw, nh, boxW, boxH, halfTarget(readHalf(photo)));

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
