import { workDrawings } from "../../../data/drawings";
import type { SectionId } from "../../../data/routes";
import type { SceneField, SceneLayout } from "../types";
import { imageScene, textScene } from "./drawings";

/** What the halftone takes the shape of while a section is open. */
const sectionScenes: Record<SectionId, (layout: SceneLayout) => SceneField | Promise<SceneField>> = {
  about: (layout) => imageScene("/sflores-logo-white.svg", layout),
  work: (layout) => textScene("Work", layout),
  blog: (layout) => textScene("Aa", layout),
};

const cacheLimit = 8;

const built = new Map<string, Promise<SceneField>>();

/** Sections that open on a drawing; Work opens on the one read first. */
const openingDrawings: Partial<Record<SectionId, string>> = { work: workDrawings[0] };

function keyFor(id: SectionId, layout: SceneLayout, drawing: string | null): string {
  return `${drawing ?? id}@${Math.round(layout.width)}x${Math.round(layout.height)}:${Math.round(layout.band)}`;
}

export function buildScene(id: SectionId, layout: SceneLayout, drawing: string | null = null, opening = true): Promise<SceneField> {
  // Same drawing, same key: the opening scene and its block's share one build.
  const source = drawing ?? (opening ? openingDrawings[id] : null) ?? null;
  const key = keyFor(id, layout, source);
  let pending = built.get(key);

  if (!pending) {
    pending = Promise.resolve().then(() => (source ? imageScene(source, layout) : sectionScenes[id](layout)));
    pending.catch(() => built.delete(key));
    built.set(key, pending);

    if (built.size > cacheLimit) built.delete(built.keys().next().value ?? key);
  }

  return pending;
}

export function prewarmScene(id: SectionId, layout: SceneLayout): void {
  buildScene(id, layout).catch(() => {});
}
