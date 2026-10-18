/**
 * 16-bit 5D orthogonal state word (LAYOUT v1 — FROZEN).
 * Contract: contracts/tsm-state-word-v1.json
 * B[0-3] D[4-6] C[7-9] T[10-12] S[13-15]
 * Manager/spatial phase is NOT in this word — see spatial-entity-phase.ts
 */

export const STATE_WORD_LAYOUT_VERSION = 1 as const;

export interface LodState {
  B: number;
  D: number;
  C: number;
  T: number;
  S: number;
}

export const STATE_WORD_DEFAULT: LodState = { B: 3, D: 5, C: 2, T: 3, S: 2 };

export class StateWordDecoder {
  static readonly MASK_B = 0b0000000000001111;
  static readonly MASK_D = 0b0000000001110000;
  static readonly MASK_C = 0b0000001110000000;
  static readonly MASK_T = 0b0001110000000000;
  static readonly MASK_S = 0b1110000000000000;

  static decode(stateWord: number): LodState {
    const w = stateWord & 0xffff;
    return {
      B: w & StateWordDecoder.MASK_B,
      D: (w & StateWordDecoder.MASK_D) >> 4,
      C: (w & StateWordDecoder.MASK_C) >> 7,
      T: (w & StateWordDecoder.MASK_T) >> 10,
      S: (w & StateWordDecoder.MASK_S) >> 13,
    };
  }

  static encode(state: LodState): number {
    return (
      (state.B & 0xf) |
      ((state.D & 0x7) << 4) |
      ((state.C & 0x7) << 7) |
      ((state.T & 0x7) << 10) |
      ((state.S & 0x7) << 13)
    ) & 0xffff;
  }

  static evaluateDegradation(
    currentStateWord: number,
    vramUsageRatio: number,
    bandwidthMbps: number,
  ): number {
    const state = StateWordDecoder.decode(currentStateWord);
    if (vramUsageRatio > 0.85) {
      state.T = Math.min(state.T, 1);
      state.C = 0;
    } else if (bandwidthMbps < 10.0) {
      state.S = Math.min(state.S, 1);
    }
    return StateWordDecoder.encode(state);
  }
}

export const STATE_WORD_PROP = 'tsmStateWord' as const;
export const STATE_WORD_LAYOUT_PROP = 'tsmStateWordLayoutVersion' as const;

export function attachStateWordToFeatureProperties(
  props: Record<string, unknown>,
  state: LodState = STATE_WORD_DEFAULT,
): Record<string, unknown> {
  return {
    ...props,
    [STATE_WORD_PROP]: StateWordDecoder.encode(state),
    [STATE_WORD_LAYOUT_PROP]: STATE_WORD_LAYOUT_VERSION,
    tsmLod: state,
  };
}

export function attachStateWordToTileset(
  tileset: Record<string, unknown>,
  state: LodState = STATE_WORD_DEFAULT,
): Record<string, unknown> {
  const word = StateWordDecoder.encode(state);
  const clone = structuredClone(tileset) as Record<string, unknown>;
  const root = (clone.root ?? {}) as Record<string, unknown>;
  root.extras = {
    ...((root.extras as Record<string, unknown>) ?? {}),
    [STATE_WORD_PROP]: word,
    [STATE_WORD_LAYOUT_PROP]: STATE_WORD_LAYOUT_VERSION,
    tsmLod: state,
  };
  clone.root = root;
  return clone;
}
