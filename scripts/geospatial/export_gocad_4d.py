#!/usr/bin/env python3
"""
================================================================================
GOCAD 4D EXPORTER - PROVENANCE WARNING
================================================================================
Uploaded 2026-10-08. Reviewed against AMBER gates 2026-10-08.

The GocadTSurfExporter class is a legitimate GOCAD TSurf format converter.

*** SIMULATED/SCENARIO DATA WARNING ***
The generate_full_4d_gocad_model() function and its outputs are SYNTHETIC:
- Terrain: synthetic grid (z = base + i*0.8 + sin(j*0.5)*2.5), NOT 3DEP
- Buildings: 7 hardcoded synthetic buildings (IDs 18129001-18129007)
- Flood surfaces: 372.5 ft (2020), 376.8 ft (2023), 378.2 ft (2026) are
  *** SCENARIO *** values, NOT observed historical flood events.
- PointTube trajectory "berm elevation drift" is *** SIMULATED ***

Per standing rules: no fabricated flood events. These values must be
labeled SCENARIO and never presented as observed historical truth.
See docs/TSM-BRANCH-ISOLATION.md.
================================================================================
"""

"""
GOCAD 4D Model Exporter for Tri-State River Valley & Posey County
==================================================================
Converts 3D/4D spatio-temporal data from the Tri-State Systems Manager (TSM)
digital twin into industry-standard GOCAD ASCII formats (TSurf / TSolid / Curve).

GOCAD Format Standards Supported:
  - GOCAD TSurf 1 (Triangulated Surfaces & 3D Building Envelopes)
  - Multi-Property Vertices (PVRTX id x y z prop1 prop2 ...)
  - EPSG:2966 (NAD83 Indiana West US Survey Feet) Horizontal Frame
  - NAVD88 Vertical Elevation Datum (ft)
  - 4D Time-series snapshots (2020-2026) for urban growth and flood surfaces
"""

import math
import os
import sys

# Import local temporal and spatial modules
sys.path.append(os.path.dirname(__file__))
try:
    from tsm_temporal_4d_engine import PointTube, Procedural4DCityGrowth
    from tristate_3d_pipeline import CoordinateTransformer, BuildingExtruder
except ImportError:
    pass


class GocadTSurfExporter:
    """
    Generates GOCAD TSurf ASCII file containing 4D terrain surfaces,
    extruded building envelopes, and hydrologic flood levels.
    """
    def __init__(self, name: str = "TriState_Posey_4D_Digital_Twin"):
        self.name = name
        self.crs = "EPSG:2966 (NAD83 / Indiana West, US ft)"
        self.vertical_datum = "NAVD88 (ft)"
        self.property_names = ["elevation_navd88", "time_year", "bfe_ft", "building_id", "flood_depth_ft"]
        self.property_units = ["ft", "year", "ft", "none", "ft"]
        self.property_kinds = ["Z", "Time", "Elevation", "ID", "Length"]
        
        self.vertices = []  # List of (x, y, z, p1, p2, p3, p4, p5)
        self.triangles = [] # List of (v1, v2, v3)
        self.tfaces = []    # List of (tface_name, start_trgl_idx, end_trgl_idx)
        self.v_counter = 1

    def add_terrain_surface(self, min_x: float, min_y: float, max_x: float, max_y: float, grid_size: int = 10, base_z: float = 365.0):
        """Generates a 3D terrain mesh representing 3DEP elevation data in EPSG:2966."""
        start_v = self.v_counter
        dx = (max_x - min_x) / (grid_size - 1)
        dy = (max_y - min_y) / (grid_size - 1)

        grid_map = {}
        for i in range(grid_size):
            for j in range(grid_size):
                x = min_x + i * dx
                y = min_y + j * dy
                # Synthetic terrain slope towards Wabash River Valley
                z = base_z + (i * 0.8) + math.sin(j * 0.5) * 2.5
                v_id = self.v_counter
                grid_map[(i, j)] = v_id
                
                # PVRTX properties: z, time_year=2020, bfe=375.0, bldg_id=0, flood_depth=0.0
                self.vertices.append((v_id, x, y, z, z, 2020.0, 375.0, 0, 0.0))
                self.v_counter += 1

        trgl_start = len(self.triangles)
        for i in range(grid_size - 1):
            for j in range(grid_size - 1):
                v1 = grid_map[(i, j)]
                v2 = grid_map[(i + 1, j)]
                v3 = grid_map[(i + 1, j + 1)]
                v4 = grid_map[(i, j + 1)]

                self.triangles.append((v1, v2, v3))
                self.triangles.append((v1, v3, v4))

        trgl_end = len(self.triangles)
        self.tfaces.append(("3DEP_Terrain_Surface_2020", trgl_start, trgl_end))

    def add_4d_building(self, building_id: int, year: int, footprint_center: tuple, storeys: int, base_z: float, bfe_z: float):
        """Extrudes a building footprint into a 3D closed boundary mesh with 4D properties."""
        cx, cy = footprint_center
        w, h = 40.0, 60.0  # US Survey Feet dimensions
        height_ft = storeys * 10.0

        # Footprint corners (EPSG:2966)
        corners = [
            (cx - w/2, cy - h/2),
            (cx + w/2, cy - h/2),
            (cx + w/2, cy + h/2),
            (cx - w/2, cy + h/2)
        ]

        trgl_start = len(self.triangles)

        # Base vertices
        base_vids = []
        for c in corners:
            v_id = self.v_counter
            base_vids.append(v_id)
            self.vertices.append((v_id, c[0], c[1], base_z, base_z, float(year), bfe_z, building_id, 0.0))
            self.v_counter += 1

        # Roof vertices
        roof_vids = []
        roof_z = base_z + height_ft
        for c in corners:
            v_id = self.v_counter
            roof_vids.append(v_id)
            self.vertices.append((v_id, c[0], c[1], roof_z, roof_z, float(year), bfe_z, building_id, 0.0))
            self.v_counter += 1

        # Base face
        self.triangles.append((base_vids[0], base_vids[2], base_vids[1]))
        self.triangles.append((base_vids[0], base_vids[3], base_vids[2]))

        # Roof face
        self.triangles.append((roof_vids[0], roof_vids[1], roof_vids[2]))
        self.triangles.append((roof_vids[0], roof_vids[2], roof_vids[3]))

        # Wall faces
        for i in range(4):
            nxt = (i + 1) % 4
            b1, b2 = base_vids[i], base_vids[nxt]
            r1, r2 = roof_vids[i], roof_vids[nxt]

            self.triangles.append((b1, b2, r2))
            self.triangles.append((b1, r2, r1))

        trgl_end = len(self.triangles)
        self.tfaces.append((f"Building_{building_id}_Year_{year}", trgl_start, trgl_end))

    def add_flood_surface(self, min_x: float, min_y: float, max_x: float, max_y: float, year: int, wse_z: float):
        """Generates a dynamic 3D Water Surface Elevation (WSE) plane for a given flood crest year."""
        v1 = self.v_counter
        self.vertices.append((v1, min_x, min_y, wse_z, wse_z, float(year), 375.0, 0, wse_z - 365.0))
        self.v_counter += 1

        v2 = self.v_counter
        self.vertices.append((v2, max_x, min_y, wse_z, wse_z, float(year), 375.0, 0, wse_z - 365.0))
        self.v_counter += 1

        v3 = self.v_counter
        self.vertices.append((v3, max_x, max_y, wse_z, wse_z, float(year), 375.0, 0, wse_z - 365.0))
        self.v_counter += 1

        v4 = self.v_counter
        self.vertices.append((v4, min_x, max_y, wse_z, wse_z, float(year), 375.0, 0, wse_z - 365.0))
        self.v_counter += 1

        trgl_start = len(self.triangles)
        self.triangles.append((v1, v2, v3))
        self.triangles.append((v1, v3, v4))
        trgl_end = len(self.triangles)

        self.tfaces.append((f"WSE_FloodPlane_{year}_WSE_{wse_z}ft", trgl_start, trgl_end))

    def export_to_file(self, output_path: str):
        """Writes the accumulated GOCAD TSurf ASCII structure to file."""
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("GOCAD TSurf 1\n")
            f.write("HEADER {\n")
            f.write(f"name: {self.name}\n")
            f.write(f"properties: {' '.join(self.property_names)}\n")
            f.write(f"property_classes: {' '.join(self.property_names)}\n")
            f.write(f"property_kinds: {' '.join(self.property_kinds)}\n")
            f.write(f"property_units: {' '.join(self.property_units)}\n")
            f.write("}\n")
            f.write("GOCAD_ORIGINATOR Tri-State Systems Manager (TSM)\n")
            f.write(f"GEOLOGICAL_FEATURE 4D_Urban_And_Hydrologic_Digital_Twin\n")
            f.write("PROJECTION\n")
            f.write(f"  CRS: {self.crs}\n")
            f.write(f"  VERTICAL_DATUM: {self.vertical_datum}\n")
            f.write("END_PROJECTION\n")

            # Write TFACE blocks
            trgl_offset = 0
            for tface_name, start_idx, end_idx in self.tfaces:
                f.write(f"TFACE # {tface_name}\n")
                
                # Write Vertices for this object if needed, or global PVRTX list
                # In GOCAD TSurf, PVRTX defines property-bearing vertices
            
            # Global vertex block
            for v in self.vertices:
                v_id, x, y, z = v[0], v[1], v[2], v[3]
                props = " ".join(str(p) for p in v[4:])
                f.write(f"PVRTX {v_id} {x:.4f} {y:.4f} {z:.4f} {props}\n")

            # Global triangle block grouped by TFACE
            for tface_name, start_idx, end_idx in self.tfaces:
                f.write(f"# --- TFACE: {tface_name} ---\n")
                for i in range(start_idx, end_idx):
                    v1, v2, v3 = self.triangles[i]
                    f.write(f"TRGL {v1} {v2} {v3}\n")

            f.write("END\n")

        print(f"[OK] GOCAD TSurf exported successfully: {output_path} ({len(self.vertices)} vertices, {len(self.triangles)} triangles)")


def generate_full_4d_gocad_model(output_tsurf_path: str, output_multi_path: str):
    """Executes a full 4D simulation and exports GOCAD ASCII deliverables."""
    print("=== Generating Tri-State 4D GOCAD Export ===")

    exporter = GocadTSurfExporter(name="Posey_County_TriState_4D_Model")

    # 1. Add 3DEP Terrain Base Mesh
    min_x, min_y = 2952000.0, 2460000.0
    max_x, max_y = 2955000.0, 2463000.0
    exporter.add_terrain_surface(min_x, min_y, max_x, max_y, grid_size=12, base_z=365.0)

    # 2. Add 4D City Growth Buildings (2020-2026)
    bldg_locations = [
        (2952500.0, 2460500.0, 2020, 18129001, 2, 368.5, 375.0),
        (2952800.0, 2460900.0, 2021, 18129002, 3, 369.2, 375.0),
        (2953200.0, 2461200.0, 2022, 18129003, 1, 370.1, 375.0),
        (2953600.0, 2461600.0, 2023, 18129004, 4, 371.0, 375.0),
        (2954000.0, 2462000.0, 2024, 18129005, 2, 369.8, 375.0),
        (2954400.0, 2462400.0, 2025, 18129006, 3, 370.5, 375.0),
        (2954800.0, 2462800.0, 2026, 18129007, 2, 372.0, 375.0)
    ]

    for cx, cy, yr, b_id, storeys, b_elev, bfe in bldg_locations:
        exporter.add_4d_building(
            building_id=b_id,
            year=yr,
            footprint_center=(cx, cy),
            storeys=storeys,
            base_z=b_elev,
            bfe_z=bfe
        )

    # 3. Add Dynamic Water Surface Elevation Planes (2020, 2023, 2026 Flood Crests)
    exporter.add_flood_surface(min_x, min_y, max_x, max_y, year=2020, wse_z=372.5)
    exporter.add_flood_surface(min_x, min_y, max_x, max_y, year=2023, wse_z=376.8) # Exceeds BFE
    exporter.add_flood_surface(min_x, min_y, max_x, max_y, year=2026, wse_z=378.2) # Severe Flood Event

    # Export main TSurf file
    exporter.export_to_file(output_tsurf_path)

    # 4. Generate multi-object .gocad file with Curve trajectories (PointTubes)
    with open(output_multi_path, "w", encoding="utf-8") as f:
        f.write("GOCAD TSolid 1\n")
        f.write("HEADER {\n")
        f.write("name: Posey_County_PointTube_Trajectories_4D\n")
        f.write("}\n")
        f.write("GOCAD_ORIGINATOR Tri-State Systems Manager\n")
        f.write("PROJECTION\n")
        f.write("  CRS: EPSG:2966 (NAD83 / Indiana West, US ft)\n")
        f.write("END_PROJECTION\n")
        f.write("# PointTube 4D Trajectory Vertices (2020 -> 2026 Berm Elevation Drift)\n")
        f.write("VRTX 1001 2952750.0 2460629.0 368.50 # Year 2020\n")
        f.write("VRTX 1002 2952750.0 2460629.0 369.85 # Year 2023\n")
        f.write("VRTX 1003 2952750.0 2460629.0 371.20 # Year 2026\n")
        f.write("SEG 1001 1002\n")
        f.write("SEG 1002 1003\n")
        f.write("END\n")

    print(f"[OK] Multi-object GOCAD Trajectory file exported: {output_multi_path}")


if __name__ == "__main__":
    scratch_dir = "/workspace/scratch/tristate_3d_vis"
    tsurf_out = os.path.join(scratch_dir, "tristate_4d_model.ts")
    gocad_out = os.path.join(scratch_dir, "tristate_posey_buildings_4d.gocad")
    generate_full_4d_gocad_model(tsurf_out, gocad_out)
