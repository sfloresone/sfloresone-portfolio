import { workExperiences, type SectionId } from "../../../data/site";
import type { SceneField, SceneLayout } from "../types";
import { imageScene, textScene, timelineScene } from "./drawings";

const roleCount = workExperiences.reduce((total, entry) => total + entry.roles.length, 0);

/** What the halftone takes the shape of while a section is open. */
const sectionScenes: Record<SectionId, (layout: SceneLayout) => SceneField | Promise<SceneField>> = {
  about: (layout) => imageScene("/sflores-logo-white.svg", layout),
  work: (layout) => timelineScene(roleCount, layout),
  blog: (layout) => textScene("Aa", layout),
};

const cacheLimit = 8;

const built = new Map<string, Promise<SceneField>>();

function keyFor(id: SectionId, layout: SceneLayout): string {
  return `${id}@${Math.round(layout.width)}x${Math.round(layout.height)}:${Math.round(layout.band)}`;
}

export function buildScene(id: SectionId, layout: SceneLayout): Promise<SceneField> {
  const key = keyFor(id, layout);
  let pending = built.get(key);

  if (!pending) {
    pending = Promise.resolve().then(() => sectionScenes[id](layout));
    pending.catch(() => built.delete(key));
    built.set(key, pending);

    if (built.size > cacheLimit) built.delete(built.keys().next().value ?? key);
  }

  return pending;
}

export function prewarmScene(id: SectionId, layout: SceneLayout): void {
  buildScene(id, layout).catch(() => {});
}
