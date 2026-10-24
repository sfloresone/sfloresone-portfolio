export function openingCameraTarget(current: number, paneLeft: number, paneWidth: number, viewportWidth: number): number {
  if (viewportWidth < 400) return paneLeft + paneWidth / 2 - viewportWidth / 2;

  return Math.min(paneLeft, Math.max(paneLeft + paneWidth + 100 - viewportWidth, current));
}

export function cameraDuration(distance: number, paneWidth: number, unit: number): number {
  if (Math.abs(distance) < 0.5) return 0;

  const waveSpeed = (paneWidth + unit * 2.3) / 1.3;

  return Math.max(0.28, Math.abs(distance) / (0.84 * waveSpeed));
}

export function inheritedVelocity(velocity: number, distance: number, duration: number, paneWidth: number, unit: number): number {
  if (velocity * distance <= 0 || duration <= 0) return 0;

  const limit = Math.min(3 * Math.abs(distance) / duration, (paneWidth + unit * 2.3) / 1.3 * 1.25);

  return Math.sign(distance) * Math.min(Math.abs(velocity), limit);
}

export function cameraPosition(from: number, to: number, velocity: number, duration: number, progress: number): number {
  const u = Math.max(0, Math.min(1, progress));
  const u2 = u * u;
  const u3 = u2 * u;

  return (2 * u3 - 3 * u2 + 1) * from + (u3 - 2 * u2 + u) * duration * velocity + (-2 * u3 + 3 * u2) * to;
}

export function cameraVelocity(from: number, to: number, velocity: number, duration: number, progress: number): number {
  if (duration <= 0 || progress >= 1) return 0;

  const u = Math.max(0, progress);

  return ((6 * u * u - 6 * u) * from + (3 * u * u - 4 * u + 1) * duration * velocity + (-6 * u * u + 6 * u) * to) / duration;
}

export function inertiaDistance(velocity: number, seconds: number): number {
  return velocity * 0.24 * (1 - Math.exp(-Math.max(0, seconds) / 0.24));
}
