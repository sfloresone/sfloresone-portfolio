import type { SectionId } from "../../data/site";

export type ThemeId = "home" | SectionId;

export type Rgba = readonly [number, number, number, number];

/** Flat tones: `base` for the body of the halftone, `crest` for its largest dots. */
export interface Theme {
  base: Rgba;
  crest: Rgba;
}

function hex(value: string, alpha = 1): Rgba {
  const n = Number.parseInt(value.slice(1), 16);

  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, alpha];
}

/** Every section shares the neutral body; its color only reaches the crests. */
const base = hex("#4a4a4a");

export const themes: Record<ThemeId, Theme> = {
  home: { base, crest: hex("#f2f2f2") },
  about: { base, crest: hex("#ffffff") },
  work: { base, crest: hex("#9dc0ff") },
  blog: { base, crest: hex("#8fecbd") },
};

export function themeFor(section: SectionId | null): ThemeId {
  return section ?? "home";
}
