import type { TransitionBeforeSwapEvent } from "astro:transitions/client";
import {
  closeRevealToEmpty,
  isRevealOpen,
  revealFrontCol,
} from "../../scripts/panes/controller";
import { onLostChange, onSectionChange, onSectionIntent, paneState } from "../../scripts/panes/state";
import type { Field, SceneModule } from "./types";

interface NetworkHints {
  saveData?: boolean;
}

let initialized = false;

let field: Field | null = null;

let boundCanvas: HTMLCanvasElement | null = null;

let booting: Promise<void> | null = null;

let sceneModule: Promise<SceneModule> | null = null;

let lostRequest = 0;

const readyWaiters: Array<(current: Field) => void> = [];

function fieldCanvas(): HTMLCanvasElement | null {
  return document.querySelector<HTMLCanvasElement>("[data-field-canvas]");
}

function shellRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-shell]");
}

function setLostReady(ready: boolean): void {
  shellRoot()?.classList.toggle("is-lost-ready", ready);
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

  const layout = {
    width: Math.max(1, canvas.clientWidth),
    height: Math.max(1, canvas.clientHeight),
    band: Math.max(
      0,
      (document.querySelector<HTMLElement>("[data-pane-slot]")?.getBoundingClientRect().right ?? 0) -
        canvas.getBoundingClientRect().left,
    ),
  };

  const scene = await textScene("404", layout, { weight: 600 });

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

  onLostChange((lost) => {
    whenField((current) => {
      if (lost) void paintLost(current);
      else clearLost(current);
    });
  });

  document.addEventListener("astro:before-swap", (event: TransitionBeforeSwapEvent) => {
    if (!event.newDocument.querySelector("[data-field-canvas]")) teardown();
  });

  document.addEventListener("astro:page-load", boot);
  boot();
}
