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
    const ArchimedesStatus status =
        ArchimedesEvaluateGeodeticInvariants(&input, &output);

    assert(status == ARCHIMEDES_OK);
    assert(std::abs(output.bfe_ft - 375.0) < 1e-12);
    assert(std::abs(output.lag_ft - 377.2) < 1e-12);
    assert(std::abs(output.surface_water_elevation_ft - 376.25) < 1e-12);

    input.stage_delta_ft = NAN;
    assert(
        ArchimedesEvaluateGeodeticInvariants(&input, &output) ==
        ARCHIMEDES_NON_FINITE_INPUT);

    return 0;
}
