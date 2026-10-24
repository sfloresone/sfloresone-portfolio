import type { SectionId } from "../../data/site";
import { cameraDuration, cameraPosition, cameraVelocity, inheritedVelocity, inertiaDistance, openingCameraTarget } from "./camera-motion";
import { mobileQuery } from "./layout-queries";
import { mobileCamera, onLostChange, onSectionChange, paneState } from "./state";

const touchSlop = 7;

const touchCommit = 9;

const wheelAxisHoldMs = 120;

type Depth = 0 | 1;

type TouchCamera = {
  id: number;
  x: number;
  y: number;
  scroll: number;
  mode: "horizontal" | "vertical" | null;
  moved: boolean;
  samples: Array<{ t: number; scroll: number }>;
};

type Pan = { from: number; to: number; velocity: number; duration: number; start: number; resolve: () => void };

let initialized = false;

let media: MediaQueryList | null = null;

let reducedMotion: MediaQueryList | null = null;

let stage: HTMLElement | null = null;

let depth: Depth = 0;

let selected: SectionId | null | undefined;

let selectedRoute = "";

let returnSection: SectionId | null = null;

let focusPending = false;

let pan: Pan | null = null;

let inertia: { from: number; velocity: number; start: number } | null = null;

let cameraFrame = 0;

let lastAdvance = 0;

let viewportWidth = 0;

let wheelAxis: "x" | "y" | null = null;

let wheelAxisTimer = 0;

let touchCamera: TouchCamera | null = null;

let touchVelocity = 0;

let suppressTouchClickUntil = 0;

function liveStage(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-shell-stage]");
}

export function isMobileLayout(): boolean {
  return (media ??= window.matchMedia(mobileQuery)).matches;
}

function prefersReducedMotion(): boolean {
  return (reducedMotion ??= window.matchMedia("(prefers-reduced-motion: reduce)")).matches;
}

function active(): boolean {
  if (!isMobileLayout()) return false;

  return document.querySelector("[data-shell]") !== null;
}

function strideOf(root: HTMLElement): number {
  return root.querySelector<HTMLElement>("[data-shell-deck]")?.offsetWidth || 300;
}

function clampScroll(root: HTMLElement, left: number): number {
  return Math.max(0, Math.min(Math.max(0, root.scrollWidth - root.clientWidth), left));
}

function syncGeometry(): void {
  const root = liveStage();

  mobileCamera.enabled = active();

  if (!root || !mobileCamera.enabled) return;

  bindStage(root);
  mobileCamera.x = root.scrollLeft;
  // Reserve the second column in scene coordinates so opening/closing never stretches a texture.
  mobileCamera.worldWidth = strideOf(root) * 2 + (root.querySelector<HTMLElement>("[data-shell-runway]")?.offsetWidth || 0);
  mobileCamera.paneLeft = strideOf(root);
  // Keep the old rectangle while the last wave loses its light, even after DOM removal.
  mobileCamera.paneWidth = root.querySelector<HTMLElement>("[data-pane-slot]")?.clientWidth || mobileCamera.paneWidth;
}

function onScroll(): void {
  if (stage && active()) mobileCamera.x = stage.scrollLeft;
}

function currentVelocity(now: number): number {
  if (pan) return cameraVelocity(pan.from, pan.to, pan.velocity, pan.duration, (now - pan.start) / 1000 / pan.duration);

  if (inertia) return inertia.velocity * Math.exp(-(now - inertia.start) / 240);

  return 0;
}

function cancelMotion(manual = false): void {
  pan?.resolve();
  pan = null;
  inertia = null;
  touchVelocity = 0;

  if (manual) focusPending = false;
}

function requestCameraFrame(): void {
  if (cameraFrame) return;

  cameraFrame = requestAnimationFrame((now) => {
    cameraFrame = 0;
    advanceMobileCamera(now);

    if (active() && (pan || inertia || focusPending || (!depth && paneState.hasLayers))) requestCameraFrame();
  });
}

function moveTo(left: number, animate: boolean): Promise<void> {
  const root = liveStage();

  if (!root || !active()) return Promise.resolve();

  const now = performance.now();
  const velocity = currentVelocity(now);
  const target = clampScroll(root, left);
  const width = strideOf(root);
  const duration = cameraDuration(target - root.scrollLeft, width, 20);

  cancelMotion();

  if (!animate || prefersReducedMotion() || duration === 0) {
    root.scrollLeft = target;
    mobileCamera.x = root.scrollLeft;
    requestCameraFrame();

    return Promise.resolve();
  }

  return new Promise((resolve) => {
    pan = { from: root.scrollLeft, to: target, velocity: inheritedVelocity(velocity, target - root.scrollLeft, duration, width, 20), duration, start: now, resolve };
    requestCameraFrame();
  });
}

/** Shared absolute-time update: WebGPU calls it before drawing; the RAF also works without GPU. */
export function advanceMobileCamera(now: number): void {
  // RAF timestamps may precede the GPU callback's performance.now() in the same frame.
  now = Math.max(now, lastAdvance);
  lastAdvance = now;

  const root = stage;

  if (!root || !root.isConnected) {
    cancelMotion(true);
    mobileCamera.enabled = false;

    return;
  }

  if (!active()) return;

  if (pan) {
    const current = pan;
    const progress = prefersReducedMotion() ? 1 : Math.max(0, (now - current.start) / 1000 / current.duration);

    root.scrollLeft = clampScroll(root, cameraPosition(current.from, current.to, current.velocity, current.duration, progress));

    if (progress >= 1) {
      pan = null;
      current.resolve();
    }
  } else if (inertia) {
    const seconds = Math.max(0, (now - inertia.start) / 1000);
    const target = inertia.from + inertiaDistance(inertia.velocity, seconds);

    root.scrollLeft = clampScroll(root, target);

    if (prefersReducedMotion() || Math.abs(inertia.velocity * Math.exp(-seconds / 0.24)) < 12 || Math.abs(root.scrollLeft - target) > 1) inertia = null;
  }

  mobileCamera.x = root.scrollLeft;

  if (!depth && !pan && !inertia && !paneState.hasLayers && !touchCamera) {
    const slot = root.querySelector<HTMLElement>("[data-pane-slot][data-camera-hold]");

    if (slot) {
      const closedMax = Math.max(0, root.scrollWidth - slot.offsetWidth - root.clientWidth);

      if (root.scrollLeft > closedMax + 0.5) {
        void moveTo(closedMax, true);
      } else {
        slot.removeAttribute("data-camera-hold");
        syncGeometry();
      }
    }
  }

  if (focusPending && !pan && !inertia && (depth ? paneState.revealReady : !paneState.hasLayers)) {
    focusPending = false;

    const target = depth
      ? root.querySelector<HTMLElement>("[data-pane-layer]:last-child [data-pane-title]")
      : root.querySelector<HTMLElement>(`[data-deck-link="${returnSection}"]`);

    target?.focus({ preventScroll: true });
  }
}

/** Pans to the opening composition or home, and settles canceled promises without stale timers. */
export function panTo(next: Depth, { animate = true }: { animate?: boolean } = {}): Promise<void> {
  depth = next;
  syncGeometry();

  const root = liveStage();

  if (!root || !active()) return Promise.resolve();

  const left = next ? openingCameraTarget(root.scrollLeft, root.getBoundingClientRect().left + strideOf(root), strideOf(root), document.documentElement.clientWidth) : 0;

  return moveTo(left, animate);
}

export function syncCameraToSection(id: SectionId | null, { animate = true }: { animate?: boolean } = {}): Promise<void> {
  return panTo(id ? 1 : 0, { animate });
}

function reanchor(): void {
  const width = document.documentElement.clientWidth;
  const changed = Math.abs(width - viewportWidth) > 0.5;

  viewportWidth = width;
  syncGeometry();

  if (!active()) {
    cancelMotion(true);

    return;
  }

  if (changed) void panTo(paneState.active ? 1 : 0, { animate: pan !== null });
}

function wheelPixels(value: number, mode: number, pageSize: number): number {
  if (mode === WheelEvent.DOM_DELTA_LINE) return value * 16;

  if (mode === WheelEvent.DOM_DELTA_PAGE) return value * pageSize;

  return value;
}

function onWheel(event: WheelEvent): void {
  const root = liveStage();

  if (!root || !active() || root.scrollWidth <= root.clientWidth + 1) return;

  const dx = wheelPixels(event.deltaX, event.deltaMode, root.clientWidth);
  const dy = wheelPixels(event.deltaY, event.deltaMode, root.clientHeight);

  if (!wheelAxis) {
    if (event.shiftKey || Math.abs(dx) > Math.abs(dy) * 1.15) wheelAxis = "x";
    else if (Math.abs(dy) > Math.abs(dx) * 1.15) wheelAxis = "y";
    else wheelAxis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
  }

  window.clearTimeout(wheelAxisTimer);
  wheelAxisTimer = window.setTimeout(() => {
    wheelAxis = null;
  }, wheelAxisHoldMs);

  if (wheelAxis !== "x" && !event.shiftKey) return;

  event.preventDefault();
  cancelMotion(true);
  root.scrollLeft = clampScroll(root, root.scrollLeft + (event.shiftKey ? dy : dx));
}

function findTouch(touches: TouchList, id: number): Touch | null {
  for (let i = 0; i < touches.length; i++) {
    if (touches[i].identifier === id) return touches[i];
  }

  return null;
}

function onTouchStart(event: TouchEvent): void {
  const root = liveStage();

  if (!root || !active()) return;

  cancelMotion(true);

  if (event.touches.length !== 1) {
    touchCamera = null;

    return;
  }

  const touch = event.touches[0];

  touchCamera = {
    id: touch.identifier,
    x: touch.clientX,
    y: touch.clientY,
    scroll: root.scrollLeft,
    mode: null,
    moved: false,
    samples: [{ t: performance.now(), scroll: root.scrollLeft }],
  };
}

function onTouchMove(event: TouchEvent): void {
  const root = liveStage();

  if (!root || !active() || !touchCamera || event.touches.length !== 1) return;

  const touch = findTouch(event.touches, touchCamera.id);

  if (!touch) return;

  const dx = touch.clientX - touchCamera.x;
  const dy = touch.clientY - touchCamera.y;

  if (!touchCamera.mode && Math.hypot(dx, dy) >= touchSlop) {
    if (Math.abs(dx) > Math.abs(dy) * 1.1) {
      touchCamera.mode = "horizontal";
      cancelMotion(true);
    } else if (Math.abs(dy) > Math.abs(dx) * 1.1) {
      touchCamera.mode = "vertical";
    }
  }

  if (touchCamera.mode !== "horizontal") return;

  event.preventDefault();
  touchCamera.moved = touchCamera.moved || Math.abs(dx) >= touchCommit;
  root.scrollLeft = clampScroll(root, touchCamera.scroll - dx);

  const now = performance.now();

  touchCamera.samples.push({ t: now, scroll: root.scrollLeft });

  while (touchCamera.samples.length > 2 && now - touchCamera.samples[0].t > 90) {
    touchCamera.samples.shift();
  }
}

function finishTouch(event: TouchEvent): void {
  const root = liveStage();

  if (!touchCamera) return;

  if (touchCamera.mode === "horizontal" && touchCamera.moved && root && active()) {
    const samples = touchCamera.samples;

    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];

      if (performance.now() - last.t > 80) {
        touchVelocity = 0;
      } else {
        const seconds = Math.max(0.016, (last.t - first.t) / 1000);
        const limit = root.clientWidth * 2.5;
        const velocity = (last.scroll - first.scroll) / seconds;

        touchVelocity = Math.max(-limit, Math.min(limit, velocity));
      }
    }

    suppressTouchClickUntil = performance.now() + 80;

    if (event.cancelable) event.preventDefault();

    if (Math.abs(touchVelocity) > 12 && !prefersReducedMotion()) {
      inertia = { from: root.scrollLeft, velocity: touchVelocity, start: performance.now() };
      requestCameraFrame();
    }
  }

  touchCamera = null;
}

function onClickCapture(event: MouseEvent): void {
  if (performance.now() >= suppressTouchClickUntil) return;

  event.preventDefault();
  event.stopPropagation();
}

function bindStage(root: HTMLElement): void {
  if (stage === root) return;

  if (stage) {
    stage.removeEventListener("scroll", onScroll);
    stage.removeEventListener("wheel", onWheel);
    stage.removeEventListener("touchstart", onTouchStart);
    stage.removeEventListener("touchmove", onTouchMove);
    stage.removeEventListener("touchend", finishTouch);
    stage.removeEventListener("touchcancel", onTouchCancel);
  }

  stage = root;
  stage.addEventListener("scroll", onScroll, { passive: true });
  stage.addEventListener("wheel", onWheel, { passive: false });
  stage.addEventListener("touchstart", onTouchStart, { passive: true });
  stage.addEventListener("touchmove", onTouchMove, { passive: false });
  stage.addEventListener("touchend", finishTouch, { passive: false });
  stage.addEventListener("touchcancel", onTouchCancel, { passive: true });
}

function onTouchCancel(): void {
  cancelMotion(true);
  touchCamera = null;
}

function onSection(id: SectionId | null): void {
  syncGeometry();

  const route = location.pathname;
  const initial = selected === undefined;

  if (selected === id) {
    if (selectedRoute !== route) {
      focusPending = active();
      requestCameraFrame();
    }

    selectedRoute = route;

    return;
  }

  if (selected) returnSection = selected;

  selected = id;
  selectedRoute = route;
  focusPending = active();
  void syncCameraToSection(id, { animate: !initial });
  requestCameraFrame();
}

export function initMobileCamera(): void {
  if (initialized) return;

  initialized = true;
  media = window.matchMedia(mobileQuery);
  reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  viewportWidth = document.documentElement.clientWidth;
  syncGeometry();
  onSectionChange(onSection);
  onLostChange(() => {
    cancelMotion(true);
    syncGeometry();
  });
  media.addEventListener("change", reanchor);
  reducedMotion.addEventListener("change", () => {
    if (prefersReducedMotion()) void panTo(depth, { animate: false });
  });
  window.addEventListener("resize", reanchor, { passive: true });
  window.addEventListener("orientationchange", reanchor, { passive: true });
  window.visualViewport?.addEventListener("resize", reanchor, { passive: true });
  document.addEventListener("click", onClickCapture, true);
}
