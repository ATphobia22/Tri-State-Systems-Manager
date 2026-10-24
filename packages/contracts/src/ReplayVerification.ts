/** Result of comparing a replay against its original solver run. */
export interface ReplayVerification {
  readonly originalRunId: string;
  readonly replayRunId: string;
  readonly equivalent: boolean;
  readonly toleranceThresholds: {
    readonly maxStageDifferenceFt: number;
    readonly maxFlowDifferenceCfs: number;
  };
  readonly differences: readonly string[];
  readonly timestamp: string;
}
