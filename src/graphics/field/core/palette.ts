import { themes, type Rgba, type Theme, type ThemeId } from "../themes";

function smooth(t: number): number {
  const x = Math.min(1, Math.max(0, t));

  return x * x * (3 - 2 * x);
}

function mixColor(a: Rgba, b: Rgba, t: number): [number, number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
}

export interface PaletteValues {
  base: [number, number, number, number];
  crest: [number, number, number, number];
}

/** Crossfades between themes on the CPU; the shader only ever sees the current mix. */
export class Palette {
  #from: Theme = themes.home;
  #to: Theme = themes.home;
  #start = 0;
  #duration = 1;
  #current: ThemeId = "home";

  get current(): ThemeId {
    return this.#current;
  }

  set(id: ThemeId, now: number, durationMs: number): void {
    if (id === this.#current) return;

    this.#from = this.values(now);
    this.#to = themes[id];
    this.#start = now;
    this.#duration = Math.max(1, durationMs);
    this.#current = id;
  }

  values(now: number): PaletteValues {
    const t = smooth((now - this.#start) / this.#duration);

    return {
      base: mixColor(this.#from.base, this.#to.base, t),
      crest: mixColor(this.#from.crest, this.#to.crest, t),
    };
  }
}
