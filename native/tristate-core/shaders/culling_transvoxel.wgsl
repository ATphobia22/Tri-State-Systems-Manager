struct BoundingSphere {
    center: vec3<f32>,
    radius: f32,
};

struct InstanceData {
    modelMatrix: mat4x4<f32>,
    sphere: BoundingSphere,
};

struct DrawIndexedIndirectCommand {
    indexCount: u32,
    instanceCount: atomic<u32>,
    firstIndex: u32,
    baseVertex: i32,
    firstInstance: u32,
};

@group(0) @binding(0) var<storage, read> instances: array<InstanceData>;
@group(0) @binding(1) var<uniform> frustumPlanes: array<vec4<f32>, 6>;
@group(0) @binding(2) var<storage, read_write> drawCommand: DrawIndexedIndirectCommand;
@group(0) @binding(3) var<storage, read_write> visibleIndices: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= arrayLength(&instances)) {
        return;
    }

    let instance = instances[index];
    var isVisible = true;

    for (var i: i32 = 0; i < 6; i = i + 1) {
        let plane = frustumPlanes[i];
        let dist = dot(plane.xyz, instance.sphere.center) + plane.w;
        if (dist < -instance.sphere.radius) {
            isVisible = false;
            break;
        }
    }

    if (isVisible) {
        let slot = atomicAdd(&drawCommand.instanceCount, 1u);
        visibleIndices[slot] = index;
    }
}
