#include "ArchimedesNative.h"

#include <algorithm>
#include <cmath>
#include <limits>
#include <vector>

namespace
{
constexpr double kMinimumDepthFt = 1.0e-6;

bool IsFinite(double value)
{
    return std::isfinite(value);
}

double SafeManningFrictionSlope(double depth, double velocity, double manningsN)
{
    if (depth <= kMinimumDepthFt || manningsN <= 0.0)
    {
        return 0.0;
    }

    const double area = depth;
    const double perimeter = 1.0 + 2.0 * depth;
    const double hydraulicRadius = area / perimeter;
    const double numerator = manningsN * manningsN * velocity * std::abs(velocity);

    return numerator / std::pow(hydraulicRadius, 4.0 / 3.0);
}

double HllMassFlux(double hL, double uL, double hR, double uR, double gravity)
{
    const double cL = std::sqrt(gravity * std::max(hL, 0.0));
    const double cR = std::sqrt(gravity * std::max(hR, 0.0));
    const double sL = std::min(uL - cL, uR - cR);
    const double sR = std::max(uL + cL, uR + cR);

    const double qL = hL * uL;
    const double qR = hR * uR;
    const double fL = qL;
    const double fR = qR;

    if (sL >= 0.0) return fL;
    if (sR <= 0.0) return fR;

    return (sR * fL - sL * fR + sL * sR * (hR - hL)) / (sR - sL);
}

double HllMomentumFlux(double hL, double uL, double hR, double uR, double gravity)
{
    const double cL = std::sqrt(gravity * std::max(hL, 0.0));
    const double cR = std::sqrt(gravity * std::max(hR, 0.0));
    const double sL = std::min(uL - cL, uR - cR);
    const double sR = std::max(uL + cL, uR + cR);

    const double qL = hL * uL;
    const double qR = hR * uR;
    const double fL = qL * uL + 0.5 * gravity * hL * hL;
    const double fR = qR * uR + 0.5 * gravity * hR * hR;

    if (sL >= 0.0) return fL;
    if (sR <= 0.0) return fR;

    return (sR * fL - sL * fR + sL * sR * (qR - qL)) / (sR - sL);
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

    if (!IsFinite(input->x_epsg2966_ftus) ||
        !IsFinite(input->y_epsg2966_ftus) ||
        !IsFinite(input->bfe_ft) ||
        !IsFinite(input->lag_ft) ||
        !IsFinite(input->stage_delta_ft))
    {
        return ARCHIMEDES_NON_FINITE_INPUT;
    }

    if (input->x_epsg2966_ftus < 0.0 || input->y_epsg2966_ftus < 0.0 ||
        input->lag_ft < input->bfe_ft)
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
    output->inundation_active = surface >= input->lag_ft ? 1 : 0;

    return ARCHIMEDES_OK;
}

extern "C" ARCHIMEDES_API ArchimedesStatus ArchimedesSolveSaintVenant1D(
    const ArchimedesSaintVenantConfig* config,
    double* depth_ft,
    double* velocity_fps,
    int cell_count,
    double dt_seconds)
{
    if (config == nullptr || depth_ft == nullptr || velocity_fps == nullptr ||
        cell_count < 2 || !IsFinite(dt_seconds) || dt_seconds <= 0.0)
    {
        return ARCHIMEDES_INVALID_ARGUMENT;
    }

    if (!IsFinite(config->cell_width_ft) || !IsFinite(config->bed_slope) ||
        !IsFinite(config->mannings_n) || !IsFinite(config->gravity_ft_s2) ||
        !IsFinite(config->cfl) || config->cell_width_ft <= 0.0 ||
        config->bed_slope < 0.0 || config->mannings_n <= 0.0 ||
        config->gravity_ft_s2 <= 0.0 || config->cfl <= 0.0 || config->cfl > 1.0)
    {
        return ARCHIMEDES_INVALID_ARGUMENT;
    }

    double maxWaveSpeed = 0.0;
    for (int i = 0; i < cell_count; ++i)
    {
        if (!IsFinite(depth_ft[i]) || !IsFinite(velocity_fps[i]) ||
            depth_ft[i] < 0.0)
        {
            return ARCHIMEDES_INVALID_ARGUMENT;
        }

        maxWaveSpeed = std::max(
            maxWaveSpeed,
            std::abs(velocity_fps[i]) +
                std::sqrt(config->gravity_ft_s2 * depth_ft[i]));
    }

    if (maxWaveSpeed > 0.0)
    {
        const double stableDt =
            config->cfl * config->cell_width_ft / maxWaveSpeed;
        if (dt_seconds > stableDt)
        {
            return ARCHIMEDES_UNSTABLE_TIMESTEP;
        }
    }

    std::vector<double> nextDepth(static_cast<size_t>(cell_count));
    std::vector<double> nextVelocity(static_cast<size_t>(cell_count));

    for (int i = 0; i < cell_count; ++i)
    {
        const int left = i == 0 ? 0 : i - 1;
        const int right = i == cell_count - 1 ? cell_count - 1 : i + 1;

        const double massLeft = HllMassFlux(
            depth_ft[left], velocity_fps[left],
            depth_ft[i], velocity_fps[i], config->gravity_ft_s2);

        const double massRight = HllMassFlux(
            depth_ft[i], velocity_fps[i],
            depth_ft[right], velocity_fps[right], config->gravity_ft_s2);

        const double momentumLeft = HllMomentumFlux(
            depth_ft[left], velocity_fps[left],
            depth_ft[i], velocity_fps[i], config->gravity_ft_s2);

        const double momentumRight = HllMomentumFlux(
            depth_ft[i], velocity_fps[i],
            depth_ft[right], velocity_fps[right], config->gravity_ft_s2);

        const double oldDepth = depth_ft[i];
        const double oldVelocity = velocity_fps[i];
        const double oldMomentum = oldDepth * oldVelocity;

        const double frictionSlope = SafeManningFrictionSlope(
            oldDepth, oldVelocity, config->mannings_n);

        const double sourceMomentum =
            config->gravity_ft_s2 * oldDepth *
            (config->bed_slope - frictionSlope);

        const double updatedDepth = std::max(
            0.0,
            oldDepth - (dt_seconds / config->cell_width_ft) *
                (massRight - massLeft));

        const double updatedMomentum =
            oldMomentum -
            (dt_seconds / config->cell_width_ft) *
                (momentumRight - momentumLeft) +
            dt_seconds * sourceMomentum;

        nextDepth[static_cast<size_t>(i)] = updatedDepth;

        if (updatedDepth <= kMinimumDepthFt)
        {
            nextVelocity[static_cast<size_t>(i)] = 0.0;
        }
        else
        {
            nextVelocity[static_cast<size_t>(i)] =
                updatedMomentum / updatedDepth;
        }
    }

    for (int i = 0; i < cell_count; ++i)
    {
        depth_ft[i] = nextDepth[static_cast<size_t>(i)];
        velocity_fps[i] = nextVelocity[static_cast<size_t>(i)];
    }

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
    case ARCHIMEDES_UNSTABLE_TIMESTEP: return "unstable_timestep";
    case ARCHIMEDES_DRY_STATE: return "dry_state";
    default: return "unknown";
    }
}
