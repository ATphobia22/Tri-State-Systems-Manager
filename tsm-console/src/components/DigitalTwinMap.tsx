import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import * as THREE from 'three';
import 'maplibre-gl/dist/maplibre-gl.css';

const POINT_TOWNSHIP_CENTER: [number, number] = [-87.9312, 37.8825];
const DEFAULT_MAP_STYLE = 'https://demotiles.maplibre.org/style.json';

type ThreeLayer = maplibregl.CustomLayerInterface & {
  camera?: THREE.Camera;
  scene?: THREE.Scene;
  renderer?: THREE.WebGLRenderer;
};

const getMapStyle = (): string => {
  const env = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env ?? {};
  const configured = env.VITE_MAP_STYLE_URL;
  return typeof configured === 'string' && configured.trim() ? configured : DEFAULT_MAP_STYLE;
};

export const DigitalTwinMap: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    const container = mapContainer.current;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      style: getMapStyle(),
      center: POINT_TOWNSHIP_CENTER,
      zoom: 14,
      pitch: 60,
      bearing: -20,
    });

    mapInstance.current = map;

    const customThreeLayer: ThreeLayer = {
      id: 'threejs-digital-twin-layer',
      type: 'custom',
      renderingMode: '3d',

      onAdd(mapInstanceForLayer: maplibregl.Map, gl: WebGL2RenderingContext) {
        this.camera = new THREE.PerspectiveCamera();
        this.scene = new THREE.Scene();

        const geometry = new THREE.BoxGeometry(100, 100, 10);
        const material = new THREE.MeshPhongMaterial({
          color: 0x0077be,
          opacity: 0.8,
          transparent: true,
        });
        this.scene.add(new THREE.Mesh(geometry, material));

        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(0, -70, 100).normalize();
        this.scene.add(light);

        this.renderer = new THREE.WebGLRenderer({
          canvas: mapInstanceForLayer.getCanvas(),
          context: gl,
          antialias: true,
        });
        this.renderer.autoClear = false;
      },

      render(_gl: WebGL2RenderingContext, args: maplibregl.CustomRenderMethodInput) {
        if (!this.renderer || !this.scene || !this.camera) return;
        this.camera.projectionMatrix = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);
        mapInstance.current?.triggerRepaint();
      },

      onRemove() {
        this.scene?.traverse((object: THREE.Object3D) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((item: THREE.Material) => item.dispose());
          else material.dispose();
        });
        this.renderer?.dispose();
        this.renderer = undefined;
        this.scene = undefined;
        this.camera = undefined;
      },
    };

    map.once('load', () => {
      if (!map.getLayer(customThreeLayer.id)) map.addLayer(customThreeLayer);
    });

    return () => {
      mapInstance.current = null;
      map.remove();
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '600px' }}>
      <div
        role="note"
        aria-label="Decision support display disclaimer"
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 10,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          color: '#ffffff',
          padding: '10px 14px',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: 'monospace',
          maxWidth: '420px',
          borderLeft: '4px solid #f39c12',
        }}
      >
        <strong>TSM DECISION-SUPPORT DISPLAY ONLY</strong>
        <br />
        Visualization is presentation only and does not constitute sealed
        evidence, a survey, or an official FEMA/agency determination.
      </div>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};
