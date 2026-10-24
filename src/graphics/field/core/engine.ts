import { clock, draw, frame, frameLoop, init, storage, surface } from "vgpu";
import type { Clock, Draw, Frame, FrameLoopHandle, Gpu, StorageBuffer, Surface } from "vgpu";
import type { SectionId } from "../../../data/site";
import { compactQuery, mobileQuery } from "../../../scripts/panes/layout-queries";
import { mobileCamera, paneState } from "../../../scripts/panes/state";
import { advanceMobileCamera } from "../../../scripts/panes/mobile-camera";
import { themeFor, type ThemeId } from "../themes";
import type { Field, FieldUniformValues, SceneField, SceneLayout, SceneModule, Vec4 } from "../types";
import halftoneShader from "./halftone.wgsl";
import { Palette } from "./palette";
import { drawingGrids, fieldGrid } from "./grid";
import { QualityMonitor, initialQualityIndex } from "./quality";
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
  /** Normalized canvas coordinates, so an active wave follows viewport changes. */
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
    grid: [1, 1, 1, 0],
    pane: [20, 0, 0, 1],
    pointer: [-9999, -9999, 0, pointerRadiusPx],
    base: [0, 0, 0, 1],
    crest: [0, 0, 0, 1],
    accent: [0, 0, 0, 1],
    ripple0: [0, 0, 0, 0],
    ripple1: [0, 0, 0, 0],
    ripple2: [0, 0, 0, 0],
    ripple3: [0, 0, 0, 0],
    scene: [1, sceneFrontCells, -1, 0],
    breath: [1, 0, 0, 0],
    camera: [-1, 1, 0, 0],
  };
}

class FieldEngine implements Field {
  readonly #gpu: Gpu;
  readonly #canvas: HTMLCanvasElement;
  readonly #output: Surface;
  readonly #dots: Draw;
  readonly #slots: SceneSlots;
  readonly #time: Clock;
  readonly #palette = new Palette();
  readonly #quality: QualityMonitor;
  readonly #uniforms = emptyUniforms();
  readonly #reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  readonly #mobileLayout = window.matchMedia(mobileQuery);
  readonly #compactLayout = window.matchMedia(compactQuery);
  readonly #resizeObserver: ResizeObserver;
  readonly #ripples: Ripple[] = [];
  readonly #cleanups: (() => void)[] = [];

  #loop: FrameLoopHandle | null = null;
  #reveal: StorageBuffer;
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
  /** Holds a scene over the section's own until it is cleared. */
  #override = false;
  /** Image drawn in place of the section's own scene, following the block being read. */
  #drawing: string | null = null;
  /** Last scene handed to the slots, to skip morphing into the same one. */
  #applied: SceneField | null = null;
  #sceneRequest = 0;
  #relayout: ReturnType<typeof setTimeout> | null = null;
  #disposed = false;
  #started = false;
  #visible = false;
  #live = false;
  #stillQueued = false;

  constructor(gpu: Gpu, canvas: HTMLCanvasElement) {
    this.#gpu = gpu;
    this.#canvas = canvas;
    this.#output = surface(gpu, canvas, { autoResize: false, alphaMode: "opaque", label: "field" });
    this.#output.clearColor = clear;
    this.#time = clock(gpu);
    this.#quality = new QualityMonitor(() => this.#measure(), initialQualityIndex(this.#mobileLayout.matches));
    this.#slots = new SceneSlots(gpu);
    this.#reveal = storage(gpu, paneState.rows.byteLength, "read");
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
    this.#listen(window, "resize", () => this.#measure(), { passive: true });
    this.#listen(window, "pointermove", (event) => this.#onPointerMove(event), { passive: true });
    this.#listen(window, "pointerdown", (event) => this.#onPointerDown(event), { passive: true });
    this.#listen(document.documentElement, "pointerleave", () => (this.#clientPointer = null));
    this.#listen(document, "visibilitychange", () => this.#syncLoop());

    const onMotionChange = () => this.#syncLoop();

    this.#reducedMotion.addEventListener("change", onMotionChange);
    this.#cleanups.push(() => this.#reducedMotion.removeEventListener("change", onMotionChange));

    const onMobileChange = () => this.#measure();

    this.#mobileLayout.addEventListener("change", onMobileChange);
    this.#cleanups.push(() => this.#mobileLayout.removeEventListener("change", onMobileChange));

    // Compact windows keep the section's own scene in the strip; drawings come back with the width.
    const onCompactChange = () => {
      this.#setTheme(themeFor(this.#section, this.#shownDrawing()));
      this.#showSection();
    };

    this.#compactLayout.addEventListener("change", onCompactChange);
    this.#cleanups.push(() => this.#compactLayout.removeEventListener("change", onCompactChange));
    this.#started = true;
    this.#syncLoop();
  }

  setSection(id: SectionId | null): void {
    if (this.#section !== id) {
      this.#quality.reset();
      // A drawing belongs to the section it was read in; the next one announces its own.
      this.#drawing = null;
    }

    this.#section = id;
    this.#setTheme(themeFor(id, this.#shownDrawing()));
    this.#showSection();
  }

  setScene(scene: SceneField | null, fromCol?: number): void {
    this.#sceneRequest += 1;
    this.#shown = null;
    this.#applyScene(scene, fromCol);
  }

  setOverride(scene: SceneField | null): void {
    this.#override = scene !== null;
    this.#sceneRequest += 1;
    this.#shown = null;

    if (scene) this.#applyScene(scene);
    else if (this.#scenes) this.#showSection();
    else this.#applyScene(null);
  }

  setDrawing(src: string | null): void {
    if (this.#drawing === src) return;

    this.#drawing = src;
    this.#setTheme(themeFor(this.#section, this.#shownDrawing()));
    this.#showSection();
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

  sceneLayout(): SceneLayout {
    return this.#layout();
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

  #applyScene(scene: SceneField | null, fromCol?: number): void {
    const fromPane = fromCol === undefined ? -1 : Math.min(1, Math.max(0, fromCol * this.#unit / Math.max(this.#bandWidth, 1)));

    this.#applied = scene;
    this.#slots.request(scene, fromPane);
    this.#requestStill();
  }

  #layout(): SceneLayout {
    if (mobileCamera.enabled) {
      return { width: mobileCamera.worldWidth, height: this.#cssHeight, band: mobileCamera.paneLeft + (paneState.active ? mobileCamera.paneWidth : 0) };
    }

    return { width: this.#cssWidth, height: this.#cssHeight, band: this.#bandWidth };
  }

  /** The drawing the field paints: none in a compact window, whose strip is too narrow for one. */
  #shownDrawing(): string | null {
    return this.#compactLayout.matches ? null : this.#drawing;
  }

  #layoutKey(): string {
    const layout = this.#layout();

    return `${Math.round(layout.width)}x${Math.round(layout.height)}:${Math.round(layout.band)}`;
  }

  #showSection(): void {
    if (this.#override) return;

    const id = this.#section;
    const compact = this.#compactLayout.matches;
    const drawing = this.#shownDrawing();
    const key = id ? `${id}:${drawing ?? ""}${compact ? ":compact" : ""}@${this.#layoutKey()}` : null;

    if (key === this.#shown) return;

    const request = ++this.#sceneRequest;

    if (!id) {
      this.#shown = null;
      this.#applyScene(null);

      return;
    }

    const module = this.#scenes;

    if (!module) return;

    module.build(id, this.#layout(), drawing, !compact).then(
      (scene) => {
        if (request !== this.#sceneRequest || this.#disposed) return;

        this.#shown = key;

        if (scene !== this.#applied) this.#applyScene(scene);
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

    const shouldRun = this.#visible && !document.hidden && !this.#reducedMotion.matches;

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
    if (!this.#started || !this.#visible || this.#loop || this.#stillQueued || this.#disposed) return;

    this.#stillQueued = true;
    requestAnimationFrame(() => {
      this.#stillQueued = false;

      if (!this.#visible || this.#loop || this.#disposed) return;

      frame(this.#gpu, (current) => this.#render(current, this.#time.time, 0));
    });
  }

  #tick(current: Frame): void {
    const dt = this.#time.deltaTime;

    this.#quality.sample(dt * 1000);
    this.#render(current, this.#time.time, dt);
  }

  /** Rebinds when scene slots swap or the reveal buffer grows. */
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

    advanceMobileCamera(now);
    this.#writeUniforms(time, dt);
    this.#slots.flush(this.#uniforms, now, this.#reducedMotion.matches);
    this.#uniforms.scene[0] = this.#slots.progress(now);
    this.#uniforms.scene[2] = this.#slots.fromPane;
    this.#uniforms.scene[3] = this.#slots.seed;

    if (paneState.rows.byteLength > this.#reveal.size) {
      this.#reveal = storage(this.#gpu, paneState.rows.byteLength, "read");
      this.#boundVersion = -1;
    }

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
    const mobile = this.#mobileLayout.matches;
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1 : this.#quality.level.maxDpr);
    const before = this.#layoutKey();
    const wasVisible = this.#visible;

    this.#visible = rect.width > 0 && rect.height > 0;
    this.#unit = readUnit(this.#canvas);
    this.#cssWidth = Math.max(1, rect.width);
    this.#cssHeight = Math.max(1, rect.height);
    this.#canvasLeft = rect.left;
    this.#canvasTop = rect.top;
    // Mobile: free-field only so horizontal pan does not thrash band/scenes; opaque panes cover dots.
    this.#bandWidth = mobile
      ? 0
      : slot
        ? Math.min(this.#cssWidth, Math.max(0, slot.right - rect.left))
        : 0;
    this.#output.resize([Math.max(1, Math.round(this.#cssWidth * dpr)), Math.max(1, Math.round(this.#cssHeight * dpr))]);
    this.#uniforms.canvas[2] = dpr;

    const geometry = fieldGrid(this.#cssWidth, this.#cssHeight, this.#bandWidth, this.#unit, drawingGrids[mobile ? "mobile" : "desktop"]);

    this.#cells = geometry.count;
    this.#uniforms.grid = geometry.grid;
    this.#uniforms.pane = geometry.layout;

    if (this.#visible && (before !== this.#layoutKey() || mobileCamera.enabled) && this.#section) {
      if (this.#relayout) clearTimeout(this.#relayout);

      this.#relayout = setTimeout(() => {
        this.#relayout = null;
        this.#showSection();
      }, relayoutDelayMs);
    }

    if (this.#started && wasVisible !== this.#visible) this.#syncLoop();

    this.#requestStill();
  }

  #onPointerMove(event: PointerEvent): void {
    this.#clientPointer = [event.clientX, event.clientY];
  }

  #onPointerDown(event: PointerEvent): void {
    const x = event.clientX - this.#canvasLeft;
    const y = event.clientY - this.#canvasTop;

    if (!this.#pointerActiveAt(x, y)) return;

    this.#ripples.push({ x: (x + (mobileCamera.enabled ? mobileCamera.x : 0)) / this.#layout().width, y: y / this.#cssHeight, start: this.#time.time });

    if (this.#ripples.length > 4) this.#ripples.shift();

    this.#requestStill();
  }

  #pointerActiveAt(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x > this.#cssWidth || y > this.#cssHeight) return false;

    if (mobileCamera.enabled) {
      const worldX = x + mobileCamera.x;

      return worldX >= mobileCamera.paneLeft && !(paneState.hasLayers && worldX < mobileCamera.paneLeft + mobileCamera.paneWidth);
    }

    return !(paneState.hasLayers && x < this.#bandWidth);
  }

  #writeUniforms(time: number, dt: number): void {
    const u = this.#uniforms;
    const colors = this.#palette.values(performance.now());
    const client = this.#clientPointer;
    const x = client ? client[0] - this.#canvasLeft : -9999;
    const y = client ? client[1] - this.#canvasTop : -9999;
    const active = client !== null && this.#pointerActiveAt(x, y);

    if (active) this.#pointer = [x + (mobileCamera.enabled ? mobileCamera.x : 0), y];

    const easing = dt > 0 ? 1 - Math.exp(-dt * (active ? 5 : 2.5)) : 1;

    this.#pointerStrength += ((active ? 1 : 0) - this.#pointerStrength) * easing;

    u.canvas = [this.#cssWidth, this.#cssHeight, u.canvas[2], time];
    u.camera = mobileCamera.enabled ? [mobileCamera.x, mobileCamera.worldWidth, mobileCamera.paneLeft, mobileCamera.paneWidth] : [-1, this.#cssWidth, 0, 0];
    u.pointer = [this.#pointer[0], this.#pointer[1], this.#pointerStrength, pointerRadiusPx * u.grid[2]];
    u.breath = [breathAt(time), 0, 0, 0];
    u.base = colors.base;
    u.crest = colors.crest;
    u.accent = colors.accent;

    const slots: Vec4[] = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];

    this.#ripples.forEach((ripple, index) => {
      const age = time - ripple.start;

      if (age < rippleLifeSeconds) slots[index] = [ripple.x * this.#layout().width, ripple.y * this.#cssHeight, age, 1 - age / rippleLifeSeconds];
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
