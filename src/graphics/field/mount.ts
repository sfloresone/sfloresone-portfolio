import type { TransitionBeforeSwapEvent } from "astro:transitions/client";
import {
  closeRevealToEmpty,
  isRevealOpen,
  revealFrontCol,
} from "../../scripts/panes/controller";
import { mobileCamera, onLostChange, onSpreadChange, onSectionChange, onSectionIntent, paneState } from "../../scripts/panes/state";
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

let spreadLayoutKey: string | null = null;

let spreadRelayout: ReturnType<typeof setTimeout> | null = null;

const spreadRelayoutMs = 150;

function fieldCanvas(): HTMLCanvasElement | null {
  return document.querySelector<HTMLCanvasElement>("[data-field-canvas]");
}

function layoutOf(canvas: HTMLCanvasElement): SceneLayout {
  const box = canvas.getBoundingClientRect();
  const pane = document.querySelector<HTMLElement>("[data-pane-slot]")?.getBoundingClientRect().right ?? 0;

  return {
    width: Math.max(1, box.width),
    height: Math.max(1, box.height),
    band: Math.max(0, pane - box.left),
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
  spreadRequest += 1;

  if (spreadRelayout) clearTimeout(spreadRelayout);

  spreadRelayout = null;
  spreadLayoutKey = null;
  field?.dispose();
  field = null;
  boundCanvas = null;
}

/**
 * On mobile the world counts a pane column even when none is open, so "404" is placed
 * on the runway right after the deck, where swiping reveals it. Desktop keeps the default.
 */
function lostPlacement(height: number): Placement | undefined {
  if (!mobileCamera.enabled) return undefined;

  const runway = Math.max(1, mobileCamera.worldWidth - mobileCamera.paneLeft * 2);
  const padX = runway * 0.04;
  const padY = height * 0.3;

  return { x: mobileCamera.paneLeft + padX, y: padY, width: runway - padX * 2, height: height - padY * 2 };
}

async function paintLost(current: Field): Promise<void> {
  const canvas = fieldCanvas();
  const request = ++lostRequest;

  if (!canvas || !paneState.lost) return;

  await upgrade();

  if (request !== lostRequest || field !== current || !paneState.lost) return;

  const { textScene } = await import("./scenes/drawings");

  // The field's own layout: on mobile it draws in the camera's world.
  const layout = current.sceneLayout();
  const scene = await textScene("404", layout, { weight: mobileCamera.enabled ? 700 : 600, placement: lostPlacement(layout.height) });

  if (request !== lostRequest || field !== current || !paneState.lost) return;

  if (isRevealOpen()) {
    const fromCol = Math.max(0, revealFrontCol());

    current.setScene(scene, fromCol);

    await Promise.all([current.whenSceneIdle(), closeRevealToEmpty()]);
  } else {
    current.setScene(scene);
    await current.whenSceneIdle();
  }
}

function clearLost(current: Field): void {
  lostRequest += 1;
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

  // A failed decode is already settled; waiting for a later load/error event can hang forever.
  await Promise.all(photos.map((photo) => photo.decode().catch(() => {})));
  frameSpread(spread);
}

function spreadGeometry(canvas: HTMLCanvasElement, spread: HTMLElement) {
  const layout = layoutOf(canvas);
  const box = spread.getBoundingClientRect();
  const origin = canvas.getBoundingClientRect();
  const placement: Placement = { x: box.left - origin.left, y: box.top - origin.top, width: box.width, height: box.height };
  const seam = Number.parseFloat(getComputedStyle(spread).getPropertyValue("--seam")) || 0;

  const sources = [...spread.querySelectorAll<HTMLImageElement>("[data-spread-photo]")]
    .map((photo) => photo.currentSrc || photo.src).join("\n");

  const key = [layout.width, layout.height, layout.band, placement.x, placement.y, placement.width, placement.height, seam, sources].join(":");

  return { layout, placement, seam, key };
}

/** Invalidates a pending reveal immediately; coalesces resize and srcset changes before rebuilding. */
function refreshSpread(): void {
  const id = paneState.spread;
  const canvas = fieldCanvas();
  const spread = gallerySpreads().find((candidate) => candidate.dataset.gallerySpread === id);

  if (!id || !canvas || !spread) return;

  const { key } = spreadGeometry(canvas, spread);

  if (key === spreadLayoutKey) return;

  spreadLayoutKey = key;

  const request = ++spreadRequest;

  if (spreadRelayout) clearTimeout(spreadRelayout);

  spreadRelayout = setTimeout(() => {
    spreadRelayout = null;

    if (request === spreadRequest) queueSpread(id, request);
  }, spreadRelayoutMs);
}

function watchSpreadFrames(): void {
  spreadFrames?.disconnect();
  spreadFrames = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target instanceof HTMLElement && entry.target.hasAttribute("data-gallery-spread")) {
        void frameSpreadElement(entry.target);
      }
    }

    refreshSpread();
  });

  const canvas = fieldCanvas();

  if (canvas) spreadFrames.observe(canvas);

  for (const spread of allSpreads()) {
    spreadFrames.observe(spread);
    void frameSpreadElement(spread);
  }
}

/** The field drawing of the `[data-spread]` block `id` in the newest pane layer, if it has one. */
function drawingFor(id: string | null): string | null {
  if (!id) return null;

  const layer = [...document.querySelectorAll<HTMLElement>("[data-pane-slot] > [data-pane-layer]")].at(-1);
  const blocks = layer?.querySelectorAll<HTMLElement>("[data-spread-drawing]") ?? [];

  return [...blocks].find((block) => block.dataset.spread === id)?.dataset.spreadDrawing ?? null;
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

  const isCurrent = () => request === spreadRequest && field === current && paneState.spread === id
    && fieldCanvas() === canvas && spread.isConnected && !spread.hasAttribute("data-leaving");

  try {
    const [{ spreadScene }, { frameSpread }] = await Promise.all([
      import("./scenes/drawings"),
      import("./scenes/cover"),
    ]);

    await Promise.all(photos.map((photo) => photo.decode()));

    if (!isCurrent()) return;

    frameSpread(spread);
    // Read geometry after decoding, then paint synchronously from the same DOM images.
    const { layout, placement, seam, key } = spreadGeometry(canvas, spread);

    if (!capable(canvas) || placement.width === 0 || placement.height === 0) {
      develop(id);
      current.setOverride(null);

      return;
    }

    const scene = spreadScene(photos, layout, {
      layout: spread.dataset.layout === "diagonal" ? "diagonal" : "full",
      placement,
      seam,
    });

    spreadLayoutKey = key;
    current.setOverride(scene);
    await current.whenSceneIdle();

    if (!isCurrent()) return;

    if (spreadGeometry(canvas, spread).key !== key) {
      refreshSpread();

      return;
    }

    develop(id);
  } catch (error) {
    if (!isCurrent()) return;

    console.info("[field] photo failed", error);
    current.setOverride(null);
    develop(id);
  }
}

function queueSpread(id: string, request: number): void {
  const canvas = fieldCanvas();
  const spread = gallerySpreads().find((candidate) => candidate.dataset.gallerySpread === id);

  if (!canvas || !spread || !capable(canvas) || spread.clientWidth === 0 || spread.clientHeight === 0
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    develop(id);
    field?.setOverride(null);

    return;
  }

  whenField((current) => {
    if (request === spreadRequest) void revealSpread(current, id, request);
  });

  void booting?.then(() => {
    if (!field && request === spreadRequest) develop(id);
  });
}

function showSpread(id: string | null): void {
  const request = ++spreadRequest;
  const canvas = fieldCanvas();
  const spread = gallerySpreads().find((candidate) => candidate.dataset.gallerySpread === id);

  if (spreadRelayout) clearTimeout(spreadRelayout);
  spreadRelayout = null;
  spreadLayoutKey = canvas && spread ? spreadGeometry(canvas, spread).key : null;
  develop(null);

  if (!id) {
    field?.setOverride(null);

    return;
  }

  queueSpread(id, request);
}

/** A drawing block hands the field its drawing; any other spread may be a gallery photo. */
function followSpread(id: string | null): void {
  const drawing = drawingFor(id);

  field?.setDrawing(drawing);
  // Always through `showSpread`: it also releases a photo still held from the page before.
  showSpread(drawing ? null : id);
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
        created.setDrawing(drawingFor(paneState.spread));
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

  onSpreadChange(followSpread);

  window.addEventListener("resize", refreshSpread, { passive: true });
  document.addEventListener("load", (event) => {
    const photo = event.target;

    if (!(photo instanceof HTMLImageElement) || !photo.hasAttribute("data-spread-photo")) return;

    const spread = photo.closest<HTMLElement>("[data-gallery-spread]");

    if (spread) void frameSpreadElement(spread);

    if (photo.closest("[data-gallery]")) refreshSpread();
  }, true);

  if (paneState.spread) followSpread(paneState.spread);

  onLostChange((lost) => {
    whenField((current) => {
      if (!lost) {
        clearLost(current);

        return;
      }

      // Drop the section first, so a relayout can't bring its drawing back over the 404.
      current.setSection(null);
      void paintLost(current);
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
