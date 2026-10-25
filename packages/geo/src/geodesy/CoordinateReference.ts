import type { HorizontalDatum } from "./HorizontalDatum.js";
import type { VerticalDatum } from "./VerticalDatum.js";

export interface CoordinateReference {
  /** EPSG identifier for the horizontal CRS; it must be present in the maintained registry. */
  epsg: number;
  horizontalDatum: HorizontalDatum | null;
  verticalDatum: VerticalDatum | null;
  geoidModel?: string;
  /** Coordinate epoch, as a decimal year, where the reference frame/operation requires it. */
  epoch?: string;
  transformationOperationId?: string;
  transformationSourceUrl?: string;
}
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
