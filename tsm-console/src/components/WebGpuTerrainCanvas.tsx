/**
 * Optional WebGPU terrain presentation canvas.
 * Independent of MapLibre WebGL; verified textures only; no fabricated terrain.
 */

import { useEffect, useRef, useState } from 'react';
import {
  TsmWebGpuRayTracer,
  type WebGpuTerrainSource,
  type WebGpuRenderParameters,
} from '../gpu/open-world-raytracer';
import {
  bridgeMapLibreCameraToWebGpu,
  type MapLibreCameraSnapshot,
  type MetricLocalOrigin,
} from '../gpu/webgpu-camera-bridge';

export interface WebGpuTerrainCanvasProps {
  readonly width: number;
  readonly height: number;
  readonly origin: MetricLocalOrigin;
  readonly camera: MapLibreCameraSnapshot;
  readonly bindSource?: (device: GPUDevice) => Promise<WebGpuTerrainSource | null>;
  readonly activeWaterStageMeters?: number | null;
  readonly className?: string;
}

export default function WebGpuTerrainCanvas(props: WebGpuTerrainCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tracerRef = useRef<TsmWebGpuRayTracer | null>(null);
  const [status, setStatus] = useState<string>('Initializing WebGPU…');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = Math.max(1, Math.floor(props.width));
    canvas.height = Math.max(1, Math.floor(props.height));

    let cancelled = false;
    const tracer = new TsmWebGpuRayTracer();
    tracerRef.current = tracer;

    void (async () => {
      const init = await tracer.initialize(canvas);
      if (cancelled) return;
      if (!init.ok) {
        setStatus(init.reason ?? 'WebGPU unavailable — MapLibre WebGL path remains active.');
        setReady(false);
        return;
      }

      if (props.bindSource) {
        const device = tracer.getDevice();
        if (!device) {
          setStatus('WebGPU device missing after initialize.');
          setReady(false);
          return;
        }
        try {
          const source = await props.bindSource(device);
          if (cancelled) return;
          if (!source) {
            setStatus('No verified terrain source bound — presentation deferred.');
            setReady(false);
            return;
          }
          if (!source.provenanceHashSha256 || !source.verticalDatum || !source.horizontalCrs) {
            setStatus('Terrain source missing provenance or datum labels — refused.');
            setReady(false);
            return;
          }
          tracer.setTerrainSource(source);
          setStatus(
            `WebGPU presentation · ${source.horizontalCrs} / ${source.verticalDatum} · ${source.provenanceUri}`,
          );
          setReady(true);
        } catch (err) {
          setStatus(`Terrain bind failed: ${err instanceof Error ? err.message : String(err)}`);
          setReady(false);
        }
      } else {
        setStatus('WebGPU ready — bind a verified height/satellite source to render.');
        setReady(false);
      }
    })();

    return () => {
      cancelled = true;
      tracer.dispose();
      tracerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.width, props.height, props.bindSource]);

  useEffect(() => {
    if (!ready || !tracerRef.current) return;
    try {
      const bridged = bridgeMapLibreCameraToWebGpu(props.camera, props.origin);
      const params: WebGpuRenderParameters = {
        inverseViewProjection: bridged.inverseViewProjection,
        cameraPositionMeters: bridged.cameraPositionMeters,
        timeSeconds: performance.now() / 1000,
        sunDirection: [0.4, 0.85, 0.35],
        activeWaterStageMeters: props.activeWaterStageMeters ?? null,
      };
      tracerRef.current.renderFrame(params);
    } catch (err) {
      setStatus(`Camera bridge error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [ready, props.camera, props.origin, props.activeWaterStageMeters]);

  return (
    <div className={props.className} style={{ position: 'relative', width: props.width, height: props.height }}>
      <canvas
        ref={canvasRef}
        width={props.width}
        height={props.height}
        style={{ width: '100%', height: '100%', display: 'block', background: '#0a1220' }}
        aria-label="WebGPU terrain presentation (optional)"
      />
      <div
        role="status"
        style={{
          position: 'absolute',
          left: 8,
          bottom: 8,
          padding: '4px 8px',
          fontSize: 12,
          color: '#e8eef7',
          background: 'rgba(0,0,0,0.55)',
          borderRadius: 4,
          maxWidth: '95%',
        }}
      >
        {status}
      </div>
    </div>
  );
}
