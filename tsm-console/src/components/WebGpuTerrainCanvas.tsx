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
import type { GpuHZAabbCandidate } from '../lib/webgpu-hierarchical-z-cull';
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
  /** Optional projected terrain-chunk bounds. No synthetic candidates are generated. */
  readonly occlusionCandidates?: readonly GpuHZAabbCandidate[];
  /** Called only when GPU H-Z classification ran for the supplied candidates. */
  readonly onOcclusionResults?: (visibility: Uint32Array) => void;
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
    let recoveryAttempts = 0;
    const recoverAfterDeviceLoss = async (): Promise<void> => {
      if (cancelled || recoveryAttempts >= 3) {
        if (!cancelled) setStatus('WebGPU device recovery exhausted; use the active MapLibre WebGL renderer.');
        return;
      }
      recoveryAttempts += 1;
      setReady(false);
      setStatus(`WebGPU device lost; rebuilding resources (attempt ${recoveryAttempts}/3)…`);
      await new Promise<void>((resolve) => window.setTimeout(resolve, Math.min(500 * (2 ** (recoveryAttempts - 1)), 4000)));
      if (cancelled) return;
      tracer.dispose();
      tracer.setDeviceLostHandler((info) => {
        if (!cancelled) {
          setStatus(`WebGPU device lost: ${info.message}`);
          void recoverAfterDeviceLoss();
        }
      });
      const recovered = await tracer.initialize(canvas);
      if (cancelled) return;
      if (!recovered.ok) {
        setStatus(`WebGPU recovery failed: ${recovered.reason ?? 'unknown error'}`);
        void recoverAfterDeviceLoss();
        return;
      }
      if (!props.bindSource) {
        setStatus('WebGPU recovered; bind a verified terrain source to resume presentation.');
        setReady(false);
        return;
      }
      try {
        const device = tracer.getDevice();
        if (!device) throw new Error('Recovered device is unavailable.');
        const source = await props.bindSource(device);
        if (!source) throw new Error('No verified terrain source was returned.');
        if (!source.provenanceHashSha256 || !source.verticalDatum || !source.horizontalCrs) {
          throw new Error('Recovered terrain source is missing provenance or datum labels.');
        }
        tracer.setTerrainSource(source);
        setStatus(`WebGPU recovered · ${source.horizontalCrs} / ${source.verticalDatum} · ${source.provenanceUri}`);
        setReady(true);
      } catch (error) {
        setStatus(`WebGPU recovered but terrain rebind failed: ${error instanceof Error ? error.message : String(error)}`);
        setReady(false);
      }
    };
    tracer.setDeviceLostHandler((info) => {
      if (!cancelled) {
        setStatus(`WebGPU device lost: ${info.message}`);
        void recoverAfterDeviceLoss();
      }
    });

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
    let cancelled = false;
    const render = async (): Promise<void> => {
      try {
        const bridged = bridgeMapLibreCameraToWebGpu(props.camera, props.origin);
        const params: WebGpuRenderParameters = {
          inverseViewProjection: bridged.inverseViewProjection,
          cameraPositionMeters: bridged.cameraPositionMeters,
          timeSeconds: performance.now() / 1000,
          sunDirection: [0.4, 0.85, 0.35],
          activeWaterStageMeters: props.activeWaterStageMeters ?? null,
        };
        const tracer = tracerRef.current;
        if (!tracer) return;
        if (props.occlusionCandidates && props.occlusionCandidates.length > 0) {
          const visibility = await tracer.renderFrameWithOcclusion(params, props.occlusionCandidates);
          if (!cancelled) props.onOcclusionResults?.(visibility);
        } else {
          tracer.renderFrame(params);
        }
      } catch (err) {
        if (!cancelled) setStatus(`Camera/H-Z rendering error: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    void render();
    return () => { cancelled = true; };
  }, [ready, props.camera, props.origin, props.activeWaterStageMeters, props.occlusionCandidates, props.onOcclusionResults]);

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
