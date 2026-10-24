import type { SectionId } from "../../data/site";
import { fieldDrawings } from "../../data/drawings";

/** Brands whose field drawing keeps its own color. */
export type BrandId = "zaltor" | "ambar";

export type ThemeId = "home" | SectionId | BrandId;

export type Rgba = readonly [number, number, number, number];

/**
 * Flat tones: `base` for the body of the halftone, `crest` for its largest dots,
 * `accent` for the crests of a drawing's dark parts (see `rasterScene`).
 */
export interface Theme {
  base: Rgba;
  crest: Rgba;
  accent: Rgba;
}

function hex(value: string, alpha = 1): Rgba {
  const n = Number.parseInt(value.slice(1), 16);

  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, alpha];
}

/** Every section shares the neutral body; its color only reaches the crests. */
const base = hex("#4a4a4a");

/** One crest color, or a second one for the dark parts of two-tone drawings. */
function theme(crest: string, accent = crest): Theme {
  return { base, crest: hex(crest), accent: hex(accent) };
}

export const themes: Record<ThemeId, Theme> = {
  home: theme("#f2f2f2"),
  about: theme("#ffffff"),
  work: theme("#9dc0ff"),
  blog: theme("#8fecbd"),
  zaltor: theme("#f28a1e"),
  // The amber drop and its leaf, lifted a little so the leaf reads on the dark field.
  ambar: theme("#e09a2f", "#6c9440"),
};

/** Field drawings (by image URL) shown in their brand's color instead of the section's. */
const drawingThemes = new Map<string, BrandId>([
  [fieldDrawings.zaltor, "zaltor"],
  [fieldDrawings.ambar, "ambar"],
]);

export function themeFor(section: SectionId | null, drawing: string | null = null): ThemeId {
  return (drawing && drawingThemes.get(drawing)) || (section ?? "home");
}
