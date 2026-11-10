/** Phase 4 — Release and validation contract. */

export type ReleaseGateStatus = "PASS" | "FAIL" | "BLOCKED" | "NOT_RUN" | "SKIPPED";

export type ReleaseGate = {
  id: string;
  label: string;
  status: ReleaseGateStatus;
  evidence?: string;
};

export function defaultReleaseGates(): ReleaseGate[] {
  return [
    { id: "win64_shipping", label: "Native Win64 Shipping package", status: "NOT_RUN" },
    { id: "offline_startup", label: "Clean offline startup", status: "NOT_RUN" },
    { id: "input_menu_tests", label: "Input and menu interaction tests", status: "NOT_RUN" },
    { id: "data_checksums", label: "Authoritative data checksums", status: "NOT_RUN" },
    { id: "cinema_benchmark", label: "Benchmarked cinematic scenes", status: "NOT_RUN" },
    { id: "signed_binaries", label: "Signed binaries", status: "NOT_RUN" },
    { id: "reproducible_builds", label: "Reproducible builds", status: "NOT_RUN" },
    { id: "public_docs", label: "Public-friendly documentation", status: "PASS", evidence: "README + phase docs" },
  ];
}

export function summarizeReleaseGates(gates: ReleaseGate[]): {
  pass: number;
  fail: number;
  blocked: number;
  notRun: number;
  readyForPublicClaim: boolean;
} {
  const pass = gates.filter((g) => g.status === "PASS").length;
  const fail = gates.filter((g) => g.status === "FAIL").length;
  const blocked = gates.filter((g) => g.status === "BLOCKED").length;
  const notRun = gates.filter((g) => g.status === "NOT_RUN" || g.status === "SKIPPED").length;
  return {
    pass,
    fail,
    blocked,
    notRun,
    readyForPublicClaim: fail === 0 && blocked === 0 && notRun === 0 && pass === gates.length,
  };
}
