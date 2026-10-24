// The fixed drawing grid and the CSS layout grid have independent coordinates.

export struct FieldUniforms {
  // cssWidth, cssHeight, dpr, time
  canvas: vec4f,
  // drawing cols, drawing rows, interaction scale, drawing pane cols
  grid: vec4f,
  // layout unit px, pane width px, pane drawing step px, free drawing step px
  pane: vec4f,
  // x, y (css px), strength, radius
  pointer: vec4f,
  base: vec4f,
  crest: vec4f,
  // crest color of a drawing's accent mask (scene.r)
  accent: vec4f,
  // x, y (css px), age seconds, strength
  ripple0: vec4f,
  ripple1: vec4f,
  ripple2: vec4f,
  ripple3: vec4f,
  // eased scene progress, front width in drawing cells, pane fraction (>=0 = close R→L), seed
  scene: vec4f,
  // swell amplitude, unused, unused, unused
  breath: vec4f,
  // viewport offset (-1 on desktop), virtual world width, pane left, pane width
  camera: vec4f,
}

export fn sceneSize(u: FieldUniforms) -> vec2f {
  return vec2f(select(u.canvas.x, u.camera.y, u.camera.x >= 0.0), u.canvas.y);
}

export fn worldOfPx(u: FieldUniforms, px: vec2f) -> vec2f {
  return px + vec2f(max(u.camera.x, 0.0), 0.0);
}

fn hash21(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

export fn noise2(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let s = f * f * (3.0 - 2.0 * f);
  let a = hash21(i);
  let b = hash21(i + vec2f(1.0, 0.0));
  let c = hash21(i + vec2f(0.0, 1.0));
  let d = hash21(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}

fn wave(p: vec2f, dir: vec2f, freq: f32, speed: f32, time: f32) -> f32 {
  return sin(dot(p, normalize(dir)) * freq + time * speed);
}

// Height of the swell in [-1, 1]: long directional waves plus a slow noise so it never tiles.
export fn swellAt(uv: vec2f, aspect: f32, time: f32) -> f32 {
  let p = vec2f(uv.x * aspect, uv.y) * 6.0;
  let w0 = wave(p, vec2f(1.0, 0.35), 1.15, 0.9, time);
  let w1 = wave(p, vec2f(-0.4, 1.0), 1.9, 1.25, time);
  let w2 = wave(p, vec2f(0.8, -0.6), 3.1, 1.7, time);
  let w3 = wave(p, vec2f(0.15, 1.0), 5.3, 2.3, time);
  let n = noise2(p * 1.6 + vec2f(time * 0.12, -time * 0.08)) - 0.5;
  return clamp(w0 * 0.42 + w1 * 0.27 + w2 * 0.16 + w3 * 0.08 + n * 0.24, -1.0, 1.0);
}

// Ring left by a click, as extra dot size.
export fn rippleAt(r: vec4f, px: vec2f, scale: f32) -> f32 {
  if (r.w <= 0.0) {
    return 0.0;
  }

  let e = distance(px, r.xy) - r.z * 420.0 * scale;
  let width = max(26.0 * scale, 0.001);
  return exp(-(e * e) / (2.0 * width * width)) * r.w;
}

// Column where the scene front stands on `row`.
// Open morph: left → right across the pane then the field.
// Close-from (`scene.z >= 0`): starts at that fraction of the pane and runs right → left.
fn sceneFront(u: FieldUniforms, row: f32) -> f32 {
  let seed = u.scene.w;
  let time = u.canvas.w;
  let n = noise2(vec2f(row * 0.19 + seed, time * 0.3 + seed * 0.37)) - 0.5;
  let jag = n * 1.6 + sin(row * 0.33 + time * 0.9 + seed) * 0.6;

  if (u.scene.z >= 0.0) {
    let width = max(u.scene.y, 1.0);

    return mix(u.scene.z * u.grid.w, -4.0, u.scene.x) + jag * width;
  }

  let width = max(u.scene.y, 1.0);
  let cols = u.grid.x;
  let left = clamp(u.grid.w, 0.0, cols);
  let start = -width * 2.0;
  let end = cols + width * 2.0;
  let knee = 0.25 * left / max(cols, 1.0);
  let p = u.scene.x;
  let early = mix(start, left, p / max(knee, 0.0001));
  let late = mix(left, end, (p - knee) / max(1.0 - knee, 0.0001));
  let travel = select(late, early, p < knee);

  return travel + jag * width;
}

// Returns (1 when the cell already shows the incoming scene, crest of the passing front).
export fn sceneBlend(u: FieldUniforms, cell: vec2f) -> vec2f {
  let front = floor(sceneFront(u, cell.y));
  let closing = u.scene.z >= 0.0;
  let incoming = select(
    select(0.0, 1.0, cell.x < front),
    select(0.0, 1.0, cell.x >= front),
    closing,
  );
  let moving = step(0.0001, u.scene.x) * step(u.scene.x, 0.9999);
  let lead = select(0.0, 1.0, cell.x == front) + select(0.0, 0.55, cell.x == front - 1.0);

  return vec2f(incoming, lead * moving);
}

export fn sceneAt(a: texture_2d<f32>, b: texture_2d<f32>, linear: sampler, uv: vec2f, weight: f32) -> vec4f {
  let outgoing = textureSampleLevel(a, linear, uv, 0.0);
  let incoming = textureSampleLevel(b, linear, uv, 0.0);
  return mix(outgoing, incoming, weight);
}

export fn cellOfPx(u: FieldUniforms, px: vec2f) -> vec2f {
  if (u.camera.x >= 0.0) {
    return floor(px / sceneSize(u) * u.grid.xy);
  }
  var col = u.grid.w + (px.x - u.pane.y) / max(u.pane.w, 0.001);
  if (px.x < u.pane.y && u.grid.w > 0.0) {
    col = px.x / max(u.pane.z, 0.001);
  }
  return floor(vec2f(col, px.y * u.grid.y / max(u.canvas.y, 0.001)));
}

export fn centerOfCell(u: FieldUniforms, cell: vec2f) -> vec2f {
  if (u.camera.x >= 0.0) {
    let step = u.canvas.x / u.grid.x;
    let x = (cell.x + 0.5) * step - (u.camera.x % step);
    return vec2f(select(x, x + u.canvas.x, x < 0.0), (cell.y + 0.5) * u.canvas.y / u.grid.y);
  }
  var x = u.pane.y + (cell.x - u.grid.w + 0.5) * u.pane.w;
  if (cell.x < u.grid.w) {
    x = (cell.x + 0.5) * u.pane.z;
  }
  return vec2f(x, (cell.y + 0.5) * u.canvas.y / u.grid.y);
}
