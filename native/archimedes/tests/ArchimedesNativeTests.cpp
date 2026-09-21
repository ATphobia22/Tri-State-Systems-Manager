#include "ArchimedesNative.h"

#include <cassert>
#include <cmath>

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
    assert(
        ArchimedesEvaluateGeodeticInvariants(&input, &output) ==
        ARCHIMEDES_OK);
    assert(std::abs(output.surface_water_elevation_ft - 376.25) < 1e-12);
    assert(output.inundation_active == 0);

    ArchimedesSaintVenantConfig config{
        10.0,
        0.0002,
        0.035,
        32.174,
        0.8
    };

    double depth[] = {4.0, 4.0, 4.0, 4.0};
    double velocity[] = {1.0, 1.0, 1.0, 1.0};

    assert(
        ArchimedesSolveSaintVenant1D(
            &config, depth, velocity, 4, 0.1) ==
        ARCHIMEDES_OK);

    for (double value : depth)
    {
        assert(std::isfinite(value));
        assert(value >= 0.0);
    }

    input.stage_delta_ft = NAN;
    assert(
        ArchimedesEvaluateGeodeticInvariants(&input, &output) ==
        ARCHIMEDES_NON_FINITE_INPUT);

    return 0;
}
