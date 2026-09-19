import { describe, expect, it } from "vitest";
import {
  APPLE_MAPS_CONTEXT_POLICY,
  buildAppleMapsPresentationRequest,
  validateAppleMapsContextRequest,
  validateTsmViewportHandoff,
} from "../src/integrations/apple-maps/context";

describe("Apple Maps presentation boundary", () => {
  it("keeps Apple outside TSM authoritative evidence", () => {
    expect(APPLE_MAPS_CONTEXT_POLICY.authoritativeForTsmEvidence).toBe(false);
    expect(APPLE_MAPS_CONTEXT_POLICY.presentationOnly).toBe(true);
    expect(APPLE_MAPS_CONTEXT_POLICY.persistentStorageAllowed).toBe(false);
    expect(APPLE_MAPS_CONTEXT_POLICY.derivativeDatabaseAllowed).toBe(false);
  });

  it("accepts an ephemeral user-initiated Look Around request", () => {
    const request = buildAppleMapsPresentationRequest({
      latitude: 37.997,
      longitude: -87.763,
      surface: "look_around",
      disposition: "ephemeral_user_initiated_lookup",
    });
    expect(request.surface).toBe("look_around");
  });

  it("rejects invalid coordinates", () => {
    expect(() => validateAppleMapsContextRequest({
      latitude: 91,
      longitude: -87,
      surface: "map",
      disposition: "ephemeral_presentation_only",
    })).toThrow();
  });

  it("validates TSM-owned camera handoff state", () => {
    expect(() => validateTsmViewportHandoff({
      latitude: 37.997,
      longitude: -87.763,
      headingDegrees: 45,
      pitchDegrees: 65,
      distanceMeters: 1200,
      source: "tsm",
    })).not.toThrow();
  });

  it("rejects an external provider as the source of TSM camera state", () => {
    expect(() => validateTsmViewportHandoff({
      latitude: 37.997,
      longitude: -87.763,
      headingDegrees: 45,
      pitchDegrees: 65,
      distanceMeters: 1200,
      source: "external",
    } as never)).toThrow();
  });
});
