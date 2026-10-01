import { latLngToCell, isValidCell } from 'h3-js';

export const H3_QUERY_RESOLUTION = 8;

export class SpatialInputError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SpatialInputError';
    this.code = code;
    this.status = 400;
  }
}

function finiteCoordinate(value, field, minimum, maximum) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new SpatialInputError('SPATIAL_PARAMETER_INVALID', `${field} must be a finite number.`);
  }
  if (value < minimum || value > maximum) {
    throw new SpatialInputError('SPATIAL_COORDINATE_OUT_OF_BOUNDS', `${field} must be between ${minimum} and ${maximum} degrees.`);
  }
  return value;
}

export function appendH3SpatialIndex(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new SpatialInputError('SPATIAL_BODY_INVALID', 'Request body must be a JSON object.');
  }

  const latitude = finiteCoordinate(body.latitude, 'latitude', -90, 90);
  const longitude = finiteCoordinate(body.longitude, 'longitude', -180, 180);

  if (body.resolution !== undefined && body.resolution !== H3_QUERY_RESOLUTION) {
    throw new SpatialInputError(
      'SPATIAL_RESOLUTION_UNSUPPORTED',
      `Only H3 resolution ${H3_QUERY_RESOLUTION} is exposed by this endpoint.`,
    );
  }

  const h3Index = latLngToCell(latitude, longitude, H3_QUERY_RESOLUTION);
  if (!isValidCell(h3Index)) {
    throw new SpatialInputError('SPATIAL_INDEX_INVALID', 'H3 library returned an invalid cell index.');
  }

  return Object.freeze({
    latitude,
    longitude,
    h3IndexRes8: h3Index,
    resolution: H3_QUERY_RESOLUTION,
  });
}
