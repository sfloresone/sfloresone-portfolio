import { sceneTexels, type Placement, type SceneField, type SceneLayout } from "../types";

/** `silhouette` follows the drawing's alpha; `luminance` also carries its brightness into the relief. */
export type SceneMode = "silhouette" | "luminance";

/** Draws inside a `width` x `height` box in CSS pixels, origin at its top-left corner. */
export type Paint = (context: OffscreenCanvasRenderingContext2D, width: number, height: number) => void;

export interface RasterOptions {
  /** Width divided by height of the drawing box. */
  aspect: number;
  mode?: SceneMode;
  /** Where the drawing sits; defaults to the open field right of the pane column. */
  placement?: Placement;
  /** Blur radius of the relief, in scene texels. */
  softness?: number;
}

/** Largest rectangle with `aspect` that fits inside `box`, centered. */
function fit(box: Placement, aspect: number): Placement {
  const safeAspect = Math.max(aspect, 0.01);
  const width = Math.min(box.width, box.height * safeAspect);
  const height = width / safeAspect;

  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}

function defaultPlacement(layout: SceneLayout): Placement {
  const left = Math.min(layout.band, layout.width * 0.6);
  const free = layout.width - left;
  const padX = free * 0.14;
  const padY = layout.height * 0.16;

  return { x: left + padX, y: padY, width: free - padX * 2, height: layout.height - padY * 2 };
}

/** Separable box blur run three times, close enough to a gaussian at this size. */
function blur(source: Float32Array, radius: number): Float32Array {
  const size = sceneTexels;
  let from = source.slice();
  let to = new Float32Array(from.length);
  const r = Math.max(1, Math.round(radius));
  const span = r * 2 + 1;

  for (let pass = 0; pass < 3; pass++) {
    for (const horizontal of [true, false]) {
      for (let line = 0; line < size; line++) {
        let sum = 0;

        for (let k = -r; k <= r; k++) {
          const i = Math.min(size - 1, Math.max(0, k));

          sum += horizontal ? from[line * size + i] : from[i * size + line];
        }

        for (let i = 0; i < size; i++) {
          const index = horizontal ? line * size + i : i * size + line;

          to[index] = sum / span;

          const enter = Math.min(size - 1, i + r + 1);
          const leave = Math.max(0, i - r);

          sum += horizontal ? from[line * size + enter] - from[line * size + leave] : from[enter * size + line] - from[leave * size + line];
        }
      }

      [from, to] = [to, from];
    }
  }

  return from;
}

/** Paints a drawing over the canvas area and packs relief, ink, luminance and coverage. */
export function rasterScene(paint: Paint, layout: SceneLayout, options: RasterOptions): SceneField {
  const size = sceneTexels;
  const texels = size * size;
  const data = new Uint8Array(texels * 4);
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) return { data };

  const rect = fit(options.placement ?? defaultPlacement(layout), options.aspect);
  const sx = size / Math.max(layout.width, 1);
  const sy = size / Math.max(layout.height, 1);

  context.setTransform(sx, 0, 0, sy, rect.x * sx, rect.y * sy);
  paint(context, rect.width, rect.height);

  const pixels = context.getImageData(0, 0, size, size).data;
  const alpha = new Float32Array(texels);
  const brightness = new Float32Array(texels);
  const luminance = options.mode === "luminance";

  for (let i = 0; i < texels; i++) {
    const o = i * 4;
    const a = pixels[o + 3] / 255;
    const luma = (pixels[o] * 0.2126 + pixels[o + 1] * 0.7152 + pixels[o + 2] * 0.0722) / 255;

    alpha[i] = a;
    brightness[i] = luminance ? luma * a : a;
  }

  const softness = options.softness ?? 3;
  const relief = blur(brightness, softness);
  const coverage = blur(alpha, softness * 2);

  for (let i = 0; i < texels; i++) {
    const o = i * 4;

    data[o] = Math.round(relief[i] * 255);
    data[o + 1] = Math.round(alpha[i] * 255);
    data[o + 2] = Math.round(brightness[i] * 255);
    data[o + 3] = Math.round(Math.min(1, coverage[i] * 1.4) * 255);
  }

  return { data };
}
