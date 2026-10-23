// Hierarchical-Z pyramid — presentation-only occlusion assist.
// Level 0 is full-resolution depth; each coarser level stores the maximum depth
// of a 2x2 neighborhood (farther = larger depth under reverse-Z-friendly max).
// Authority: PRESENTATION_ONLY. Does not write evidence or regulatory state.

struct HiZParams {
  src_width: u32,
  src_height: u32,
  dst_width: u32,
  dst_height: u32,
  level: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
}

@group(0) @binding(0) var<uniform> params: HiZParams;
@group(0) @binding(1) var src_depth: texture_2d<f32>;
@group(0) @binding(2) var dst_depth: texture_storage_2d<r32float, write>;

@compute @workgroup_size(8, 8, 1)
fn hiz_downsample(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.dst_width || gid.y >= params.dst_height) {
    return;
  }
  let sx = gid.x * 2u;
  let sy = gid.y * 2u;
  let x1 = min(sx + 1u, params.src_width - 1u);
  let y1 = min(sy + 1u, params.src_height - 1u);

  var d = textureLoad(src_depth, vec2<i32>(i32(sx), i32(sy)), 0).r;
  d = max(d, textureLoad(src_depth, vec2<i32>(i32(x1), i32(sy)), 0).r);
  d = max(d, textureLoad(src_depth, vec2<i32>(i32(sx), i32(y1)), 0).r);
  d = max(d, textureLoad(src_depth, vec2<i32>(i32(x1), i32(y1)), 0).r);

  textureStore(dst_depth, vec2<i32>(i32(gid.x), i32(gid.y)), vec4<f32>(d, 0.0, 0.0, 0.0));
}
