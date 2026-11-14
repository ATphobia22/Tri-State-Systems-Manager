#pragma once
// Standalone deterministic, bounded two-way surface-water exchange kernel.
// Informational numerical screening; not a calibrated HEC-RAS replacement.
// Units: SI; cell elevations and water surfaces MUST share one verified datum.
#include <algorithm>
#include <cmath>
#include <cstdint>

namespace TSMPhysics {
struct Cell {
  double areaM2 = 0.0;
  double groundM = 0.0;
  double volumeM3 = 0.0;
};
struct Exchange {
  double transferM3 = 0.0; // positive from a to b
  double aAfterM3 = 0.0;
  double bAfterM3 = 0.0;
  bool valid = false;
};
inline bool validCell(const Cell& c) {
  return std::isfinite(c.areaM2) && c.areaM2 > 0.0 &&
    std::isfinite(c.groundM) && std::isfinite(c.volumeM3) && c.volumeM3 >= 0.0;
}
// Bounded bidirectional two-cell flux. The water-surface head difference drives
// flow in either direction. The equilibrium and donor limits keep one step
// from reversing the head difference or making a donor volume negative.
inline Exchange stepPair(const Cell& a, const Cell& b, double interfaceWidthM,
                         double conductanceMPerS, double dtSeconds) {
  Exchange out{};
  if (!validCell(a) || !validCell(b) || !std::isfinite(interfaceWidthM) ||
      !std::isfinite(conductanceMPerS) || !std::isfinite(dtSeconds) ||
      interfaceWidthM <= 0.0 || conductanceMPerS < 0.0 || dtSeconds <= 0.0) return out;
  const double head = (a.groundM + a.volumeM3 / a.areaM2)
                    - (b.groundM + b.volumeM3 / b.areaM2);
  const double demand = head * interfaceWidthM * conductanceMPerS * dtSeconds;
  if (!std::isfinite(demand)) return out;
  const double smallArea = std::min(a.areaM2, b.areaM2);
  const double largeArea = std::max(a.areaM2, b.areaM2);
  const double equilibriumVolume = std::abs(head) * (smallArea / (1.0 + smallArea / largeArea));
  const double donorVolume = demand >= 0.0 ? a.volumeM3 : b.volumeM3;
  const double magnitude = std::min({std::abs(demand), equilibriumVolume, donorVolume});
  const double transfer = std::copysign(magnitude, demand);
  out.transferM3 = transfer;
  out.aAfterM3 = a.volumeM3 - transfer;
  out.bAfterM3 = b.volumeM3 + transfer;
  out.valid = std::isfinite(out.aAfterM3) && std::isfinite(out.bAfterM3) &&
              out.aAfterM3 >= 0.0 && out.bAfterM3 >= 0.0;
  return out;
}
} // namespace TSMPhysics
