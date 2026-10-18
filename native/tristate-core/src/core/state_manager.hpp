#ifndef TRI_STATE_MANAGER_HPP
#define TRI_STATE_MANAGER_HPP

#include <atomic>
#include <mutex>
#include <array>
#include <cstdint>

namespace tristate {

enum class SystemState : uint8_t {
    Inactive = 0,
    Active = 1,
    HighImpedance = 2
};

enum class SystemEvent : uint8_t {
    EnableActive = 0,
    Suspend = 1,
    Isolate = 2,
    Reset = 3
};

class TriStateController {
private:
    std::atomic<SystemState> currentState{SystemState::Inactive};
    mutable std::mutex stateMutex;

    static constexpr std::array<std::array<bool, 4>, 3> TransitionMatrix = {{
        /* Inactive */ {{true, false, true, true}},
        /* Active   */ {{false, true, true, true}},
        /* High-Z   */ {{true, true, false, true}}
    }};

    static SystemState targetFor(SystemEvent event) noexcept {
        switch (event) {
            case SystemEvent::EnableActive: return SystemState::Active;
            case SystemEvent::Suspend:      return SystemState::Inactive;
            case SystemEvent::Isolate:      return SystemState::HighImpedance;
            case SystemEvent::Reset:        return SystemState::Inactive;
        }
        return SystemState::Inactive;
    }

    void writeHardwareRegister(SystemState /*state*/) noexcept {}

public:
    TriStateController() = default;

    bool handleEvent(SystemEvent event) {
        std::scoped_lock lock(stateMutex);
        SystemState current = currentState.load(std::memory_order_relaxed);
        const auto stateIdx = static_cast<size_t>(current);
        const auto eventIdx = static_cast<size_t>(event);
        if (stateIdx >= TransitionMatrix.size() || eventIdx >= TransitionMatrix[0].size()) {
            return false;
        }
        if (!TransitionMatrix[stateIdx][eventIdx]) {
            return false;
        }
        const SystemState targetState = targetFor(event);
        if (currentState.compare_exchange_strong(
                current, targetState, std::memory_order_acq_rel, std::memory_order_relaxed)) {
            writeHardwareRegister(targetState);
            return true;
        }
        return false;
    }

    SystemState getState() const noexcept {
        return currentState.load(std::memory_order_acquire);
    }
};

} // namespace tristate

#endif
