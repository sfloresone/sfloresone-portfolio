import type { Placement, SceneField, SceneLayout } from "../types";
import { rasterScene, type SceneMode } from "./raster";

export interface TextOptions {
  font?: string;
  weight?: number;
  placement?: Placement;
}

export async function textScene(text: string, layout: SceneLayout, options: TextOptions = {}): Promise<SceneField> {
  await document.fonts.ready;

  const family = options.font ?? getComputedStyle(document.body).fontFamily;
  const weight = options.weight ?? 600;
  const probe = new OffscreenCanvas(1, 1).getContext("2d");
  const probeSize = 100;

  if (probe) probe.font = `${weight} ${probeSize}px ${family}`;

  const measured = probe?.measureText(text);
  const textWidth = measured ? measured.width : probeSize * text.length * 0.6;
  const aspect = (textWidth * 1.08) / (probeSize * 1.05);

  return rasterScene(
    (context, width, height) => {
      context.font = `${weight} ${height * 0.86}px ${family}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = "#fff";
      context.fillText(text, width / 2, height * 0.54, width);
    },
    layout,
    { aspect, placement: options.placement },
  );
}

export interface ImageOptions {
  mode?: SceneMode;
  placement?: Placement;
  softness?: number;
}

const images = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  let pending = images.get(src);

  if (!pending) {
    const image = new Image();

    image.decoding = "async";
    image.src = src;
    pending = image.decode().then(() => image);
    pending.catch(() => images.delete(src));
    images.set(src, pending);
  }

  return pending;
}

/** Any raster or SVG image; photos read best in `luminance` mode. */
export async function imageScene(src: string, layout: SceneLayout, options: ImageOptions = {}): Promise<SceneField> {
  const image = await loadImage(src);
  const aspect = image.naturalWidth / Math.max(image.naturalHeight, 1);

  return rasterScene((context, width, height) => context.drawImage(image, 0, 0, width, height), layout, {
    aspect,
    mode: options.mode,
    placement: options.placement,
    softness: options.softness,
  });
}

/** A vertical rail with one node and one bar per stop, newest first. */
export function timelineScene(stops: number, layout: SceneLayout, aspect = 0.8): SceneField {
  const count = Math.max(1, stops);

  return rasterScene(
    (context, width, height) => {
      const railX = width * 0.16;
      const top = height * 0.06;
      const bottom = height * 0.94;
      const gap = (bottom - top) / count;
      const stroke = Math.max(10, width * 0.035);

      context.fillStyle = "#fff";
      context.fillRect(railX - stroke / 2, top, stroke, bottom - top);

      for (let i = 0; i < count; i++) {
        const y = top + gap * (i + 0.5);
        const radius = width * (i === 0 ? 0.075 : 0.06);
        const barLength = width * (0.62 - (i % 3) * 0.12);

        context.beginPath();
        context.arc(railX, y, radius, 0, Math.PI * 2);
        context.fill();
        context.fillRect(railX + radius * 1.8, y - stroke * 1.1, barLength, stroke * 2.2);
        context.fillRect(railX + radius * 1.8, y + stroke * 2.4, barLength * 0.55, stroke * 1.2);
      }
    },
    layout,
    { aspect },
  );
}
