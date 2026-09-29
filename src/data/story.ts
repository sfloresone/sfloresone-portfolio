import { getImage } from "astro:assets";
import type { ImageMetadata } from "astro";
import madrid from "../assets/about/madrid.jpeg";
import plane from "../assets/about/plane.jpeg";

export type StoryPhoto = {
  alt: string;
  /** Optimized source shared by the gallery `<img>` and the field's halftone. */
  src: string;
  srcset: string;
  /** Full-resolution source for the lightbox. */
  full: string;
};

export type StorySpreadLayout = "full" | "diagonal";

/** Photos shown together over the field while one block of the story is read. */
export type StorySpread =
  | { id: string; layout: "full"; photos: [StoryPhoto] }
  | { id: string; layout: "diagonal"; photos: [StoryPhoto, StoryPhoto] };

export type StorySpreadId = "madrid" | "skyline";

async function optimize(alt: string, image: ImageMetadata): Promise<StoryPhoto> {
  const largeWidth = Math.min(2048, image.width);

  const [small, large] = await Promise.all([
    getImage({ src: image, width: 1024, format: "webp" }),
    getImage({ src: image, width: largeWidth, format: "webp" }),
  ]);

  return {
    alt,
    src: small.src,
    srcset: `${small.src} 1024w, ${large.src} ${largeWidth}w`,
    full: large.src,
  };
}

export async function loadStorySpreads(): Promise<Record<StorySpreadId, StorySpread>> {
  const [madridPhoto, planePhoto] = await Promise.all([
    optimize("Madrid's skyline at dusk, seen from the north", madrid),
    optimize("A plane crossing a clear blue sky", plane),
  ]);

  return {
    madrid: { id: "madrid", layout: "full", photos: [madridPhoto] },
    skyline: { id: "skyline", layout: "diagonal", photos: [madridPhoto, planePhoto] },
  };
}
