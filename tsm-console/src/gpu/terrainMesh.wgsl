/**
 * PTDT v35 - WebGPU Terrain Rendering Pipeline
 * Directional lighting + BFE-relative albedo. Presentation only.
 */

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(1) world_position: vec3<f32>,
};

struct Uniforms {
    modelViewProj: mat4x4<f32>,
    lightDirection: vec3<f32>,
    bfeLevelFt: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.clip_position = uniforms.modelViewProj * vec4<f32>(input.position, 1.0);
    output.normal = input.normal;
    output.world_position = input.position;
    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let lightDir = normalize(uniforms.lightDirection);
    let normal = normalize(input.normal);
    let ndotl = max(dot(normal, lightDir), 0.0);

    var albedo = vec3<f32>(0.12, 0.22, 0.10);
    // Near BFE/LAG transition (~0.67 m Twin Z for +2.2 ft)
    if (input.world_position.y < 0.67) {
        albedo = vec3<f32>(0.28, 0.24, 0.18);
    }

    let ambient = 0.25;
    let finalColor = albedo * (ambient + ndotl * 0.75);
    var mapped = finalColor * 1.15;
    mapped = mapped / (mapped + vec3<f32>(1.0));
    let displayColor = pow(mapped, vec3<f32>(1.0 / 2.2));
    return vec4<f32>(displayColor, 1.0);
}
