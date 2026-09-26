import { clock, draw, frame, frameLoop, init, storage, surface } from "vgpu";
import type { Clock, Draw, Frame, FrameLoopHandle, Gpu, StorageBuffer, Surface } from "vgpu";
import type { SectionId } from "../../../data/site";
import { maxRevealRows, paneState } from "../../../scripts/panes/state";
import { themeFor, type ThemeId } from "../themes";
import type { Field, FieldUniformValues, SceneField, SceneLayout, SceneModule, Vec4 } from "../types";
import halftoneShader from "./halftone.wgsl";
import { Palette } from "./palette";
import { QualityMonitor } from "./quality";
import { SceneSlots } from "./scene-slots";

// The shell's `--surface` (#0b0b0b); the canvas is opaque so the compositor never blends it.
const surfaceTone = 11 / 255;

const clear: Vec4 = [surfaceTone, surfaceTone, surfaceTone, 1];

const pointerRadiusPx = 140;

const rippleLifeSeconds = 2.6;

const themeFadeMs = 1400;

const relayoutDelayMs = 250;

/** Scene fronts are this many cells wide. */
const sceneFrontCells = 3;

type ListenedEvents = WindowEventMap & DocumentEventMap;

interface Ripple {
  x: number;
  y: number;
  start: number;
}

/** Slow inhale and exhale of the whole field, with a second period so it never loops visibly. */
function breathAt(time: number): number {
  return 0.8 + 0.2 * Math.sin(time * Math.PI * 2 * 0.08) + 0.08 * Math.sin(time * Math.PI * 2 * 0.031 + 1.3);
}

function readUnit(canvas: HTMLCanvasElement): number {
  const shell = canvas.closest<HTMLElement>("[data-shell]");
  const unit = shell ? Number.parseFloat(getComputedStyle(shell).getPropertyValue("--unit")) : NaN;

  return Number.isFinite(unit) && unit > 0 ? unit : 20;
}

function emptyUniforms(): FieldUniformValues {
  return {
    canvas: [1, 1, 1, 0],
    grid: [1, 1, 20, 0],
    pointer: [-9999, -9999, 0, pointerRadiusPx],
    base: [0, 0, 0, 1],
    crest: [0, 0, 0, 1],
    ripple0: [0, 0, 0, 0],
    ripple1: [0, 0, 0, 0],
    ripple2: [0, 0, 0, 0],
    ripple3: [0, 0, 0, 0],
    scene: [1, sceneFrontCells, -1, 0],
    breath: [1, 0, 0, 0],
  };
}

class FieldEngine implements Field {
  readonly #gpu: Gpu;
  readonly #canvas: HTMLCanvasElement;
  readonly #output: Surface;
  readonly #dots: Draw;
  readonly #reveal: StorageBuffer;
  readonly #slots: SceneSlots;
  readonly #time: Clock;
  readonly #palette = new Palette();
  readonly #quality: QualityMonitor;
  readonly #uniforms = emptyUniforms();
  readonly #reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  readonly #resizeObserver: ResizeObserver;
  readonly #ripples: Ripple[] = [];
  readonly #cleanups: (() => void)[] = [];

  #loop: FrameLoopHandle | null = null;
  #cells = 1;
  #boundVersion = -1;
  #unit = 20;
  #cssWidth = 1;
  #cssHeight = 1;
  #canvasLeft = 0;
  #canvasTop = 0;
  #bandWidth = 0;
  #clientPointer: [number, number] | null = null;
  #pointerStrength = 0;
  #pointer: [number, number] = [-9999, -9999];
  #scenes: SceneModule | null = null;
  #section: SectionId | null = paneState.active;
  #shown: string | null = null;
  #sceneRequest = 0;
  #relayout: ReturnType<typeof setTimeout> | null = null;
  #disposed = false;
  #live = false;
  #stillQueued = false;

  constructor(gpu: Gpu, canvas: HTMLCanvasElement) {
    this.#gpu = gpu;
    this.#canvas = canvas;
    this.#output = surface(gpu, canvas, { autoResize: false, alphaMode: "opaque", label: "field" });
    this.#output.clearColor = clear;
    this.#time = clock(gpu);
    this.#quality = new QualityMonitor(() => this.#measure());
    this.#slots = new SceneSlots(gpu);
    this.#reveal = storage(gpu, maxRevealRows * 16, "read");
    this.#dots = draw(gpu, { shader: halftoneShader, vertices: 6, instances: 1, blend: "premultiplied", label: "field-dots" });
    this.#resizeObserver = new ResizeObserver(() => this.#measure());
    this.#palette.set(themeFor(paneState.active), performance.now(), 0);
  }

  get tier(): 0 | 1 {
    return this.#scenes ? 1 : 0;
  }

  async start(): Promise<void> {
    this.#measure();
    this.#writeUniforms(0, 0);
    this.#bind();

    await this.#dots.compile({ colors: [this.#output.format] });

    if (this.#disposed) return;

    this.#resizeObserver.observe(this.#canvas);
    this.#listen(window, "pointermove", (event) => this.#onPointerMove(event), { passive: true });
    this.#listen(window, "pointerdown", (event) => this.#onPointerDown(event), { passive: true });
    this.#listen(document.documentElement, "pointerleave", () => (this.#clientPointer = null));
    this.#listen(document, "visibilitychange", () => this.#syncLoop());

    const onMotionChange = () => this.#syncLoop();

    this.#reducedMotion.addEventListener("change", onMotionChange);
    this.#cleanups.push(() => this.#reducedMotion.removeEventListener("change", onMotionChange));
    this.#syncLoop();
  }

  setSection(id: SectionId | null): void {
    this.#setTheme(themeFor(id));
    this.#section = id;
    this.#showSection();
  }

  setScene(scene: SceneField | null, fromCol?: number): void {
    this.#slots.request(scene, fromCol);
    this.#requestStill();
  }

  whenSceneIdle(): Promise<void> {
    return new Promise((resolve) => {
      const wait = () => {
        if (this.#disposed) {
          resolve();

          return;
        }

        this.#requestStill();

        if (!this.#slots.moving(performance.now())) {
          resolve();

          return;
        }

        requestAnimationFrame(wait);
      };

      requestAnimationFrame(() => requestAnimationFrame(wait));
    });
  }

  prewarm(id: SectionId): void {
    this.#scenes?.prewarm(id, this.#layout());
  }

  upgrade(module: SceneModule): void {
    if (this.#scenes || this.#disposed) return;

    this.#scenes = module;
    this.#showSection();
  }

  dispose(): void {
    if (this.#disposed) return;

    this.#disposed = true;
    this.#loop?.stop();
    this.#loop = null;
    this.#resizeObserver.disconnect();

    if (this.#relayout) clearTimeout(this.#relayout);

    for (const cleanup of this.#cleanups) cleanup();

    this.#output.dispose();
    this.#gpu.dispose();
  }

  #setTheme(id: ThemeId): void {
    this.#palette.set(id, performance.now(), this.#reducedMotion.matches ? 0 : themeFadeMs);
    this.#requestStill();
  }

  #layout(): SceneLayout {
    return { width: this.#cssWidth, height: this.#cssHeight, band: this.#bandWidth };
  }

  #layoutKey(): string {
    return `${Math.round(this.#cssWidth)}x${Math.round(this.#cssHeight)}:${Math.round(this.#bandWidth)}`;
  }

  #showSection(): void {
    const id = this.#section;
    const key = id ? `${id}@${this.#layoutKey()}` : null;

    if (key === this.#shown) return;

    const request = ++this.#sceneRequest;

    if (!id) {
      this.#shown = null;
      this.setScene(null);

      return;
    }

    const module = this.#scenes;

    if (!module) return;

    module.build(id, this.#layout()).then(
      (scene) => {
        if (request !== this.#sceneRequest || this.#disposed) return;

        this.#shown = key;
        this.setScene(scene);
      },
      (error) => console.info("[field] scene failed", id, error),
    );
  }

  #listen<K extends keyof ListenedEvents>(
    target: Window | Document | HTMLElement,
    type: K,
    handler: (event: ListenedEvents[K]) => void,
    options?: AddEventListenerOptions,
  ): void {
    // SAFETY: every registered type is a window or document event key, so the dispatched event matches the handler.
    const listener = handler as EventListener;

    target.addEventListener(type, listener, options);
    this.#cleanups.push(() => target.removeEventListener(type, listener, options));
  }

  #syncLoop(): void {
    if (this.#disposed) return;

    const shouldRun = !document.hidden && !this.#reducedMotion.matches;

    if (shouldRun && !this.#loop) {
      this.#quality.reset();
      this.#loop = frameLoop(this.#gpu, (current) => this.#tick(current));
    } else if (!shouldRun && this.#loop) {
      this.#loop.stop();
      this.#loop = null;
    }

    if (!shouldRun) this.#requestStill();
  }

  #requestStill(): void {
    if (this.#loop || this.#stillQueued || this.#disposed) return;

    this.#stillQueued = true;
    requestAnimationFrame(() => {
      this.#stillQueued = false;

      if (this.#loop || this.#disposed) return;

      frame(this.#gpu, (current) => this.#render(current, this.#time.time, 0));
    });
  }

  #tick(current: Frame): void {
    const dt = this.#time.deltaTime;

    this.#quality.sample(dt * 1000);
    this.#render(current, this.#time.time, dt);
  }

  /** Binds the reveal rows and the current scene textures; only rebinds when the slots swap. */
  #bind(): void {
    this.#dots.set({
      u: this.#uniforms,
      sceneA: this.#slots.outgoing,
      sceneB: this.#slots.incoming,
      sceneSampler: this.#slots.sampler,
      reveal: this.#reveal,
    });
    this.#boundVersion = this.#slots.version;
  }

  #render(current: Frame, time: number, dt: number): void {
    const now = performance.now();

    this.#writeUniforms(time, dt);
    this.#slots.flush(this.#uniforms, now, this.#reducedMotion.matches);
    this.#uniforms.scene[0] = this.#slots.progress(now);
    this.#uniforms.scene[2] = this.#slots.fromCol;
    this.#uniforms.scene[3] = this.#slots.seed;

    if (this.#boundVersion !== this.#slots.version) this.#bind();

    this.#reveal.write(paneState.rows);
    this.#dots.set({ u: this.#uniforms });
    current.pass({ target: this.#output, clear }, (pass) => pass.draw(this.#dots, { instances: this.#cells }));

    if (!this.#loop && this.#slots.moving(now)) this.#requestStill();

    if (!this.#live) {
      this.#live = true;
      this.#canvas.classList.add("is-live");
    }
  }

  #measure(): void {
    const rect = this.#canvas.getBoundingClientRect();
    const slot = document.querySelector<HTMLElement>("[data-pane-slot]")?.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, this.#quality.level.maxDpr);
    const before = this.#layoutKey();

    this.#unit = readUnit(this.#canvas);
    this.#cssWidth = Math.max(1, rect.width);
    this.#cssHeight = Math.max(1, rect.height);
    this.#canvasLeft = rect.left;
    this.#canvasTop = rect.top;
    this.#bandWidth = slot ? Math.max(0, slot.right - rect.left) : 0;
    this.#output.resize([Math.round(this.#cssWidth * dpr), Math.round(this.#cssHeight * dpr)]);
    this.#uniforms.canvas[2] = dpr;

    const cols = Math.ceil(this.#cssWidth / this.#unit);
    const rows = Math.ceil(this.#cssHeight / this.#unit);

    this.#cells = cols * rows;
    this.#uniforms.grid = [cols, rows, this.#unit, Math.round(this.#bandWidth / this.#unit)];

    if (before !== this.#layoutKey() && this.#section) {
      if (this.#relayout) clearTimeout(this.#relayout);

      this.#relayout = setTimeout(() => {
        this.#relayout = null;
        this.#showSection();
      }, relayoutDelayMs);
    }

    this.#requestStill();
  }

  #onPointerMove(event: PointerEvent): void {
    this.#clientPointer = [event.clientX, event.clientY];
  }

  #onPointerDown(event: PointerEvent): void {
    const x = event.clientX - this.#canvasLeft;
    const y = event.clientY - this.#canvasTop;

    if (!this.#pointerActiveAt(x, y)) return;

    this.#ripples.push({ x, y, start: this.#time.time });

    if (this.#ripples.length > 4) this.#ripples.shift();

    this.#requestStill();
  }

  #pointerActiveAt(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x > this.#cssWidth || y > this.#cssHeight) return false;

    return !(paneState.hasLayers && x < this.#bandWidth);
  }

  #writeUniforms(time: number, dt: number): void {
    const u = this.#uniforms;
    const colors = this.#palette.values(performance.now());
    const client = this.#clientPointer;
    const x = client ? client[0] - this.#canvasLeft : -9999;
    const y = client ? client[1] - this.#canvasTop : -9999;
    const active = client !== null && this.#pointerActiveAt(x, y);

    if (active) this.#pointer = [x, y];

    const easing = dt > 0 ? 1 - Math.exp(-dt * (active ? 5 : 2.5)) : 1;

    this.#pointerStrength += ((active ? 1 : 0) - this.#pointerStrength) * easing;

    u.canvas = [this.#cssWidth, this.#cssHeight, u.canvas[2], time];
    u.pointer = [this.#pointer[0], this.#pointer[1], this.#pointerStrength, pointerRadiusPx];
    u.breath = [breathAt(time), 0, 0, 0];
    u.base = colors.base;
    u.crest = colors.crest;

    const slots: Vec4[] = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];

    this.#ripples.forEach((ripple, index) => {
      const age = time - ripple.start;

      if (age < rippleLifeSeconds) slots[index] = [ripple.x, ripple.y, age, 1 - age / rippleLifeSeconds];
    });

    u.ripple0 = slots[0];
    u.ripple1 = slots[1];
    u.ripple2 = slots[2];
    u.ripple3 = slots[3];
  }
}

export async function createField(canvas: HTMLCanvasElement): Promise<Field> {
  const gpu = await init();
  const engine = new FieldEngine(gpu, canvas);

  try {
    await engine.start();
  } catch (error) {
    engine.dispose();
    throw error;
  }

  return engine;
}
