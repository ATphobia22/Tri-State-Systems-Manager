#include "../Source/TSMNative/TSMBidirectionalSurfacePhysics.h"
#include <cassert>
#include <cmath>
#include <limits>
int main() {
  using namespace TSMPhysics;
  const Cell a{10.0, 100.0, 20.0};
  const Cell b{10.0, 100.0, 0.0};
  auto forward = stepPair(a,b,2.0,0.25,1.0);
  assert(forward.valid && forward.transferM3 > 0.0);
  assert(std::abs(forward.aAfterM3 + forward.bAfterM3 - 20.0) < 1e-9);
  auto reverse = stepPair(b,a,2.0,0.25,1.0);
  assert(reverse.valid && reverse.transferM3 < 0.0);
  assert(std::abs(reverse.aAfterM3 + reverse.bAfterM3 - 20.0) < 1e-9);
  auto capped = stepPair(a,b,1e6,1e6,1e6);
  assert(capped.valid && capped.transferM3 == 10.0 && capped.aAfterM3 == capped.bAfterM3);
  const auto reverseCapped = stepPair(b,a,1e6,1e6,1e6);
  assert(reverseCapped.valid && reverseCapped.transferM3 == -10.0);
  const auto dryDonor = stepPair(a,Cell{10.0,90.0,0.0},1e6,1e6,1e6);
  assert(dryDonor.valid && dryDonor.transferM3 == 20.0 && dryDonor.aAfterM3 == 0.0);
  assert(!stepPair(Cell{0,0,0},b,1,1,1).valid);
  assert(!stepPair(a,b,1,1,std::numeric_limits<double>::infinity()).valid);
  assert(!stepPair(a,b,1,-1,1).valid);
  auto equal = stepPair(Cell{1,0,0},Cell{1,0,0},1,1,1);
  assert(equal.valid && equal.transferM3 == 0.0);
}
