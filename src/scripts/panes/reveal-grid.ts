import { sections, type SectionId } from "../../data/site";
import { isSectionId, maxRevealRows, paneState, revealTuning, routeKey } from "./state";

/** A horizontal front across the pane column, or a vertical band over it. */
interface Front {
  /** Cells for the veil (grows rightward when opening), rows travelled for a band. */
  position: number;
  /** 1 sweeps a band downward, -1 upward; the veil ignores it. */
  direction: 1 | -1;
  age: number;
  seed: number;
  phase: number;
  /** Crest energy; it outlives the geometry and fades instead of switching off. */
  strength: number;
}

interface Layer {
  element: HTMLElement;
  section: SectionId;
  /** Route key of the page this layer came from; a section can own several. */
  route: string;
  /** Present while this layer is still sweeping over the one below it. */
  band: Front | null;
  focused: boolean;
  /** Last `clip-path` written, so unchanged frames skip the style write. */
  clip: string;
}

const maxLayers = 3;

/** How far the jagged flow can push a row past the front, in cells. */
const flowReach = revealTuning.flowCols + 1.05 + 0.42;

const lead = flowReach + 1;

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;

  return n - Math.floor(n);
}

function noise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const top = hash(xi, yi) + (hash(xi + 1, yi) - hash(xi, yi)) * u;
  const bottom = hash(xi, yi + 1) + (hash(xi + 1, yi + 1) - hash(xi, yi + 1)) * u;

  return top + (bottom - top) * v;
}

function smooth(t: number): number {
  const x = Math.min(1, Math.max(0, t));

  return x * x * (3 - 2 * x);
}

function freshFront(position: number, direction: 1 | -1 = 1): Front {
  return { position, direction, age: 0, seed: Math.random() * 1000, phase: Math.random() * Math.PI * 2, strength: 0 };
}

function deckIndex(id: SectionId): number {
  return sections.findIndex((section) => section.id === id);
}

/** Down the deck, or deeper into the same section, sweeps downward. */
function directionOf(from: Layer, section: SectionId, route: string): 1 | -1 {
  if (section !== from.section) return deckIndex(section) > deckIndex(from.section) ? 1 : -1;

  return route.startsWith(`${from.route}/`) ? 1 : -1;
}

/**
 * Owns the pane column's layers and the fronts that uncover them, one grid cell at a time.
 * Every reveal continues from where the previous one stands: a reversal keeps the front,
 * its texture and its energy, and a switch stacks a band over whatever is showing.
 */
export class RevealGrid {
  readonly slot: HTMLElement;
  readonly #reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  readonly #layers: Layer[] = [];
  readonly #open = new Float32Array(maxRevealRows);
  readonly #owners = new Int8Array(maxRevealRows);
  readonly #resize: ResizeObserver;

  #veil: Front = freshFront(-lead);
  #opening = false;
  #unit = 20;
  #cols = 0;
  #rows = 0;
  #width = 0;
  #height = 0;
  #frame = 0;
  #last = 0;

  constructor(slot: HTMLElement) {
    this.slot = slot;
    this.#measure();

    const existing = slot.querySelector<HTMLElement>("[data-pane-layer]");
    const section = existing?.querySelector<HTMLElement>("[data-pane]")?.dataset.pane;

    if (existing && isSectionId(section)) {
      this.#layers.push({
        element: existing,
        section,
        route: routeKey(existing.dataset.paneLayer ?? ""),
        band: null,
        focused: true,
        clip: "",
      });
      this.#opening = true;
      this.#veil.position = this.#cols + lead;
      this.#open.fill(this.#cols);
    }

    this.#resize = new ResizeObserver(() => {
      this.#measure();
      this.#write();
    });
    this.#resize.observe(slot);
    this.#write();
  }

  dispose(): void {
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#resize.disconnect();
  }

  /**
   * Closes the live veil from its current front back to empty (toward the left).
   * No-op when already closed.
   */
  closeToEmpty(): Promise<void> {
    if (!this.#opening && this.#fullyClosed()) return Promise.resolve();

    this.#opening = false;

    if (this.#reducedMotion.matches) {
      this.#finishNow();
      this.#write();

      return Promise.resolve();
    }

    this.#write();
    this.#run();

    return new Promise((resolve) => {
      const watch = () => {
        if (this.#settled() && !this.#opening) {
          resolve();

          return;
        }

        requestAnimationFrame(watch);
      };

      requestAnimationFrame(watch);
    });
  }

  /** True while any of the pane is still uncovered by the veil. */
  isOpen(): boolean {
    return this.#opening || !this.#fullyClosed();
  }

  /** Mean open column across rows (field cells from the pane's left edge). */
  frontCol(): number {
    if (this.#rows <= 0) return 0;

    let sum = 0;

    for (let r = 0; r < this.#rows; r++) sum += this.#open[r];

    return sum / this.#rows;
  }

  /**
   * Shows the `route` page of `section` (or closes the column when `null`);
   * `incoming` is its freshly adopted layer.
   */
  show(section: SectionId | null, route: string, incoming: HTMLElement | null): void {
    const top = this.#layers.at(-1);

    if (!section || !incoming) {
      this.#opening = false;
    } else if (top && top.route === route) {
      this.#opening = true;
    } else if (!top || this.#fullyClosed()) {
      for (const layer of this.#layers.splice(0)) layer.element.remove();

      this.slot.append(incoming);
      this.#layers.push({ element: incoming, section, route, band: null, focused: false, clip: "" });
      this.#veil = freshFront(-lead);
      this.#open.fill(0);
      this.#opening = true;
    } else {
      const direction = directionOf(top, section, route);

      this.slot.append(incoming);
      this.#layers.push({
        element: incoming,
        section,
        route,
        band: freshFront(-revealTuning.bandRows - 1, direction),
        focused: false,
        clip: "",
      });

      while (this.#layers.length > maxLayers) this.#layers.shift()?.element.remove();

      this.#opening = true;
    }

    if (this.#reducedMotion.matches) this.#finishNow();

    this.#write();
    this.#run();
  }

  #fullyClosed(): boolean {
    for (let r = 0; r < this.#rows; r++) if (this.#open[r] > 0) return false;

    return true;
  }

  #finishNow(): void {
    this.#veil.position = this.#opening ? this.#cols + lead : -lead;
    this.#veil.strength = 0;
    this.#open.fill(this.#opening ? this.#cols : 0);

    const newest = this.#layers.at(-1);

    if (!this.#opening) {
      for (const layer of this.#layers.splice(0)) layer.element.remove();
    } else if (newest) {
      for (const layer of this.#layers.splice(0, this.#layers.length - 1)) layer.element.remove();

      newest.band = null;
    }
  }

  #measure(): void {
    const shell = this.slot.closest<HTMLElement>("[data-shell]");
    const unit = shell ? Number.parseFloat(getComputedStyle(shell).getPropertyValue("--unit")) : NaN;

    this.#unit = Number.isFinite(unit) && unit > 0 ? unit : 20;
    this.#width = this.slot.clientWidth;
    this.#height = this.slot.clientHeight;

    const cols = Math.round(this.#width / this.#unit);

    if (this.#opening && this.#veil.position >= this.#cols + lead) {
      this.#veil.position = cols + lead;
      this.#open.fill(cols);
    }

    this.#cols = cols;
    this.#rows = Math.min(maxRevealRows, Math.ceil(this.#height / this.#unit));
  }

  #run(): void {
    if (this.#frame || this.#settled()) return;

    this.#last = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - this.#last) / 1000);

      this.#last = now;
      this.#advance(dt);
      this.#write();
      this.#frame = this.#settled() ? 0 : requestAnimationFrame(step);
    };

    this.#frame = requestAnimationFrame(step);
  }

  #settled(): boolean {
    const target = this.#opening ? this.#cols + lead : -lead;

    return (
      this.#veil.position === target &&
      this.#veil.strength < 0.001 &&
      this.#layers.every((layer) => !layer.band) &&
      (this.#opening || this.#layers.length === 0)
    );
  }

  /** Jagged offset of the veil on `row`: a slow noise flow plus two drifting sines. */
  #flow(front: Front, row: number): number {
    const age = front.age;
    const born = this.#opening ? 0.58 + 0.42 * smooth(age / 0.24) : smooth(age / 0.56);
    const breath = 0.82 + 0.18 * Math.sin(age * 1.9 + front.phase);

    return (
      ((noise(row * 0.13 + front.seed, age * 0.22) - 0.5) * 2 * revealTuning.flowCols * breath +
        Math.sin(row * 0.21 + age * 1.35 + front.phase) * 1.05 +
        Math.sin(row * 0.47 - age * 0.8 + front.seed * 0.37) * 0.42) *
      born
    );
  }

  #advance(dt: number): void {
    const veil = this.#veil;
    const span = this.#cols + lead * 2;
    const target = this.#opening ? this.#cols + lead : -lead;
    const speed = span / (this.#opening ? revealTuning.openSeconds : revealTuning.closeSeconds);
    const moving = veil.position !== target;

    veil.age += dt;
    veil.position = this.#opening
      ? Math.min(target, veil.position + speed * dt)
      : Math.max(target, veil.position - speed * dt);

    const energy = moving ? 1 : 0;
    const rate = moving ? 24 : 3 / revealTuning.crestTailSeconds;

    veil.strength += (energy - veil.strength) * (1 - Math.exp(-dt * rate));

    if (!moving && veil.strength < 0.001) veil.strength = 0;

    for (let r = 0; r < this.#rows; r++) {
      const reach = Math.min(this.#cols, Math.max(0, Math.floor(veil.position + this.#flow(veil, r))));

      this.#open[r] = this.#opening ? Math.max(this.#open[r], reach) : Math.min(this.#open[r], reach);
    }

    if (!this.#opening && !moving && this.#fullyClosed()) {
      for (const layer of this.#layers.splice(0)) layer.element.remove();
    }

    const bandSpeed = (this.#rows + revealTuning.bandRows + 2) / revealTuning.switchSeconds;

    for (let i = this.#layers.length - 1; i >= 0; i--) {
      const band = this.#layers[i].band;

      if (!band) continue;

      band.age += dt;
      band.position += bandSpeed * dt;
      band.strength += (1 - band.strength) * (1 - Math.exp(-dt * 8));

      if (band.position - revealTuning.bandRows > this.#rows) {
        for (const layer of this.#layers.splice(0, i)) layer.element.remove();

        this.#layers[0].band = null;

        break;
      }
    }
  }

  /** Rows travelled by `band` when it reaches `row`, so an upward band reads like a downward one. */
  #along(band: Front, row: number): number {
    return band.direction > 0 ? row : this.#rows - 1 - row;
  }

  /** Index of the layer showing on `row`, or -1 where a band or nothing covers it. */
  #ownerOf(row: number): number {
    for (let i = this.#layers.length - 1; i >= 0; i--) {
      const band = this.#layers[i].band;

      if (!band) return i;

      const edge = Math.floor(band.position);
      const along = this.#along(band, row);

      if (along < edge - revealTuning.bandRows) return i;

      if (along < edge) return -1;
    }

    return -1;
  }

  #bandCrest(row: number): number {
    for (let i = this.#layers.length - 1; i >= 0; i--) {
      const band = this.#layers[i].band;

      if (!band) return 0;

      const edge = Math.floor(band.position);
      const along = this.#along(band, row);

      if (along === edge - 1) return band.strength;

      if (along >= edge - revealTuning.bandRows && along < edge) return band.strength * 0.35;
    }

    return 0;
  }

  #write(): void {
    const rows = paneState.rows;
    const owners = this.#owners;

    rows.fill(0);

    for (let r = 0; r < this.#rows; r++) {
      const owner = this.#ownerOf(r);
      const o = r * 4;

      owners[r] = owner;
      rows[o] = this.#open[r];
      rows[o + 1] = owner >= 0 ? 1 : 0;
      rows[o + 2] = this.#veil.strength;
      rows[o + 3] = this.#bandCrest(r);
    }

    this.#layers.forEach((layer, index) => this.#clip(layer, index));

    const newest = this.#layers.at(-1);

    const uncovered =
      this.#opening && newest !== undefined && !newest.band && this.#veil.position >= this.#cols + lead;

    paneState.hasLayers = this.#layers.length > 0;

    if (uncovered && newest && !newest.focused) {
      newest.focused = true;
      newest.element.querySelector<HTMLElement>("[data-pane-title]")?.focus({ preventScroll: true });
    }
  }

  /** Clips a layer to the cells it owns, as one polygon stepped per grid row. */
  #clip(layer: Layer, index: number): void {
    let full = true;
    const points = ["0 0"];

    for (let r = 0; r < this.#rows; r++) {
      const open = this.#owners[r] === index ? this.#open[r] : 0;
      const width = open >= this.#cols ? this.#width : open * this.#unit;
      const top = r * this.#unit;
      const bottom = Math.min(this.#height, top + this.#unit);

      if (width < this.#width) full = false;

      points.push(`${width}px ${top}px`, `${width}px ${bottom}px`);
    }

    points.push(`0 ${this.#height}px`);

    const clip = full ? "" : `polygon(${points.join(", ")})`;

    if (clip === layer.clip) return;

    layer.clip = clip;
    layer.element.style.clipPath = clip;
  }
}
