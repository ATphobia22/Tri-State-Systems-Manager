/**
 * TSM State-Word Decoder for WebGIS Renderers
 *
 * Bridges the 16-bit state-word codec (state-word-codec.ts) into
 * MapLibre GL and Three.js rendering pipelines.
 *
 * The state word encodes 5 dimensions of system state:
 *   B[15:14] - Base data quality (0-3)
 *   D[13:12] - Datum confidence (0-3)
 *   C[11:9]  - Coverage completeness (0-3)
 *   T[8:6]   - Temporal freshness (0-3)
 *   S[5:3]   - Source authority (0-3)
 *   R[2:0]   - Runtime extension (0=normal, 1=exception)
 *
 * This module provides:
 * 1. GLSL decoder for GPU-side state visualization
 * 2. MapLibre expression generators for data-driven styling
 * 3. Three.js uniform helpers for 3D tile coloring
 */

import {
  STATE_WORD_BITS,
  decodeStateWord as baseDecode,
  StateWordValues,
} from './state-word-codec';

// Re-export for convenience
export { baseDecode as decodeStateWord };
export type { StateWordValues };

/**
 * GLSL snippet for decoding state words in shaders.
 * Use in fragment shaders for data-driven tile/feature coloring.
 */
export const STATE_WORD_GLSL_DECODE = `
  // Decode 16-bit TSM state word into its 5 dimensions
  // Input: float word (0-65535)
  // Output: vec5(b, d, c, t, s) each in [0, 3]
  vec3 decodeStateWord(float word) {
    float b = floor(word / 16384.0);                    // B[15:14]
    float d = floor(mod(word, 16384.0) / 4096.0);       // D[13:12]
    float c = floor(mod(word, 4096.0) / 512.0);         // C[11:9]
    float t = floor(mod(word, 512.0) / 64.0);           // T[8:6]
    float s = floor(mod(word, 64.0) / 8.0);             // S[5:3]
    return vec3(b, d, c);
  }

  // Get the worst (minimum) dimension as an overall quality score
  float stateWordQuality(float word) {
    vec3 bdc = decodeStateWord(word);
    float t = floor(mod(word, 512.0) / 64.0);
    float s = floor(mod(word, 64.0) / 8.0);
    return min(min(bdc.x, bdc.y), min(min(bdc.z, t), s)) / 3.0;
  }

  // Color ramp: green (good) -> yellow -> orange -> red (poor)
  vec3 stateWordColor(float word) {
    float q = stateWordQuality(word);
    // 5-stop color ramp
    vec3 c0 = vec3(0.80, 0.20, 0.20);  // red - poor
    vec3 c1 = vec3(0.95, 0.55, 0.15);  // orange
    vec3 c2 = vec3(0.95, 0.85, 0.25);  // yellow
    vec3 c3 = vec3(0.45, 0.75, 0.35);  // light green
    vec3 c4 = vec3(0.20, 0.60, 0.25);  // green - good
    if (q < 0.25) return mix(c0, c1, q / 0.25);
    if (q < 0.50) return mix(c1, c2, (q - 0.25) / 0.25);
    if (q < 0.75) return mix(c2, c3, (q - 0.50) / 0.25);
    return mix(c3, c4, (q - 0.75) / 0.25);
  }
`;

/**
 * Generate a MapLibre GL data-driven style expression for state-word coloring.
 * Use with fill-color, line-color, etc.
 *
 * @param property - The feature property containing the state word
 * @returns MapLibre expression for color based on state quality
 */
export function stateWordColorExpression(property: string = 'stateWord'): any[] {
  // Extract each dimension using MapLibre expressions
  // B = floor(word / 16384), D = floor((word % 16384) / 4096), etc.
  return [
    'let', 'word', ['to-number', ['get', property]],
    [
      'let', 'b', ['floor', ['/', ['var', 'word'], 16384]],
      [
        'let', 'd', ['floor', ['/', ['%', ['var', 'word'], 16384], 4096]],
        [
          'let', 'c', ['floor', ['/', ['%', ['var', 'word'], 4096], 512]],
          [
            'let', 't', ['floor', ['/', ['%', ['var', 'word'], 512], 64]],
            [
              'let', 's', ['floor', ['/', ['%', ['var', 'word'], 64], 8]],
              [
                'let', 'q', ['/', ['min', ['min', ['var', 'b'], ['var', 'd']], ['min', ['min', ['var', 'c'], ['var', 't']], ['var', 's']]], 3],
                [
                  'interpolate', ['linear'], ['var', 'q'],
                  0, '#cc3333',    // poor - red
                  0.33, '#f28c26', // orange
                  0.66, '#f2d93f', // yellow
                  1, '#33994d',    // good - green
                ],
              ],
            ],
          ],
        ],
      ],
    ],
  ];
}

/**
 * Three.js helper: create a uniform object for state-word visualization.
 */
export function createStateWordUniforms() {
  return {
    uStateWordDecode: { value: true },
    uStateWordGLSL: { value: STATE_WORD_GLSL_DECODE },
  };
}

/**
 * Get a human-readable label for a state word.
 */
export function stateWordLabel(word: number): string {
  const v = baseDecode(word);
  const dims: Array<[string, number]> = [
    ['B', v.B], ['D', v.D], ['C', v.C], ['T', v.T], ['S', v.S],
  ];
  const worst = dims.reduce((a, b) => (a[1] <= b[1] ? a : b));
  const labels = ['Critical', 'Poor', 'Fair', 'Good'];
  return `${labels[worst[1]]} (${worst[0]}=${worst[1]})`;
}
