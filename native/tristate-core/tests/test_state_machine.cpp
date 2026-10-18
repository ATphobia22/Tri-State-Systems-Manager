#include <cassert>
#include <thread>
#include <iostream>
#include <atomic>

#include "core/state_manager.hpp"
#include "core/memory_mapper.hpp"
#include "core/bus_arbitrator.hpp"
#include "telemetry/ring_buffer_logger.hpp"

using namespace tristate;

void test_atomic_state_transitions() {
    TriStateController controller;
    assert(controller.getState() == SystemState::Inactive);

    assert(controller.handleEvent(SystemEvent::EnableActive) == true);
    assert(controller.getState() == SystemState::Active);

    assert(controller.handleEvent(SystemEvent::EnableActive) == false);

    assert(controller.handleEvent(SystemEvent::Isolate) == true);
    assert(controller.getState() == SystemState::HighImpedance);

    assert(controller.handleEvent(SystemEvent::Reset) == true);
    assert(controller.getState() == SystemState::Inactive);

    std::cout << "[PASS] Atomic State Transition Test\n";
}

void test_memory_boundary_validation() {
    constexpr uintptr_t base = 0x10000000;
    constexpr size_t size = 0x1000;
    auto mapper = PhysicalMemoryMapper::withHostBuffer(base, size);

    assert(mapper.writeRegister(base + 0x100, 0xCAFEBABEu) == true);
    auto validRead = mapper.readRegister(base + 0x100);
    assert(validRead.has_value());
    assert(validRead.value() == 0xCAFEBABEu);

    assert(mapper.readRegister(base - 4).has_value() == false);
    assert(mapper.writeRegister(base + size + 4, 0xDEADBEEFu) == false);

    std::cout << "[PASS] Memory Boundary Guard Test\n";
}

void test_concurrent_bus_arbitration() {
    BusArbitrator arbitrator;
    std::atomic<int> granted{0};

    auto worker = [&](BusChannel ch) {
        if (arbitrator.requestAccess(ch)) {
            granted.fetch_add(1, std::memory_order_relaxed);
            std::this_thread::yield();
            arbitrator.releaseAccess(ch);
        }
    };

    std::thread t1(worker, BusChannel::Channel0);
    std::thread t2(worker, BusChannel::Channel1);
    t1.join();
    t2.join();

    assert(arbitrator.getActiveMask() == 0x00);
    assert(granted.load() >= 1);
    std::cout << "[PASS] Concurrent Bus Arbitration Test\n";
}

void test_ring_buffer_logger() {
    LockFreeTelemetryLogger<8> log;
    LogEntry e{1, 0, 1, 0};
    assert(log.push(e) == true);
    auto out = log.pop();
    assert(out.has_value());
    assert(out->timestamp == 1);
    assert(!log.pop().has_value());
    std::cout << "[PASS] Lock-Free Telemetry Logger Test\n";
}

int main() {
    std::cout << "Starting Tri-State Systems Manager Verification Suite...\n";
    test_atomic_state_transitions();
    test_memory_boundary_validation();
    test_concurrent_bus_arbitration();
    test_ring_buffer_logger();
    std::cout << "All automated repository tests passed successfully!\n";
    return 0;
}
