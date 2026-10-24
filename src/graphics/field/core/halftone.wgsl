import { FieldUniforms, cellOfPx, centerOfCell, rippleAt, sceneAt, sceneBlend, sceneSize, swellAt, worldOfPx } from "./field.wgsl";

@group(0) @binding(0) var<uniform> u: FieldUniforms;
@group(0) @binding(1) var sceneA: texture_2d<f32>;
@group(0) @binding(2) var sceneB: texture_2d<f32>;
@group(0) @binding(3) var sceneSampler: sampler;
// Per pane row: open cols, row shows a layer (1) or the veil (0), front crest, band crest.
@group(0) @binding(4) var<storage, read> reveal: array<vec4f>;

struct DotOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
  @location(1) local: vec2f,
  @location(2) radius: f32,
}

// Coverage follows the spacing, keeping the dense background quiet.
const SPECK_RATIO: f32 = 0.065;

const SPECK_RGB: vec3f = vec3f(0.115, 0.115, 0.115);

const CREST_LEVEL: f32 = 0.8;

fn hidden() -> DotOut {
  var out: DotOut;
  out.position = vec4f(2.0, 2.0, 0.5, 1.0);
  out.color = vec3f(0.0);
  out.local = vec2f(0.0);
  out.radius = 0.0;
  return out;
}

@vertex
fn vs_main(@builtin(vertex_index) vertex: u32, @builtin(instance_index) index: u32) -> DotOut {
  let cols = max(u32(u.grid.x), 1u);
  let cell = vec2f(f32(index % cols), f32(index / cols));
  let size = u.canvas.xy;
  let center = centerOfCell(u, cell);
  let world = worldOfPx(u, center);
  let mobile = u.camera.x >= 0.0;
  let inPane = select((cell.x < u.grid.w), (world.x >= u.camera.z && world.x < u.camera.z + u.camera.w), mobile);
  let stepX = select(u.pane.w, u.pane.z, inPane && !mobile);
  let spacing = min(stepX, size.y / u.grid.y);

  // Cells of the pane column that currently show a pane draw nothing; the DOM shows through.
  let layoutCell = floor(select(center, world - vec2f(u.camera.z, 0.0), mobile) / u.pane.x);
  let row = reveal[min(u32(layoutCell.y), arrayLength(&reveal) - 1u)];

  if (inPane && layoutCell.x < row.x && row.y > 0.5) {
    return hidden();
  }

  let uv = world / size;
  let swell = 0.5 + 0.5 * swellAt(uv, size.x / max(size.y, 1.0), u.canvas.w * 0.5);

  let blend = sceneBlend(u, select(cell, cellOfPx(u, world), mobile));
  let scene = sceneAt(sceneA, sceneB, sceneSampler, world / sceneSize(u), blend.x);
  let calm = 1.0 - scene.a * 0.85;
  var level = pow(swell, 1.6) * u.breath.x * calm * 0.8;
  level = max(level, scene.b);

  let reach = max(1.0 - distance(world, u.pointer.xy) / max(u.pointer.w, 0.001), 0.0);
  level += u.pointer.z * reach * reach * 0.55;
  level += rippleAt(u.ripple0, world, u.grid.z) + rippleAt(u.ripple1, world, u.grid.z)
    + rippleAt(u.ripple2, world, u.grid.z) + rippleAt(u.ripple3, world, u.grid.z);

  var crest = blend.y;

  if (inPane) {
    let front = select(0.0, row.z, layoutCell.x == row.x) + select(0.0, row.z * 0.55, layoutCell.x == row.x + 1.0);
    crest = max(crest, max(front, row.w));
  }

  level = clamp(max(level, crest), 0.0, 1.0);

  let dpr = max(u.canvas.z, 0.001);
  let full = spacing * 0.36;
  let radius = floor(mix(spacing * SPECK_RATIO, full, level) * dpr * 2.0 + 0.5) / (dpr * 2.0);
  let body = mix(SPECK_RGB, u.base.rgb, smoothstep(0.05, 0.45, level));

  // The mask travels with each texel, including scenes frozen during an interrupted wipe.
  // A white dot's area, rather than its radius or a color threshold, follows photo luminance.
  let photo = clamp(scene.g, 0.0, 1.0);
  let photoLevel = clamp(scene.b / max(photo, 0.001), 0.0, 1.0);
  let photoRadius = full * sqrt(clamp(max(photoLevel, crest), 0.0, 1.0));

  var out: DotOut;
  let crestRgb = mix(u.crest.rgb, u.accent.rgb, step(0.5, scene.r));
  out.color = mix(select(body, crestRgb, level >= CREST_LEVEL), vec3f(1.0), photo);
  out.radius = mix(radius, photoRadius, photo);

  var corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0),
    vec2f(-1.0, -1.0), vec2f(1.0, 1.0), vec2f(-1.0, 1.0)
  );
  let extent = out.radius + 1.0 / dpr;
  let corner = corners[vertex % 6u];
  let px = center + corner * extent;
  out.local = corner * extent;
  out.position = vec4f(px.x / size.x * 2.0 - 1.0, 1.0 - px.y / size.y * 2.0, 0.5, 1.0);
  return out;
}

@fragment
fn fs_main(input: DotOut) -> @location(0) vec4f {
  let aa = 1.0 / max(u.canvas.z, 0.001);
  let a = select(0.0, clamp((input.radius - length(input.local)) / aa + 0.5, 0.0, 1.0), input.radius > 0.0);
  return vec4f(input.color * a, a);
}
