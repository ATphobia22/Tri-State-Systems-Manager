#include "ArchimedesNative.h"

#include <cassert>
#include <cmath>

namespace
{
void AssertFinite(const double* values, int count)
{
    for (int i = 0; i < count; ++i)
    {
        assert(std::isfinite(values[i]));
    }
}

void AssertFiniteNonNegative(const double* values, int count)
{
    AssertFinite(values, count);
    for (int i = 0; i < count; ++i)
    {
        assert(values[i] >= 0.0);
    }
}
}

int main()
{
    ArchimedesSiteInput input{
        504320.12,
        142095.44,
        375.0,
        377.2,
        1.25
    };

    ArchimedesSiteMetrics output{};
    assert(ArchimedesEvaluateGeodeticInvariants(&input, &output) == ARCHIMEDES_OK);
    assert(std::abs(output.surface_water_elevation_ft - 376.25) < 1e-12);
    assert(output.inundation_active == 0);

    input.stage_delta_ft = 2.2;
    assert(ArchimedesEvaluateGeodeticInvariants(&input, &output) == ARCHIMEDES_OK);
    assert(std::abs(output.surface_water_elevation_ft - 377.2) < 1e-12);
    assert(output.inundation_active == 1);

    input.stage_delta_ft = NAN;
    assert(
        ArchimedesEvaluateGeodeticInvariants(&input, &output) ==
        ARCHIMEDES_NON_FINITE_INPUT);

    ArchimedesSaintVenantConfig config{
        10.0,
        0.0002,
        0.035,
        32.174,
        0.8
    };

    double depth[] = {4.0, 4.0, 4.0, 4.0};
    double velocity[] = {1.0, 1.0, 1.0, 1.0};

    const double beforeDepthSum = 16.0;

    assert(ArchimedesSolveSaintVenant1D(&config, depth, velocity, 4, 0.1) == ARCHIMEDES_OK);

    AssertFiniteNonNegative(depth, 4);
    AssertFinite(velocity, 4);

    double afterDepthSum = 0.0;
    for (double value : depth)
    {
        afterDepthSum += value;
    }
    assert(afterDepthSum > 0.0);
    assert(std::isfinite(afterDepthSum));
    assert(std::abs(afterDepthSum - beforeDepthSum) < 0.05);

    double stableDepth[] = {4.0, 4.0, 4.0, 4.0};
    double stableVelocity[] = {1.0, 1.0, 1.0, 1.0};

    assert(ArchimedesSolveSaintVenant1D(&config, stableDepth, stableVelocity, 4, 10.0) == ARCHIMEDES_UNSTABLE_TIMESTEP);

    double dryDepth[] = {0.0, 0.0, 0.0, 0.0};
    double dryVelocity[] = {0.0, 0.0, 0.0, 0.0};

    assert(ArchimedesSolveSaintVenant1D(&config, dryDepth, dryVelocity, 4, 0.1) == ARCHIMEDES_OK);
    AssertFiniteNonNegative(dryDepth, 4);
    AssertFinite(dryVelocity, 4);

    assert(ArchimedesSolveSaintVenant1D(&config, dryDepth, dryVelocity, 4, 0.0) == ARCHIMEDES_INVALID_ARGUMENT);

    return 0;
}
