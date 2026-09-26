import type { SceneModule } from "../types";
import { buildScene, prewarmScene } from "./sections";

export const scenes: SceneModule = {
  build: buildScene,
  prewarm: prewarmScene,
};
