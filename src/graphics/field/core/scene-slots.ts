import { compute, sampler, texture } from "vgpu";
import type { Compute, Gpu, Texture } from "vgpu";
import { sceneTexels, type FieldUniformValues, type SceneField } from "../types";
import sceneBake from "./scene-bake.wgsl";

const transitionMs = 1700;

const bakeWorkgroup = 8;

/** Quintic ease: a slow start and a long, soft settle with no velocity jump at either end. */
function smoother(t: number): number {
  const x = Math.min(1, Math.max(0, t));

  return x * x * x * (x * (x * 6 - 15) + 10);
}

/**
 * Two scene slots and the move between them. What is on screen is always `mix(A, B, front)`;
 * a new scene first bakes that mix into A (ping-pong, so the bake never reads what it writes),
 * then takes over B and restarts the front.
 */
export class SceneSlots {
  readonly sampler: ReturnType<typeof sampler>;
  readonly #gpu: Gpu;
  readonly #outgoing: [Texture, Texture];
  readonly #incoming: Texture;
  readonly #bake: Compute;
  readonly #empty = new Uint8Array(sceneTexels * sceneTexels * 4);

  #current = 0;
  #pending: Uint8Array | null = null;
  #pendingFromPane = -1;
  #fromPane = -1;
  #start = -Infinity;
  #seed = 0;
  #version = 0;

  constructor(gpu: Gpu) {
    this.#gpu = gpu;
    this.sampler = sampler(gpu, { magFilter: "linear", minFilter: "linear" });

    const outgoing = () =>
      texture(gpu, {
        kind: "2d",
        size: [sceneTexels, sceneTexels],
        format: "rgba8unorm",
        usage: ["texture_binding", "storage_binding"],
        label: "field-scene-outgoing",
      });

    this.#outgoing = [outgoing(), outgoing()];
    this.#incoming = texture(gpu, {
      kind: "2d",
      size: [sceneTexels, sceneTexels],
      format: "rgba8unorm",
      usage: ["texture_binding", "copy_dst"],
      label: "field-scene-incoming",
    });
    this.#bake = compute(gpu, sceneBake, { entry: "bake", label: "field-scene-bake" });
  }

  /** Bumps whenever the bound textures change, so draws only rebind when needed. */
  get version(): number {
    return this.#version;
  }

  get outgoing(): Texture {
    return this.#outgoing[this.#current];
  }

  get incoming(): Texture {
    return this.#incoming;
  }

  get seed(): number {
    return this.#seed;
  }

  /** Active closing front as a fraction of the pane, or -1 for an opening morph. */
  get fromPane(): number {
    return this.#fromPane;
  }

  progress(now: number): number {
    return smoother((now - this.#start) / transitionMs);
  }

  moving(now: number): boolean {
    const p = this.progress(now);

    return this.#pending !== null || (p > 0 && p < 1);
  }

  /** `fromPane` (>= 0) starts a closing wipe at that fraction of the pane width. */
  request(scene: SceneField | null, fromPane = -1): void {
    this.#pending = scene ? scene.data : this.#empty;
    this.#pendingFromPane = fromPane;
  }

  /**
   * Applies a queued scene. Must run before the frame's draw: the bake and the upload
   * are queued in order, ahead of the pass that reads them.
   */
  flush(uniforms: FieldUniformValues, now: number, instant: boolean): void {
    const data = this.#pending;

    if (!data) return;

    this.#pending = null;

    const fromPane = this.#pendingFromPane;
    const progress = this.progress(now);

    this.#pendingFromPane = -1;

    // A settled transition still needs the bake: what is on screen is B, and A holds an older scene.
    if (progress > 0) {
      const next = 1 - this.#current;

      uniforms.scene[0] = progress;
      uniforms.scene[2] = this.#fromPane;
      this.#bake.set({ u: uniforms, sceneA: this.outgoing, sceneB: this.#incoming, baked: this.#outgoing[next] });
      this.#bake.dispatch(Math.ceil(sceneTexels / bakeWorkgroup), Math.ceil(sceneTexels / bakeWorkgroup));
      this.#current = next;
    }

    this.#gpu.gpu.queue.writeTexture({ texture: this.#incoming.gpu }, data, { bytesPerRow: sceneTexels * 4 }, [
      sceneTexels,
      sceneTexels,
    ]);
    this.#fromPane = fromPane;
    this.#seed = (this.#seed + 7.31) % 97;
    this.#start = instant ? now - transitionMs : now;
    this.#version += 1;
  }
}
