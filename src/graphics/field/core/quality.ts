export interface QualityLevel {
  maxDpr: number;
}

export const qualityLevels: readonly QualityLevel[] = [
  { maxDpr: 2 },
  { maxDpr: 1.5 },
  { maxDpr: 1 },
];

/** Narrow viewports start at DPR 1; point budgets are independent of raster quality. */
export function initialQualityIndex(mobile: boolean): number {
  return mobile ? qualityLevels.length - 1 : 0;
}

const windowMs = 2000;

const slowFrameMs = 1000 / 48;

const idleGapMs = 250;

/**
 * Downgrade-only frame health: once presented frames stay slow for two seconds of active
 * time, ask for the next cheaper raster resolution. It never changes the drawing grid.
 * It never upgrades, so it cannot oscillate.
 */
export class QualityMonitor {
  #level: number;
  #slowMs = 0;
  #activeMs = 0;
  #warmupMs = 1500;
  #onChange: (level: QualityLevel) => void;

  constructor(onChange: (level: QualityLevel) => void, initialLevel = 0) {
    this.#onChange = onChange;
    this.#level = Math.max(0, Math.min(qualityLevels.length - 1, initialLevel));
  }

  get level(): QualityLevel {
    return qualityLevels[this.#level];
  }

  get levelIndex(): number {
    return this.#level;
  }

  reset(): void {
    this.#slowMs = 0;
    this.#activeMs = 0;
    this.#warmupMs = 1000;
  }

  sample(deltaMs: number): void {
    if (deltaMs <= 0 || deltaMs > idleGapMs) {
      this.reset();

      return;
    }

    if (this.#warmupMs > 0) {
      this.#warmupMs -= deltaMs;

      return;
    }

    this.#activeMs += deltaMs;

    if (deltaMs > slowFrameMs) this.#slowMs += deltaMs;

    if (this.#activeMs < windowMs) return;

    const struggling = this.#slowMs / this.#activeMs > 0.5;

    this.#activeMs = 0;
    this.#slowMs = 0;

    if (!struggling || this.#level >= qualityLevels.length - 1) return;

    this.#level += 1;
    this.reset();
    this.#onChange(this.level);
  }
}
