const cfg = {
  maxScale: 5,
  toggle: 2.5,
  wheelRate: 140,
  slop: 8,
  nearHome: 1.02,
  snapHome: 1.05,
  exitMs: 400,
} as const;

type Drag = {
  id: number;
  fromX: number;
  fromY: number;
  startX: number;
  startY: number;
  onContent: boolean;
};

type Parts = {
  root: HTMLDialogElement;
  shell: HTMLElement;
  frame: HTMLElement;
  image: HTMLImageElement;
  caption: HTMLElement | null;
  zoom: HTMLButtonElement | null;
};

let initialized = false;

let scale = 1;

let panX = 0;

let panY = 0;

let settleTimer: ReturnType<typeof setTimeout> | null = null;

let closing = false;

let drag: Drag | null = null;

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function els(): Parts | null {
  const root = document.querySelector<HTMLDialogElement>("[data-lightbox]");
  const shell = root?.querySelector<HTMLElement>("[data-lightbox-shell]");
  const frame = root?.querySelector<HTMLElement>("[data-lightbox-frame]");
  const image = root?.querySelector<HTMLImageElement>("[data-lightbox-image]");

  if (!root || !shell || !frame || !image) return null;

  return {
    root,
    shell,
    frame,
    image,
    caption: root.querySelector<HTMLElement>("[data-lightbox-caption]"),
    zoom: root.querySelector<HTMLButtonElement>("[data-lightbox-zoom]"),
  };
}

function limits(parts: Parts, nextScale: number) {
  return {
    mx: Math.max(0, (parts.image.offsetWidth * nextScale - parts.frame.clientWidth) / 2),
    my: Math.max(0, (parts.image.offsetHeight * nextScale - parts.frame.clientHeight) / 2),
  };
}

function paint(parts: Parts, live: boolean): void {
  const zoomed = scale > cfg.nearHome;

  parts.image.classList.toggle("duration-0", live);
  parts.image.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  parts.root.toggleAttribute("data-zoomed", zoomed);
  parts.frame.toggleAttribute("data-zoomed", zoomed);
  parts.zoom?.setAttribute("aria-label", zoomed ? "Zoom out" : "Zoom in");
}

function place(parts: Parts, nextScale: number, nextX: number, nextY: number, live: boolean): void {
  const { mx, my } = limits(parts, nextScale);

  scale = clamp(nextScale, 1, cfg.maxScale);
  panX = clamp(nextX, -mx, mx);
  panY = clamp(nextY, -my, my);
  paint(parts, live);
}

function zoomAt(parts: Parts, next: number, clientX: number, clientY: number, live: boolean): void {
  const box = parts.frame.getBoundingClientRect();
  const px = clientX - (box.left + box.width / 2);
  const py = clientY - (box.top + box.height / 2);
  const s = clamp(next, 1, cfg.maxScale);

  place(parts, s, px - ((px - panX) / scale) * s, py - ((py - panY) / scale) * s, live);
}

function reset(parts: Parts, live = false): void {
  place(parts, 1, 0, 0, live);
}

function settleSoon(parts: Parts): void {
  if (settleTimer) clearTimeout(settleTimer);

  settleTimer = setTimeout(() => {
    settleTimer = null;

    if (scale < cfg.snapHome) reset(parts, false);
  }, 220);
}

function markReady(parts: Parts, ready: boolean): void {
  parts.root.toggleAttribute("data-ready", ready);
  parts.shell.toggleAttribute("data-ready", ready);
}

function waitExit(parts: Parts): Promise<void> {
  if (reducedMotion()) return Promise.resolve();

  return new Promise((resolve) => {
    const done = () => {
      parts.shell.removeEventListener("transitionend", onEnd);
      resolve();
    };

    const onEnd = (event: TransitionEvent) => {
      if (event.target === parts.shell && event.propertyName === "opacity") done();
    };

    parts.shell.addEventListener("transitionend", onEnd);
    window.setTimeout(done, cfg.exitMs + 50);
  });
}

function openFrom(trigger: HTMLElement): void {
  const parts = els();
  const src = trigger.dataset.lightboxSrc;
  const alt = trigger.dataset.lightboxAlt ?? "";

  if (!parts || !src || closing) return;

  parts.image.src = src;

  parts.image.alt = alt;

  if (parts.caption) parts.caption.textContent = alt;

  reset(parts, true);

  markReady(parts, false);

  if (!parts.root.open) parts.root.showModal();

  parts.frame.focus({ preventScroll: true });

  requestAnimationFrame(() => requestAnimationFrame(() => markReady(parts, true)));
}

async function close(): Promise<void> {
  const parts = els();

  if (!parts?.root.open || closing) return;

  closing = true;
  reset(parts, true);
  markReady(parts, false);
  await waitExit(parts);
  parts.root.close();
  closing = false;
}

function toggleZoom(parts: Parts): void {
  const box = parts.frame.getBoundingClientRect();
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;

  if (scale > cfg.snapHome) reset(parts, false);
  else zoomAt(parts, Math.min(cfg.toggle, cfg.maxScale), cx, cy, false);
}

function onWheel(event: WheelEvent): void {
  const parts = els();

  if (!parts?.root.open) return;

  event.preventDefault();
  zoomAt(parts, scale * Math.exp(-event.deltaY / cfg.wheelRate), event.clientX, event.clientY, true);
  settleSoon(parts);
}

function onPointerDown(event: PointerEvent): void {
  const parts = els();

  if (!parts?.root.open) return;

  if (event.pointerType === "mouse" && event.button !== 0) return;

  if (!(event.currentTarget instanceof HTMLElement)) return;

  const target = event.target;
  // SAFETY: pointer hits are DOM nodes when inside the frame.
  const onContent = target instanceof Node && parts.image.contains(target);

  event.currentTarget.setPointerCapture(event.pointerId);
  drag = {
    id: event.pointerId,
    fromX: event.clientX,
    fromY: event.clientY,
    startX: panX,
    startY: panY,
    onContent,
  };
}

function onPointerMove(event: PointerEvent): void {
  const parts = els();

  if (!parts || !drag || drag.id !== event.pointerId || scale <= 1) return;

  place(
    parts,
    scale,
    drag.startX + (event.clientX - drag.fromX),
    drag.startY + (event.clientY - drag.fromY),
    true,
  );
}

function endDrag(event: PointerEvent): void {
  const parts = els();

  if (!parts || !drag || drag.id !== event.pointerId) return;

  const held = drag;

  drag = null;

  const moved = Math.hypot(event.clientX - held.fromX, event.clientY - held.fromY);

  if (moved < cfg.slop && !held.onContent && scale <= cfg.nearHome) {
    void close();

    return;
  }

  if (scale < cfg.snapHome) reset(parts, false);
}

function onDoubleClick(event: MouseEvent): void {
  const parts = els();

  if (!parts?.root.open) return;

  zoomAt(
    parts,
    scale > cfg.snapHome ? 1 : Math.min(cfg.toggle, cfg.maxScale),
    event.clientX,
    event.clientY,
    false,
  );
}

function bindFrame(parts: Parts): void {
  if (parts.frame.dataset.lightboxBound) return;

  parts.frame.dataset.lightboxBound = "";
  parts.frame.addEventListener("wheel", onWheel, { passive: false });
  parts.frame.addEventListener("pointerdown", onPointerDown);
  parts.frame.addEventListener("pointermove", onPointerMove);
  parts.frame.addEventListener("pointerup", endDrag);
  parts.frame.addEventListener("pointercancel", endDrag);
  parts.frame.addEventListener("dblclick", onDoubleClick);
}

/** Opens story photos marked with `data-lightbox-src` in the shared dialog. */
export function initLightbox(): void {
  if (initialized) return;

  initialized = true;

  const parts = els();

  if (parts) bindFrame(parts);

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    if (target.closest("[data-lightbox-close]")) {
      event.preventDefault();

      void close();

      return;
    }

    if (target.closest("[data-lightbox-zoom]")) {
      const current = els();

      event.preventDefault();

      if (current) toggleZoom(current);

      return;
    }

    const trigger = target.closest<HTMLElement>("[data-lightbox-src]");

    if (trigger) {
      event.preventDefault();

      openFrom(trigger);
    }
  });

  parts?.root.addEventListener("cancel", (event) => {
    event.preventDefault();

    if (scale > cfg.nearHome) {
      const current = els();

      if (current) reset(current, false);

      return;
    }

    void close();
  });

  parts?.root.addEventListener("close", () => {
    const current = els();

    if (current) {
      markReady(current, false);
      reset(current, true);
    }
  });
}
