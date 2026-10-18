/**
 * 16-bit 5D state word: F encodes (B, D, C, T, S)
 * Bits: B[0-3] D[4-6] C[7-9] T[10-12] S[13-15]
 */

export interface LodState {
  B: number;
  D: number;
  C: number;
  T: number;
  S: number;
}

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
