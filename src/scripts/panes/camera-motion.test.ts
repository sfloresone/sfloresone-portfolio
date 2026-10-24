import { equal, ok } from "node:assert/strict";
import { test } from "node:test";
import { cameraDuration, cameraPosition, cameraVelocity, inheritedVelocity, inertiaDistance, openingCameraTarget } from "./camera-motion";

test("opening centers compact panes and leaves light beside larger viewports", () => {
  equal(openingCameraTarget(0, 320, 300, 390), 275);
  equal(openingCameraTarget(0, 300, 280, 320), 280);
  equal(openingCameraTarget(0, 320, 300, 430), 290);
  equal(openingCameraTarget(0, 320, 300, 768), 0);
  equal(openingCameraTarget(300, 320, 300, 430), 300);
});

test("a retargeted camera inherits velocity without reversing or overshooting", () => {
  for (const [from, to] of [[0, 275], [275, 0], [80, 100]]) {
    const duration = cameraDuration(to - from, 300, 20);

    for (const candidate of [-10000, 0, 10000]) {
      const velocity = inheritedVelocity(candidate, to - from, duration, 300, 20);
      let previous = from;

      for (let i = 0; i <= 100; i++) {
        const position = cameraPosition(from, to, velocity, duration, i / 100);

        ok(position >= Math.min(from, to) - 1e-9 && position <= Math.max(from, to) + 1e-9);
        ok((position - previous) * (to - from) >= -1e-9);
        previous = position;
      }

      equal(cameraPosition(from, to, velocity, duration, 1), to);
      equal(cameraVelocity(from, to, velocity, duration, 1), 0);
    }
  }
});

test("camera duration scales with travel and settles an unchanged target immediately", () => {
  equal(cameraDuration(0, 300, 20), 0);
  equal(cameraDuration(1, 300, 20), 0.28);
  ok(cameraDuration(275, 300, 20) > 1);
  ok(cameraDuration(550, 300, 20) > cameraDuration(275, 300, 20));
});

test("free inertia decays to a bounded displacement instead of a pane snap", () => {
  equal(inertiaDistance(1000, 0), 0);
  ok(inertiaDistance(1000, 0.24) > 150);
  ok(inertiaDistance(1000, 0.24) < 160);
  ok(inertiaDistance(1000, 4) < 240);
  equal(inertiaDistance(-1000, 0.24), -inertiaDistance(1000, 0.24));
});
