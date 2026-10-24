import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";
import { drawingGrids, fieldGrid } from "./grid";
import { QualityMonitor, initialQualityIndex, qualityLevels } from "./quality";

test("page zoom preserves desktop and mobile total and unobscured point budgets", () => {
  const layouts = [[1520, 1040, 580], [3060, 2120, 1140], [6120, 4280, 2300]];
  const totals = [15808, 3952];
  const unobscured = [9880, 2444];

  Object.values(drawingGrids).forEach((level, index) => {
    for (const [width, height, band] of layouts) {
      const result = fieldGrid(width, height, band, 20, level);

      equal(result.count, totals[index]);
      equal((result.grid[0] - result.grid[3]) * result.grid[1], unobscured[index]);
      equal(result.layout[0], 20);
      equal(result.layout[2] * result.grid[3], band);
      equal(result.layout[3] * (result.grid[0] - result.grid[3]), width - band);
    }
  });
});

test("an absent or fully covering pane keeps the same budget and valid spacing", () => {
  for (const level of Object.values(drawingGrids)) {
    const open = fieldGrid(600, 800, 0, 20, level);
    const covered = fieldGrid(600, 800, 900, 20, level);

    equal(open.count, covered.count);
    equal(open.grid[3], 0);
    equal(open.layout[3] * open.grid[0], 600);
    equal(covered.grid[3], covered.grid[0]);
    equal(covered.layout[2] * covered.grid[0], 600);
    ok(open.grid[2] > 0 && covered.grid[2] > 0);
  }
});

test("drawing density does not change the cursor and ripple scale", () => {
  const scale = fieldGrid(1520, 1040, 580, 20, drawingGrids.desktop).grid[2];

  for (const level of Object.values(drawingGrids)) equal(fieldGrid(1520, 1040, 580, 20, level).grid[2], scale);
});

test("sustained slow frames lower raster resolution while preserving desktop density", () => {
  const dprCaps: number[] = [];
  const counts: number[] = [];

  const quality = new QualityMonitor((level) => {
    dprCaps.push(level.maxDpr);
    counts.push(fieldGrid(1520, 1040, 580, 20, drawingGrids.desktop).count);
  });

  for (let i = 0; i < 150; i++) quality.sample(1000 / 60);

  quality.sample(400);

  for (let i = 0; i < 10; i++) quality.sample(40);
  deepEqual(counts, []);

  for (let i = 0; i < 250; i++) quality.sample(40);

  deepEqual(dprCaps, [1.5, 1]);
  deepEqual(counts, [15808, 15808]);

  quality.reset();

  for (let i = 0; i < 300; i++) quality.sample(1000 / 120);
  equal(quality.level.maxDpr, 1);
  equal(fieldGrid(1520, 1040, 580, 20, drawingGrids.desktop).count, 15808);
  deepEqual(counts, [15808, 15808]);
});

test("mobile starts on the cheapest quality tier", () => {
  equal(initialQualityIndex(false), 0);
  equal(initialQualityIndex(true), qualityLevels.length - 1);

  const mobile = new QualityMonitor(() => {}, initialQualityIndex(true));

  equal(mobile.levelIndex, 2);
  equal(fieldGrid(370, 804, 0, 20, drawingGrids.mobile).count, 3952);
  equal(mobile.level.maxDpr, 1);
});

test("narrow free-field mobile layout keeps the floor budget and valid spacing", () => {
  const level = drawingGrids.mobile;
  const result = fieldGrid(370, 804, 0, 20, level);

  equal(result.count, 3952);
  equal(result.grid[3], 0);
  equal(result.layout[3] * result.grid[0], 370);
  ok(result.grid[2] > 0);
});

test("a renderer started on mobile restores desktop density even with the lowest raster tier", () => {
  const quality = new QualityMonitor(() => {}, initialQualityIndex(true));

  equal(quality.level.maxDpr, 1);
  equal(fieldGrid(370, 804, 0, 20, drawingGrids.mobile).count, 3952);
  equal(fieldGrid(1520, 1040, 580, 20, drawingGrids.desktop).count, 15808);
});
