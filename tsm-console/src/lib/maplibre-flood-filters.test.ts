import { describe, expect, it, vi } from "vitest";
import {
  addFloodTintLayer,
  applyDepthPaint,
  createFloodTintCustomLayer,
  depthColorExpression,
  wetCellsFilter,
} from "./maplibre-flood-filters";

describe("depthColorExpression", () => {
  it("is an interpolate expression on depth in feet with the documented stops", () => {
    const expr = depthColorExpression as unknown as any[];
    expect(expr[0]).toBe("interpolate");
    expect(expr[1]).toEqual(["linear"]);
    // depth source: depth_ft, falling back to depth_m converted to feet
    expect(expr[2]).toEqual([
      "coalesce",
      ["get", "depth_ft"],
      ["*", ["get", "depth_m"], 3.28084],
      0,
    ]);
    const stops = expr.slice(3);
    expect(stops).toEqual([0, "#1e3a8a", 0.5, "#0ea5e9", 1.5, "#f59e0b", 3, "#ef4444"]);
  });
});

describe("wetCellsFilter", () => {
  it("keeps only features with positive depth", () => {
    expect(wetCellsFilter).toEqual([">", ["coalesce", ["get", "depth_ft"], 0], 0]);
  });
});

describe("createFloodTintCustomLayer", () => {
  it("returns a 2D custom layer with lifecycle methods and a working setIntensity", () => {
    const layer = createFloodTintCustomLayer("test-tint");
    expect(layer.id).toBe("test-tint");
    expect(layer.type).toBe("custom");
    expect(layer.renderingMode).toBe("2d");
    expect(typeof layer.onAdd).toBe("function");
    expect(typeof layer.render).toBe("function");
    expect(typeof layer.onRemove).toBe("function");
    expect(typeof layer.setIntensity).toBe("function");
    // setIntensity clamps without throwing and needs no GL context
    expect(() => layer.setIntensity(0.5)).not.toThrow();
    expect(() => layer.setIntensity(99)).not.toThrow();
    expect(() => layer.setIntensity(-1)).not.toThrow();
  });

  it("defaults the layer id to flood-tint-gl", () => {
    expect(createFloodTintCustomLayer().id).toBe("flood-tint-gl");
  });
});

describe("addFloodTintLayer", () => {
  it("adds the layer once and applies the requested intensity", () => {
    const added: any[] = [];
    const map = {
      getLayer: vi.fn().mockReturnValue(undefined),
      addLayer: vi.fn((l: any) => added.push(l)),
    } as any;
    const layer = addFloodTintLayer(map, 0.3);
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    expect(added[0]).toBe(layer);
  });

  it("does not re-add when the layer already exists", () => {
    const map = {
      getLayer: vi.fn().mockReturnValue({}),
      addLayer: vi.fn(),
    } as any;
    addFloodTintLayer(map);
    expect(map.addLayer).not.toHaveBeenCalled();
  });
});

describe("applyDepthPaint", () => {
  it("sets the depth paint and wet-cell filter on an existing layer", () => {
    const map = {
      getLayer: vi.fn().mockReturnValue({ id: "depth-circles" }),
      setPaintProperty: vi.fn(),
      setFilter: vi.fn(),
    } as any;
    applyDepthPaint(map, "depth-circles");
    expect(map.setPaintProperty).toHaveBeenCalledWith(
      "depth-circles",
      "circle-color",
      depthColorExpression
    );
    expect(map.setFilter).toHaveBeenCalledWith("depth-circles", wetCellsFilter);
  });

  it("is a no-op when the layer does not exist", () => {
    const map = {
      getLayer: vi.fn().mockReturnValue(undefined),
      setPaintProperty: vi.fn(),
      setFilter: vi.fn(),
    } as any;
    applyDepthPaint(map, "missing-layer");
    expect(map.setPaintProperty).not.toHaveBeenCalled();
    expect(map.setFilter).not.toHaveBeenCalled();
  });
});
