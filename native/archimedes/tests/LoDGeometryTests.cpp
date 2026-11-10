#include "TSMLoDReconstructionSolver.h"

#include <cmath>
#include <cstdlib>
#include <iostream>
#include <limits>

// Explicit checks remain active in Release builds (unlike assert).
static void Check(bool condition, const char* reason)
{
    if (!condition) { std::cerr << reason << '\n'; std::exit(1); }
}

int main()
{
    using namespace tsm::geometry;
    TSMLoDReconstructionSolver solver;
    Point3D anchor{}, direction{};
    Check(solver.ComputePlaneIntersection({-.5, 0, 1, -10}, {.5, 0, 1, -10}, anchor, direction),
          "gable ridge must intersect despite zero XY determinant");
    Check(std::abs(anchor.x) < 1e-12 && std::abs(anchor.z - 10) < 1e-12 &&
          std::abs(std::abs(direction.y) - 1) < 1e-12, "gable ridge is x=0,z=10");
    Check(solver.ComputePlaneIntersection({1, 0, 0, -2}, {0, 1, 0, -3}, anchor, direction),
          "vertical planes also intersect");
    Check(std::abs(anchor.x - 2) < 1e-12 && std::abs(anchor.y - 3) < 1e-12 &&
          std::abs(std::abs(direction.z) - 1) < 1e-12, "vertical ridge has correct anchor");
    Check(solver.ComputePlaneIntersection({1, 1, 1, -6}, {1, -1, 0, 0}, anchor, direction),
          "oblique planes have an intersection");
    Check(std::abs(anchor.x - 2) < 1e-12 && std::abs(anchor.y - 2) < 1e-12 &&
          std::abs(anchor.z - 2) < 1e-12, "oblique closest anchor is (2,2,2)");
    Check(std::abs(direction.x + direction.y + direction.z) < 1e-12 &&
          std::abs(direction.x - direction.y) < 1e-12, "direction lies in both planes");
    Check(solver.ComputePlaneIntersection({-5e-120, 0, 1e-119, -1e-118},
                                          {5e119, 0, 1e120, -1e121}, anchor, direction),
          "plane equation scaling must not change intersection");
    Check(std::abs(anchor.z - 10) < 1e-10, "scaled ridge has same elevation");
    for (const PlaneEquation invalid : {PlaneEquation{0, 0, 0, 1},
                                        PlaneEquation{NAN, 0, 1, 1},
                                        PlaneEquation{0, 0, INFINITY, 1}})
    {
        Check(!solver.ComputePlaneIntersection(invalid, {0, 1, 0, 0}, anchor, direction),
              "invalid planes rejected");
        Check(std::isnan(anchor.x), "failed result cannot look like a valid origin");
    }
    Check(!solver.ComputePlaneIntersection({0, 0, 1, -2}, {0, 0, 2, -6}, anchor, direction),
          "parallel planes have no unique intersection");
    Check(!solver.ComputePlaneIntersection({0, 0, 1, -2}, {0, 0, -2, 4}, anchor, direction),
          "coincident planes have no unique intersection");
    Check(!solver.ComputePlaneIntersection({0, 0, 1, -2}, {1e-12, 0, 1, -3}, anchor, direction),
          "numerically near-parallel planes are unavailable");
    double rmse = 0;
    Check(solver.CalculateVerticalRMSE({{0, 0, 13}, {1, 1, 14}}, {0, 0, 1, -10}, rmse),
          "vertical residual metric available");
    Check(std::abs(rmse - std::sqrt(12.5)) < 1e-12, "residuals 3 and 4 give sqrt(12.5)");
    Check(solver.CalculateVerticalRMSE({{0, 0, 13}, {1, 1, 14}}, {0, 0, -1e-120, 1e-119}, rmse),
          "metric invariant under plane scaling");
    Check(std::abs(rmse - std::sqrt(12.5)) < 1e-10, "scaled metric identical");
    Check(!solver.CalculateVerticalRMSE({}, {0, 0, 1, 0}, rmse) && std::isnan(rmse),
          "empty evidence is not zero error");
    Check(!solver.CalculateVerticalRMSE({{1, 2, 3}}, {1, 0, 0, 0}, rmse),
          "vertical plane has undefined model Z");
    Check(!solver.CalculateVerticalRMSE({{NAN, 2, 3}}, {0, 0, 1, 0}, rmse),
          "nonfinite samples cannot pass");
    std::cout << "LoD geometry tests passed\n";
}
