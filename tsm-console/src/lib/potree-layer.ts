/**
 * TSM Potree Point Cloud Layer.
 *
 * Renders USGS 3DEP LiDAR point clouds in the browser via Potree.
 * Potree: https://github.com/potree/potree (WebGL point cloud viewer)
 *
 * Data sources:
 *  - USGS 3DEP EPT: https://s3-us-west-2.amazonaws.com/usgs-lidar-public/
 *  - TSM LiDAR tiles: tsm-console/public/lidar/ (27MB local tiles)
 *
 * Usage:
 *   import { PotreeLayer } from './potree-layer';
 *   const layer = new PotreeLayer(map, { eptUrl: 'https://...' });
 *   await layer.load();
 */

export interface PotreeLayerOptions {
  /** EPT endpoint URL (ept.json) or Potree converted cloud.js path */
  eptUrl: string;
  /** Point size in pixels */
  pointSize?: number;
  /** Point budget (max rendered) */
  pointBudget?: number;
  /** Color scheme: 'elevation' | 'rgb' | 'intensity' | 'classification' */
  colorScheme?: string;
}

// Potree is loaded via script tag (not npm) to avoid bundler issues
// with its large worker files. See index.html for the script include.
declare global {
  interface Window {
    Potree?: any;
  }
}

export class PotreeLayer {
  private viewer: any = null;
  private pointCloud: any = null;
  private options: Required<PotreeLayerOptions>;

  constructor(
    private container: HTMLElement,
    options: PotreeLayerOptions
  ) {
    this.options = {
      pointSize: 1,
      pointBudget: 2_000_000,
      colorScheme: 'elevation',
      ...options,
    };
  }

  async load(): Promise<void> {
    if (!window.Potree) {
      throw new Error(
        'Potree not loaded. Add to index.html: ' +
        '<script src="https://cdn.jsdelivr.net/npm/potree@1.8/build/potree/potree.js"></script>'
      );
    }

    this.viewer = new window.Potree.Viewer(this.container);
    this.viewer.setEDLEnabled(true);
    this.viewer.setFOV(60);
    this.viewer.setPointBudget(this.options.pointBudget);
    this.viewer.setBackground('white'); // TSM light theme

    // Material settings
    this.viewer.setMaterial('ELEVATION');
    this.viewer.setPointSize(this.options.pointSize);

    // Load the point cloud
    const url = this.options.eptUrl;
    if (url.endsWith('ept.json')) {
      this.pointCloud = await window.Potree.loadEPT(url);
    } else {
      this.pointCloud = await window.Potree.loadPointCloud(url);
    }

    this.viewer.scene.addPointCloud(this.pointCloud);

    // Fit to tri-state area
    this.viewer.fitToScreen();

    console.log(`Potree layer loaded: ${url}`);
  }

  setColorScheme(scheme: string): void {
    if (!this.viewer) return;
    const map: Record<string, string> = {
      elevation: 'ELEVATION',
      rgb: 'RGB',
      intensity: 'INTENSITY',
      classification: 'CLASSIFICATION',
    };
    this.viewer.setMaterial(map[scheme] || 'ELEVATION');
  }

  setPointBudget(budget: number): void {
    this.viewer?.setPointBudget(budget);
  }

  destroy(): void {
    this.viewer?.dispose();
    this.viewer = null;
    this.pointCloud = null;
  }
}

/**
 * Draco compression for TSM 3D Tiles.
 *
 * Draco: https://github.com/google/draco
 * Compresses glTF meshes and point clouds 5-10x.
 *
 * TSM has ~39MB of building GLBs. Draco compression via gltf-transform:
 *
 *   npm install -g @gltf-transform/cli
 *   gltf-transform compress input.glb output.glb --draco
 *
 * For batch compression of all TSM building tiles:
 *   find tsm-console/public/3d-tiles -name "*.glb" -exec \
 *     gltf-transform compress {} {}.draco \;
 *
 * The console's 3D Tiles renderer (3d-tiles-renderer) supports
 * Draco-compressed GLBs natively via KHR_draco_mesh_compression.
 */
export const DRACO_COMPRESSION_GUIDE = `
Draco Compression for TSM 3D Tiles
====================================

1. Install: npm install -g @gltf-transform/cli
2. Compress: gltf-transform compress input.glb output.glb --draco
3. Expected: 5-10x size reduction on building meshes
4. The 3d-tiles-renderer in tsm-console handles Draco automatically.

For the 39MB of building GLBs, expect ~4-8MB after compression.
`;
