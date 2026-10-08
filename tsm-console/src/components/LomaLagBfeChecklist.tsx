import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface LomaElevationInputs {
  lagFtNavd88: number | null;
  bfeFtNavd88: number | null;
  firmPanel: string;
  fillPlaced: boolean;
  humanReviewed: boolean;
}

export function evaluateLomaStructurePath(input: LomaElevationInputs): {
  eligibleStructurePath: boolean | null;
  freeboardFt: number | null;
  productHint: "LOMA" | "LOMR-F" | "INSUFFICIENT_DATA";
  notes: string[];
} {
  const notes: string[] = [];
  if (input.lagFtNavd88 == null || input.bfeFtNavd88 == null) {
    return {
      eligibleStructurePath: null,
      freeboardFt: null,
      productHint: "INSUFFICIENT_DATA",
      notes: ["LAG and BFE both required (survey/PE)."],
    };
  }
  const freeboardFt = input.lagFtNavd88 - input.bfeFtNavd88;
  const eligibleStructurePath = freeboardFt >= 0;
  if (!eligibleStructurePath) {
    notes.push("LAG below BFE — structure LOMA path fails the basic elevation test.");
  } else {
    notes.push("LAG at or above BFE — structure elevation test passes (subject to FEMA review).");
  }
  if (input.fillPlaced) {
    notes.push("Fill indicated → use LOMR-F path, not pure LOMA.");
  }
  if (!input.humanReviewed) {
    notes.push("Human review required before any submission package.");
  }
  notes.push(`Effective panel context: ${input.firmPanel}`);
  return {
    eligibleStructurePath,
    freeboardFt,
    productHint: input.fillPlaced ? "LOMR-F" : "LOMA",
    notes,
  };
}

const DEFAULTS: LomaElevationInputs = {
  lagFtNavd88: 377.2,
  bfeFtNavd88: 375.0,
  firmPanel: "18129C0300C",
  fillPlaced: false,
  humanReviewed: false,
};

export function LomaLagBfeChecklist(props: Partial<LomaElevationInputs> = {}) {
  const input: LomaElevationInputs = { ...DEFAULTS, ...props };
  const result = evaluateLomaStructurePath(input);

  return (
    <Card>
      <CardHeader>
        <CardTitle>LOMA elevation gate (LAG vs BFE)</CardTitle>
        <CardDescription>
          Structure path requires LAG ≥ BFE on the effective FIRM/FIS. TSM does not auto-file.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <Badge variant="outline">Panel {input.firmPanel}</Badge>
          <Badge variant="secondary">LAG {input.lagFtNavd88 ?? "—"} ft</Badge>
          <Badge variant="secondary">BFE {input.bfeFtNavd88 ?? "—"} ft</Badge>
          <Badge variant={result.eligibleStructurePath ? "success" : "destructive"}>
            Δ {result.freeboardFt == null ? "—" : `${result.freeboardFt.toFixed(2)} ft`}
          </Badge>
          <Badge>{result.productHint}</Badge>
        </div>
        <ul style={{ margin: "0 0 1rem", paddingLeft: "1.25rem" }}>
          {result.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <Button type="button" variant="outline" disabled title="Auto-file forbidden (ADR-006)">
          Submit to FEMA (disabled)
        </Button>
      </CardContent>
    </Card>
  );
}
