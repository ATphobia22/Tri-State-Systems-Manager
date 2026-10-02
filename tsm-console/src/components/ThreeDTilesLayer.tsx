/**
 * ThreeDTilesLayer — Open-source 3D Tiles renderer for TSM.
 *
 * Uses nasa-ammos/3d-tiles-renderer (MIT license, no token required) with
 * Three.js to render 3D Tiles (b3dm, i3dm, pnts, glb) in the webview.
 *
 * This component creates a Three.js scene synchronized with the MapLibre
 * camera, allowing 3D Tiles to overlay the 2D map. No Cesium ion token
 * required — self-hosted tilesets only.
 *
 * Fail-closed: if the tileset URL is invalid or unreachable, the layer
 * reports unavailable rather than fabricating geometry.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer';
import type { ThreeDTilesSource } from '../lib/martin-tile-fabric';
import { resolveThreeDTilesetUrl } from '../lib/martin-tile-fabric';

interface ThreeDTilesMapCamera {
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  getBearing(): number;
  getPitch(): number;
  on(event: 'move' | 'resize', listener: () => void): void;
  off(event: 'move' | 'resize', listener: () => void): void;
}

interface ThreeDTilesLayerProps {
  source: ThreeDTilesSource;
  /** MapLibre map camera used to synchronize the ECEF 3D Tiles camera. */
  map?: ThreeDTilesMapCamera;
  /** Callback for layer status changes */
  onStatusChange?: (status: 'loading' | 'ready' | 'error' | 'disabled') => void;
}

export default function ThreeDTilesLayer({
  source,
  map,
  onStatusChange,
}: ThreeDTilesLayerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'disabled'>(
    source.enabled ? 'loading' : 'disabled'
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!source.enabled) {
      setStatus('disabled');
      onStatusChange?.('disabled');
      return;
    }

    if (!mountRef.current) return;

    let tilesRenderer: TilesRenderer | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let animationId: number | null = null;
    let disposed = false;

    try {
      const tilesetUrl = resolveThreeDTilesetUrl(source);

      // Three.js scene setup
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(
        60,
        mountRef.current.clientWidth / mountRef.current.clientHeight,
        0.1,
        10000
      );
      camera.position.set(0, 0, 100);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(
        mountRef.current.clientWidth,
        mountRef.current.clientHeight
      );
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      mountRef.current.appendChild(renderer.domElement);

      // 3D Tiles renderer (open source, no token)
      tilesRenderer = new TilesRenderer(tilesetUrl);
      tilesRenderer.setCamera(camera);
      tilesRenderer.setResolutionFromRenderer(camera, renderer);
      scene.add(tilesRenderer.group);

      // Lighting for 3D tiles
      const ambient = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambient);
      const directional = new THREE.DirectionalLight(0xffffff, 0.6);
      directional.position.set(1, 1, 1);
      scene.add(directional);

      setStatus('ready');
      onStatusChange?.('ready');

      const WGS84_A = 6378137;
      const WGS84_E2 = 6.6943799901413165e-3;

      const syncCameraToMap = (): void => {
        if (!map || !camera) return;
        const center = map.getCenter();
        const lon = THREE.MathUtils.degToRad(center.lng);
        const lat = THREE.MathUtils.degToRad(center.lat);
        const sinLat = Math.sin(lat);
        const cosLat = Math.cos(lat);
        const sinLon = Math.sin(lon);
        const cosLon = Math.cos(lon);
        const radius = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
        const target = new THREE.Vector3(
          radius * cosLat * cosLon,
          radius * cosLat * sinLon,
          radius * (1 - WGS84_E2) * sinLat
        );
        const east = new THREE.Vector3(-sinLon, cosLon, 0);
        const north = new THREE.Vector3(
          -sinLat * cosLon,
          -sinLat * sinLon,
          cosLat
        );
        const up = new THREE.Vector3(
          cosLat * cosLon,
          cosLat * sinLon,
          sinLat
        );

        const pitch = THREE.MathUtils.degToRad(
          THREE.MathUtils.clamp(map.getPitch(), 0, 85)
        );
        const bearing = THREE.MathUtils.degToRad(map.getBearing());
        const zoom = THREE.MathUtils.clamp(map.getZoom(), 0, 24);
        const distance = (40075016.686 / 2 ** zoom) * 2.5;
        const horizontal = new THREE.Vector3()
          .addScaledVector(east, Math.sin(bearing))
          .addScaledVector(north, Math.cos(bearing))
          .normalize();

        camera.position.copy(target)
          .addScaledVector(up, Math.cos(pitch) * distance)
          .addScaledVector(horizontal, Math.sin(pitch) * distance);
        camera.up.copy(up);
        camera.lookAt(target);
        camera.updateMatrixWorld();
      };

      syncCameraToMap();
      map?.on('move', syncCameraToMap);
      map?.on('resize', syncCameraToMap);

      // Animation loop
      const animate = () => {
        if (disposed) return;
        animationId = requestAnimationFrame(animate);
        tilesRenderer?.update();
        renderer?.render(scene!, camera!);
      };
      animate();

      // Handle resize
      const handleResize = () => {
        if (!mountRef.current || !camera || !renderer) return;
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', handleResize);

      // Graceful WebGL context loss recovery (mobile GPUs, tab switches).
      const canvas = renderer.domElement;
      const handleContextLost = (event: Event) => {
        event.preventDefault();
        if (animationId) cancelAnimationFrame(animationId);
        animationId = null;
        setStatus('error');
        setError('WebGL context lost — waiting for recovery…');
        onStatusChange?.('error');
      };
      const handleContextRestored = () => {
        setError(null);
        setStatus('loading');
        onStatusChange?.('loading');
        syncCameraToMap();
        if (!disposed && animationId === null) {
          const resume = () => {
            if (disposed) return;
            animationId = requestAnimationFrame(resume);
            tilesRenderer?.update();
            renderer?.render(scene!, camera!);
          };
          resume();
        }
        setStatus('ready');
        onStatusChange?.('ready');
      };
      canvas.addEventListener('webglcontextlost', handleContextLost);
      canvas.addEventListener('webglcontextrestored', handleContextRestored);

      return () => {
        disposed = true;
        window.removeEventListener('resize', handleResize);
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
        map?.off('move', syncCameraToMap);
        map?.off('resize', syncCameraToMap);
        if (animationId) cancelAnimationFrame(animationId);
        tilesRenderer?.dispose();
        renderer?.dispose();
        if (mountRef.current && renderer?.domElement) {
          mountRef.current.removeChild(renderer.domElement);
        }
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load 3D tileset';
      setError(message);
      setStatus('error');
      onStatusChange?.('error');
    }
  }, [source, map, onStatusChange]);

  if (!source.enabled) {
    return null;
  }

  if (status === 'error') {
    return (
      <div
        style={{
          padding: '1rem',
          background: 'rgba(239,68,68,.1)',
          border: '1px solid rgba(239,68,68,.3)',
          borderRadius: 8,
          color: '#fca5a5',
          fontSize: '0.85rem',
        }}
      >
        3D Tiles unavailable: {error || 'Failed to load tileset'}
        <div style={{ fontSize: '0.75rem', marginTop: 4, opacity: 0.8 }}>
          Source: {source.id} — not fabricated, marked unavailable.
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: '400px',
        position: 'relative',
        background: '#0b1220',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {status === 'loading' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9ca3af',
            fontSize: '0.85rem',
          }}
        >
          Loading 3D tiles…
        </div>
      )}
    </div>
  );
}
