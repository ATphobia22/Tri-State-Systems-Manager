/**
 * TerraDrawMapTools.tsx — Drawing tools for berm/road placement using TerraDraw.
 *
 * Loads TerraDraw from vendored UMD builds (public/vendor/terradraw/, loaded
 * via index.html). Provides polygon, line, and point drawing modes for the
 * engineering workbench. Fully air-gapped — no CDN required.
 *
 * The drawn features are emitted as GeoJSON for the berm-road-placement
 * engineering calculations. Human authority remains final — drawing
 * a shape does not approve or build anything.
 */

import { useEffect, useRef, useState } from 'react';

// TerraDraw is loaded from vendored script tags in index.html (air-gapped)
declare global {
  interface Window {
    terraDraw?: any;
    terraDrawMapLibreGLAdapter?: any;
  }
}

interface TerraDrawMapToolsProps {
  map: any; // MapLibre GL map instance
  onDrawEnd?: (features: any[]) => void;
}

export default function TerraDrawMapTools({ map, onDrawEnd }: TerraDrawMapToolsProps) {
  const drawRef = useRef<any>(null);
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Wait for TerraDraw CDN scripts to load
    const checkReady = () => {
      if (window.terraDraw && window.terraDrawMapLibreGLAdapter && map) {
        setReady(true);
      } else {
        setTimeout(checkReady, 100);
      }
    };
    checkReady();
  }, [map]);

  useEffect(() => {
    if (!ready || !map) return;

    const { TerraDraw } = window.terraDraw;
    const { TerraDrawMapLibreGLAdapter } = window.terraDrawMapLibreGLAdapter;

    // Import modes from the global
    const {
      TerraDrawPolygonMode,
      TerraDrawLineStringMode,
      TerraDrawPointMode,
      TerraDrawFreehandMode,
    } = window.terraDraw;

    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [
        new TerraDrawPolygonMode(),
        new TerraDrawLineStringMode(),
        new TerraDrawPointMode(),
        new TerraDrawFreehandMode(),
      ],
    });

    draw.start();
    drawRef.current = draw;

    // Listen for draw end
    draw.on('finish', (id: string) => {
      const snapshot = draw.getSnapshot();
      if (onDrawEnd) {
        onDrawEnd(snapshot);
      }
    });

    return () => {
      draw.stop();
      drawRef.current = null;
    };
  }, [ready, map]);

  const setMode = (mode: string) => {
    if (drawRef.current) {
      drawRef.current.setMode(mode);
      setActiveMode(mode);
    }
  };

  const clearAll = () => {
    if (drawRef.current) {
      drawRef.current.clear();
      setActiveMode(null);
    }
  };

  if (!ready) {
    return <div style={{ padding: 8, fontSize: 12 }}>Loading drawing tools…</div>;
  }

  const buttonStyle = (isActive: boolean): React.CSSProperties => ({
    minWidth: 44,
    minHeight: 44,
    padding: '8px 12px',
    margin: 4,
    border: isActive ? '2px solid #2563eb' : '1px solid #cbd5e1',
    borderRadius: 8,
    background: isActive ? '#dbeafe' : '#ffffff',
    fontSize: 14,
    cursor: 'pointer',
  });

  return (
    <div style={{ padding: 8, background: '#f8fafc', borderRadius: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
        Draw placement
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        <button
          style={buttonStyle(activeMode === 'polygon')}
          onClick={() => setMode('polygon')}
          aria-label="Draw polygon"
        >
          ⬠ Polygon
        </button>
        <button
          style={buttonStyle(activeMode === 'linestring')}
          onClick={() => setMode('linestring')}
          aria-label="Draw line"
        >
          ╱ Line
        </button>
        <button
          style={buttonStyle(activeMode === 'point')}
          onClick={() => setMode('point')}
          aria-label="Draw point"
        >
          • Point
        </button>
        <button
          style={buttonStyle(activeMode === 'freehand')}
          onClick={() => setMode('freehand')}
          aria-label="Draw freehand"
        >
          ✎ Freehand
        </button>
        <button
          style={{ ...buttonStyle(false), color: '#dc2626' }}
          onClick={clearAll}
          aria-label="Clear all drawings"
        >
          ✕ Clear
        </button>
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
        Draw a shape for berm/road placement analysis. Human review required.
      </div>
    </div>
  );
}
