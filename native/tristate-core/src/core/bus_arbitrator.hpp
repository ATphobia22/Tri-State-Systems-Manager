#ifndef BUS_ARBITRATOR_HPP
#define BUS_ARBITRATOR_HPP

#include <atomic>
#include <array>
#include <cstdint>

namespace tristate {

enum class BusChannel : uint8_t {
    Channel0 = 0,
    Channel1 = 1,
    Channel2 = 2,
    Channel3 = 3
};

class BusArbitrator {
private:
    std::atomic<uint8_t> channelOccupancyMask{0x00};

    static constexpr std::array<uint8_t, 4> ChannelConflictMasks = {{
        0b00000011,
        0b00000011,
        0b00001100,
        0b00001100
    }};

public:
    BusArbitrator() = default;

    bool requestAccess(BusChannel channel) noexcept {
        const auto chanIdx = static_cast<uint8_t>(channel);
        if (chanIdx > 3) return false;
        const uint8_t conflictMask = ChannelConflictMasks[chanIdx];
        const uint8_t bitFlag = static_cast<uint8_t>(1u << chanIdx);
        uint8_t currentMask = channelOccupancyMask.load(std::memory_order_relaxed);
        while (true) {
            if ((currentMask & conflictMask) != 0) {
                return false;
            }
            const uint8_t targetMask = static_cast<uint8_t>(currentMask | bitFlag);
            if (channelOccupancyMask.compare_exchange_weak(
                    currentMask, targetMask,
                    std::memory_order_acq_rel,
                    std::memory_order_relaxed)) {
                return true;
            }
        }
    }

    void releaseAccess(BusChannel channel) noexcept {
        const auto chanIdx = static_cast<uint8_t>(channel);
        if (chanIdx > 3) return;
        const uint8_t clearMask = static_cast<uint8_t>(~(1u << chanIdx));
        channelOccupancyMask.fetch_and(clearMask, std::memory_order_release);
    }

    uint8_t getActiveMask() const noexcept {
        return channelOccupancyMask.load(std::memory_order_acquire);
    }
};

} // namespace tristate

#endif
