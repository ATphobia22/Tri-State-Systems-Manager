import { appendH3SpatialIndex, SpatialInputError } from '../middleware/h3-indexer.mjs';

export async function handleH3QueryRoute({ method, pathname, body, json }) {
  if (method !== 'POST' || pathname !== '/api/hydrologic/query') return false;

  try {
    const spatialContext = appendH3SpatialIndex(body);
    return json(200, {
      ok: true,
      status: 'SUCCESS',
      input_geometry: {
        latitude: spatialContext.latitude,
        longitude: spatialContext.longitude,
      },
      spatial_indices: {
        h3_res8: spatialContext.h3IndexRes8,
      },
      provenance: {
        engine: 'TSM-Deterministic-Kernel-v2',
        indexing_standard: 'H3',
        processing_timestamp: new Date().toISOString(),
        regulatory_determination: false,
      },
    });
  } catch (error) {
    if (error instanceof SpatialInputError) {
      return json(error.status, {
        ok: false,
        status: 'REJECTED',
        code: error.code,
        error: error.message,
      });
    }
    throw error;
  }
}
