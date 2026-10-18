#ifndef RING_BUFFER_LOGGER_HPP
#define RING_BUFFER_LOGGER_HPP

#include <atomic>
#include <array>
#include <cstdint>
#include <optional>

namespace tristate {

struct LogEntry {
    uint64_t timestamp;
    uint8_t previousState;
    uint8_t newState;
    uint8_t errorCode;
};

template <size_t Capacity = 1024>
class LockFreeTelemetryLogger {
private:
    static_assert((Capacity & (Capacity - 1)) == 0, "Capacity must be a power of 2");
    static_assert(Capacity >= 2, "Capacity must be at least 2");

    std::array<LogEntry, Capacity> buffer{};
    alignas(64) std::atomic<size_t> head{0};
    alignas(64) std::atomic<size_t> tail{0};

public:
    LockFreeTelemetryLogger() = default;

    bool push(const LogEntry& entry) noexcept {
        const size_t currentHead = head.load(std::memory_order_relaxed);
        const size_t currentTail = tail.load(std::memory_order_acquire);
        if ((currentHead - currentTail) >= Capacity) {
            return false;
        }
        buffer[currentHead & (Capacity - 1)] = entry;
        head.store(currentHead + 1, std::memory_order_release);
        return true;
    }

    std::optional<LogEntry> pop() noexcept {
        const size_t currentTail = tail.load(std::memory_order_relaxed);
        const size_t currentHead = head.load(std::memory_order_acquire);
        if (currentTail == currentHead) {
            return std::nullopt;
        }
        LogEntry entry = buffer[currentTail & (Capacity - 1)];
        tail.store(currentTail + 1, std::memory_order_release);
        return entry;
    }
};

} // namespace tristate

#endif
