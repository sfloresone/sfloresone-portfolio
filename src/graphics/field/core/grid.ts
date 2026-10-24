import type { Vec4 } from "../types";

export interface DrawingGrid {
  readonly cols: number;
  readonly rows: number;
  readonly paneCols: number;
}

/** Density follows the layout, never the frame-health or raster-resolution tier. */
export const drawingGrids: Readonly<Record<"desktop" | "mobile", DrawingGrid>> = {
  desktop: { cols: 152, rows: 104, paneCols: 57 },
  mobile: { cols: 76, rows: 52, paneCols: 29 },
};

interface GridGeometry {
  count: number;
  grid: Vec4;
  layout: Vec4;
}

/** Fixed instance budgets; only their CSS positions change with the viewport or page zoom. */
export function fieldGrid(width: number, height: number, band: number, unit: number, level: DrawingGrid): GridGeometry {
  const bandWidth = Math.min(width, Math.max(0, band));
  const paneCols = bandWidth <= 0 ? 0 : bandWidth >= width ? level.cols : level.paneCols;
  const freeCols = level.cols - paneCols;
  const paneStep = paneCols > 0 ? bandWidth / paneCols : 0;
  const freeStep = freeCols > 0 ? (width - bandWidth) / freeCols : 0;
  const reference = drawingGrids.desktop;
  const referenceCols = paneCols === 0 || freeCols === 0 ? reference.cols : reference.cols - reference.paneCols;
  const referenceWidth = freeCols > 0 ? width - bandWidth : width;
  const effectScale = Math.min(referenceWidth / referenceCols, height / reference.rows) / 20;

  return {
    count: level.cols * level.rows,
    grid: [level.cols, level.rows, effectScale, paneCols],
    layout: [unit, bandWidth, paneStep, freeStep],
  };
}
