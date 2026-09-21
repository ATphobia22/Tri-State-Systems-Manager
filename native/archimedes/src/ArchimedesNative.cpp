#include "ArchimedesNative.h"

#include <cmath>

namespace
{
bool IsFinite(double value)
{
    return std::isfinite(value);
}
}

extern "C" ARCHIMEDES_API ArchimedesStatus ArchimedesEvaluateGeodeticInvariants(
    const ArchimedesSiteInput* input,
    ArchimedesSiteMetrics* output)
{
    if (input == nullptr || output == nullptr)
    {
        return ARCHIMEDES_INVALID_ARGUMENT;
    }

    if (!IsFinite(input->x_epsg2966_m) ||
        !IsFinite(input->y_epsg2966_m) ||
        !IsFinite(input->bfe_ft) ||
        !IsFinite(input->lag_ft) ||
        !IsFinite(input->stage_delta_ft))
    {
        return ARCHIMEDES_NON_FINITE_INPUT;
    }

    if (input->x_epsg2966_m < 0.0 || input->y_epsg2966_m < 0.0)
    {
        return ARCHIMEDES_INVALID_GEOMETRY;
    }

    if (input->lag_ft < input->bfe_ft)
    {
        return ARCHIMEDES_INVALID_GEOMETRY;
    }

    const double surface = input->bfe_ft + input->stage_delta_ft;

    if (!IsFinite(surface))
    {
        return ARCHIMEDES_NON_FINITE_INPUT;
    }

    output->bfe_ft = input->bfe_ft;
    output->lag_ft = input->lag_ft;
    output->surface_water_elevation_ft = surface;

    return ARCHIMEDES_OK;
}

extern "C" ARCHIMEDES_API const char* ArchimedesStatusName(
    ArchimedesStatus status)
{
    switch (status)
    {
    case ARCHIMEDES_OK: return "ok";
    case ARCHIMEDES_INVALID_ARGUMENT: return "invalid_argument";
    case ARCHIMEDES_NON_FINITE_INPUT: return "non_finite_input";
    case ARCHIMEDES_INVALID_GEOMETRY: return "invalid_geometry";
    default: return "unknown";
    }
}
