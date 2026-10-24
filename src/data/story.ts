import { getImage } from "astro:assets";
import type { ImageMetadata } from "astro";
import atWork from "../assets/about/at-work.jpeg";
import combatHelicopter from "../assets/about/combat-helicopter.jpeg";
import madrid from "../assets/about/madrid.jpeg";
import plane from "../assets/about/plane.jpeg";
import tree from "../assets/about/tree.jpeg";

export type StoryPhoto = {
  alt: string;
  /** Optimized source shared by the gallery `<img>` and the field's halftone. */
  src: string;
  srcset: string;
  /** Full-resolution source for the lightbox. */
  full: string;
  /** Point of the photo (fractions of its size) a spread frames around: its subject. */
  focus: { x: number; y: number };
};

export type StorySpreadLayout = "full" | "diagonal";

/** Photos shown together over the field while one block of the story is read. */
export type StorySpread =
  | { id: string; layout: "full"; photos: [StoryPhoto] }
  | { id: string; layout: "diagonal"; photos: [StoryPhoto, StoryPhoto] };

export type StorySpreadId = "skyline";

async function optimize(alt: string, image: ImageMetadata, focusX = 0.5, focusY = 0.5): Promise<StoryPhoto> {
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
    focus: { x: focusX, y: focusY },
  };
}

export async function loadStorySpreads(): Promise<Record<StorySpreadId, StorySpread>> {
  const [madridPhoto, planePhoto] = await Promise.all([
    // Focus: the Cuatro Torres and the plane, measured on the source images.
    optimize("A photo of Madrid's skyline, my home town ❤️", madrid, 0.505, 0.5),
    optimize("I also like planes. It's amazing what humanity can achieve, right?", plane, 0.513, 0.522),
  ]);

  return {
    skyline: { id: "skyline", layout: "diagonal", photos: [madridPhoto, planePhoto] },
  };
}

/** A framed print at the end of the story; `image` stays empty until the photo is added. */
export type PolaroidEntry = {
  caption: string;
  date: string;
  image?: { src: ImageMetadata; alt: string };
};

export type Polaroid = {
  caption: string;
  date: string;
  photo: StoryPhoto | null;
};

/** Three prints: enough for a fanned stack, few enough to stay readable on mobile. */
const polaroidEntries: PolaroidEntry[] = [
  {
    caption: "At work",
    date: "Sep 2026",
    image: { src: atWork, alt: "Waiting for a meeting at work" },
  },
  {
    caption: "Above Madrid",
    date: "Oct 2026",
    image: { src: combatHelicopter, alt: "Combat helicopters flying over Madrid" },
  },
  {
    caption: "Beautiful nature",
    date: "Apr 2026",
    image: { src: tree, alt: "Photos under a tree" },
  },
];

export async function loadPolaroids(): Promise<Polaroid[]> {
  return Promise.all(
    polaroidEntries.map(async (entry) => ({
      caption: entry.caption,
      date: entry.date,
      photo: entry.image ? await optimize(entry.image.alt, entry.image.src) : null,
    })),
  );
}
