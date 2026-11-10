#pragma once

#include <cmath>
#include <limits>
#include <vector>

// Original numerical utilities, not an implementation of PolyFit, Scan2LoD3,
// PLANES4LOD2, RANSAC, bounded roof topology, or a LoD certification algorithm.
// Callers must supply points and plane offsets in the SAME local metric frame.
namespace tsm::geometry
{
struct Point3D { double x, y, z; };
struct PlaneEquation { double a, b, c, d; };

class TSMLoDReconstructionSolver
{
public:
    // Vertical Z residual, not orthogonal point-to-plane distance or confidence.
    // Invalid/empty evidence produces false and NaN, never zero-error success.
    bool CalculateVerticalRMSE(const std::vector<Point3D>& points,
                               const PlaneEquation& plane, double& output) const
    {
        output = NaN();
        PlaneEquation p{};
        if (points.empty() || !Normalize(plane, p) || std::abs(p.c) <= 1e-10)
            return false;
        const double rootCount = std::sqrt(static_cast<double>(points.size()));
        double rms = 0;
        for (const auto& point : points)
        {
            if (!Finite(point)) return false;
            const double modelZ = -(p.a * point.x + p.b * point.y + p.d) / p.c;
            const double residual = point.z - modelZ;
            if (!std::isfinite(residual)) return false;
            rms = std::hypot(rms, residual / rootCount);
        }
        if (!std::isfinite(rms)) return false;
        output = rms;
        return true;
    }

    // Infinite plane intersection ONLY: caller must clip against observed roof
    // patches and check adjacency before describing this line as a roof ridge.
    bool ComputePlaneIntersection(const PlaneEquation& first, const PlaneEquation& second,
                                  Point3D& anchor, Point3D& direction) const
    {
        anchor = direction = {NaN(), NaN(), NaN()};
        PlaneEquation p{}, q{};
        if (!Normalize(first, p) || !Normalize(second, q)) return false;
        const Point3D n1{p.a, p.b, p.c}, n2{q.a, q.b, q.c};
        const Point3D cross = Cross(n1, n2);
        const double length = std::hypot(cross.x, cross.y, cross.z);
        if (!std::isfinite(length) || length <= 1e-10) return false;
        const Point3D offset{q.d * p.a - p.d * q.a,
                             q.d * p.b - p.d * q.b,
                             q.d * p.c - p.d * q.c};
        Point3D position = Cross(offset, cross);
        const double squared = length * length;
        position = {position.x / squared, position.y / squared, position.z / squared};
        if (!Finite(position)) return false;
        anchor = position;
        direction = {cross.x / length, cross.y / length, cross.z / length};
        return true;
    }

private:
    static double NaN() { return std::numeric_limits<double>::quiet_NaN(); }
    static bool Finite(const Point3D& p)
    { return std::isfinite(p.x) && std::isfinite(p.y) && std::isfinite(p.z); }
    static Point3D Cross(const Point3D& p, const Point3D& q)
    { return {p.y*q.z-p.z*q.y, p.z*q.x-p.x*q.z, p.x*q.y-p.y*q.x}; }
    static bool Normalize(const PlaneEquation& input, PlaneEquation& result)
    {
        if (!Finite({input.a, input.b, input.c}) || !std::isfinite(input.d)) return false;
        const double scale = std::fmax(std::abs(input.a),
                             std::fmax(std::abs(input.b), std::abs(input.c)));
        if (scale == 0) return false;
        result = {input.a/scale, input.b/scale, input.c/scale, input.d/scale};
        const double length = std::hypot(result.a, result.b, result.c);
        result = {result.a/length, result.b/length, result.c/length, result.d/length};
        return std::isfinite(result.d);
    }
};
}
