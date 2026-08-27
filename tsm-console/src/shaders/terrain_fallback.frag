#extension GL_OES_standard_derivatives : enable
precision highp float;

// PTDT v35 — WebGL fallback fragment (no normal buffer)
// BFE reference plane = 375.0 ft NAVD88 (presentation only)

uniform vec3 uColor;
uniform float uTime;
uniform float uBfeFt;

varying vec3 vViewPosition;
varying float vElevation;

void main() {
  vec3 fdx = dFdx(vViewPosition);
  vec3 fdy = dFdy(vViewPosition);
  vec3 normal = normalize(cross(fdx, fdy));

  vec3 lightDir = normalize(vec3(0.5, 0.8, 0.3));
  float diffuse = max(dot(normal, lightDir), 0.0);

  vec3 baseColor = uColor;
  // Wet tint below BFE plane (units must match attribute convention)
  if (vElevation < uBfeFt) {
    baseColor = mix(vec3(0.1, 0.4, 0.8), baseColor, 0.5);
  }

  vec3 litColor = baseColor * (0.3 + 0.7 * diffuse);
  // ACES-ish compress
  litColor = litColor / (litColor + vec3(1.0));
  gl_FragColor = vec4(pow(litColor, vec3(1.0 / 2.2)), 1.0);
}
