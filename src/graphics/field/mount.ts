import type { TransitionBeforeSwapEvent } from "astro:transitions/client";
import {
  closeRevealToEmpty,
  isRevealOpen,
  revealFrontCol,
} from "../../scripts/panes/controller";
import { onLostChange, onSpreadChange, onSectionChange, onSectionIntent, paneState } from "../../scripts/panes/state";
import type { Field, Placement, SceneLayout, SceneModule } from "./types";

interface NetworkHints {
  saveData?: boolean;
}

let initialized = false;

let field: Field | null = null;

let boundCanvas: HTMLCanvasElement | null = null;

let booting: Promise<void> | null = null;

let sceneModule: Promise<SceneModule> | null = null;

let lostRequest = 0;

let spreadRequest = 0;

const readyWaiters: Array<(current: Field) => void> = [];

let spreadFrames: ResizeObserver | null = null;

function fieldCanvas(): HTMLCanvasElement | null {
  return document.querySelector<HTMLCanvasElement>("[data-field-canvas]");
}

function shellRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-shell]");
}

function setLostReady(ready: boolean): void {
  shellRoot()?.classList.toggle("is-lost-ready", ready);
}

function layoutOf(canvas: HTMLCanvasElement): SceneLayout {
  const pane = document.querySelector<HTMLElement>("[data-pane-slot]")?.getBoundingClientRect().right ?? 0;

  return {
    width: Math.max(1, canvas.clientWidth),
    height: Math.max(1, canvas.clientHeight),
    band: Math.max(0, pane - canvas.getBoundingClientRect().left),
  };
}

function capable(canvas: HTMLCanvasElement): boolean {
  if (!("gpu" in navigator)) return false;

  if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return false;

  // SAFETY: `connection` is the optional Network Information API; only its `saveData` flag is read.
  const connection = (navigator as Navigator & { connection?: NetworkHints }).connection;

  return connection?.saveData !== true;
}

function whenIdle(task: () => void): void {
  const run = () => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(task, { timeout: 2000 });
    else setTimeout(task, 200);
  };

  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
}

function loadScenes(): Promise<SceneModule> {
  sceneModule ??= import("./scenes").then((module) => module.scenes);

  return sceneModule;
}

async function upgrade(): Promise<void> {
  const current = field;

  if (!current || current.tier === 1) return;

  const module = await loadScenes();

  if (field === current) current.upgrade(module);
}

function notifyReady(current: Field): void {
  const waiters = readyWaiters.splice(0, readyWaiters.length);

  for (const waiter of waiters) waiter(current);
}

function teardown(): void {
  field?.dispose();
  field = null;
  boundCanvas = null;
}

async function paintLost(current: Field): Promise<void> {
  const canvas = fieldCanvas();
  const request = ++lostRequest;

  setLostReady(false);

  if (!canvas || !paneState.lost) return;

  await upgrade();

  if (request !== lostRequest || field !== current || !paneState.lost) return;

  const { textScene } = await import("./scenes/drawings");

  const scene = await textScene("404", layoutOf(canvas), { weight: 600 });

  if (request !== lostRequest || field !== current || !paneState.lost) return;

  if (isRevealOpen()) {
    const fromCol = Math.max(0, revealFrontCol());

    current.setScene(scene, fromCol);

    await Promise.all([current.whenSceneIdle(), closeRevealToEmpty()]);
  } else {
    current.setScene(scene);
    await current.whenSceneIdle();
  }

  if (request !== lostRequest || field !== current || !paneState.lost) return;

  setLostReady(true);
}

function clearLost(current: Field): void {
  lostRequest += 1;
  setLostReady(false);
  current.setScene(null);
}

function gallerySpreads(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("[data-gallery] [data-gallery-spread]:not([data-leaving])")];
}

function allSpreads(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("[data-gallery-spread]")];
}

async function frameSpreadElement(spread: HTMLElement): Promise<void> {
  const { frameSpread } = await import("./scenes/cover");
  const photos = [...spread.querySelectorAll<HTMLImageElement>("[data-spread-photo]")];

  await Promise.all(
    photos.map((photo) => {
      if (photo.complete && photo.naturalWidth > 0) return Promise.resolve();

      return photo.decode().catch(
        () =>
          new Promise<void>((resolve) => {
            photo.addEventListener("load", () => resolve(), { once: true });
            photo.addEventListener("error", () => resolve(), { once: true });
          }),
      );
    }),
  );
  frameSpread(spread);
}

function watchSpreadFrames(): void {
  spreadFrames?.disconnect();
  spreadFrames = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target instanceof HTMLElement) void frameSpreadElement(entry.target);
    }
  });

  for (const spread of allSpreads()) {
    spreadFrames.observe(spread);
    void frameSpreadElement(spread);
  }
}

/** Fades in the gallery spread `id` and fades out the rest. */
function develop(id: string | null): void {
  for (const spread of gallerySpreads()) {
    const on = spread.dataset.gallerySpread === id;

    spread.toggleAttribute("data-developed", on);

    if (on) void frameSpreadElement(spread);
  }
}

/** Sweeps the spread in as a halftone right where its photos sit, then develops the real ones. */
async function revealSpread(current: Field, id: string, request: number): Promise<void> {
  const canvas = fieldCanvas();
  const spread = gallerySpreads().find((candidate) => candidate.dataset.gallerySpread === id);

  if (!canvas || !spread) return;

  const photos = [...spread.querySelectorAll<HTMLImageElement>("[data-spread-photo]")];
  const box = spread.getBoundingClientRect();
  const origin = canvas.getBoundingClientRect();
  const placement: Placement = { x: box.left - origin.left, y: box.top - origin.top, width: box.width, height: box.height };
  const seam = Number.parseFloat(getComputedStyle(spread).getPropertyValue("--seam")) || 0;

  const [{ spreadScene }, { frameSpread }] = await Promise.all([
    import("./scenes/drawings"),
    import("./scenes/cover"),
  ]);

  await Promise.all(photos.map((photo) => photo.decode().catch(() => {})));
  frameSpread(spread);

  const scene = await spreadScene(
    photos.map((photo) => photo.getAttribute("src") ?? ""),
    layoutOf(canvas),
    {
      layout: spread.dataset.layout === "diagonal" ? "diagonal" : "full",
      placement,
      seam,
    },
  );

  if (request !== spreadRequest || field !== current) return;

  current.setOverride(scene);
  await current.whenSceneIdle();

  if (request === spreadRequest) develop(id);
}

function showSpread(id: string | null): void {
  const request = ++spreadRequest;
  const canvas = fieldCanvas();

  develop(null);

  if (!id) {
    field?.setOverride(null);

    return;
  }

  if (!canvas || !capable(canvas) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    develop(id);
  }

  if (!canvas || !capable(canvas)) return;

  whenField((current) => {
    if (request === spreadRequest) void revealSpread(current, id, request);
  });

  void booting?.then(() => {
    if (!field && request === spreadRequest) develop(id);
  });
}

function boot(): void {
  const canvas = fieldCanvas();

  if (!canvas) return;

  if (field && boundCanvas !== canvas) teardown();

  if (field || booting || !capable(canvas)) {
    if (field) {
      notifyReady(field);

      if (paneState.lost) void paintLost(field);
    }

    return;
  }

  booting = new Promise<void>((resolve) => {
    whenIdle(async () => {
      try {
        if (fieldCanvas() !== canvas) return;

        const { createField } = await import("./core/engine");
        const created = await createField(canvas);

        if (fieldCanvas() !== canvas) {
          created.dispose();

          return;
        }

        field = created;
        boundCanvas = canvas;
        notifyReady(created);

        if (paneState.lost) void paintLost(created);
        else if (paneState.active) void upgrade();
      } catch (error) {
        console.info("[field] unavailable", error);
      } finally {
        booting = null;
        resolve();
      }
    });
  });
}

/** Resolves with the live field once it has bound the current canvas. */
export function whenField(callback: (current: Field) => void): void {
  const canvas = fieldCanvas();

  if (field && boundCanvas === canvas) {
    callback(field);

    return;
  }

  readyWaiters.push(callback);
  boot();
}

export function initField(): void {
  if (initialized) return;

  initialized = true;

  onSectionChange((id) => {
    if (paneState.lost) return;

    field?.setSection(id);

    if (id) void upgrade();
  });

  onSectionIntent((id) => {
    if (!field || !id || paneState.lost) return;

    void upgrade().then(() => field?.prewarm(id));
  });

  onSpreadChange(showSpread);

  if (paneState.spread) showSpread(paneState.spread);

  onLostChange((lost) => {
    whenField((current) => {
      if (lost) void paintLost(current);
      else clearLost(current);
    });
  });

  document.addEventListener("astro:before-swap", (event: TransitionBeforeSwapEvent) => {
    if (!event.newDocument.querySelector("[data-field-canvas]")) teardown();
  });

  document.addEventListener("astro:page-load", () => {
    boot();
    watchSpreadFrames();
  });
  boot();
  watchSpreadFrames();
}
