import { FieldUniforms, cellOfPx, sceneBlend } from "./field.wgsl";

@group(0) @binding(0) var<uniform> u: FieldUniforms;
@group(0) @binding(1) var sceneA: texture_2d<f32>;
@group(0) @binding(2) var sceneB: texture_2d<f32>;
@group(0) @binding(3) var baked: texture_storage_2d<rgba8unorm, write>;

// Freezes the on-screen mix of both scenes into one texture, so a new scene can take over
// mid-transition without a jump. Texels follow the cell they fall in, like the dots do.
@compute @workgroup_size(8, 8)
fn bake(@builtin(global_invocation_id) id: vec3u) {
  let texels = textureDimensions(baked);

  if (id.x >= texels.x || id.y >= texels.y) {
    return;
  }

  let uv = (vec2f(id.xy) + 0.5) / vec2f(texels);
  let weight = sceneBlend(u, cellOfPx(u, uv * u.canvas.xy)).x;
  let outgoing = textureLoad(sceneA, id.xy, 0);
  let incoming = textureLoad(sceneB, id.xy, 0);
  textureStore(baked, id.xy, mix(outgoing, incoming, weight));
}
