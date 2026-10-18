#ifndef PHYSICAL_MEMORY_MAPPER_HPP
#define PHYSICAL_MEMORY_MAPPER_HPP

#include <cstdint>
#include <optional>
#include <vector>
#include <cstring>

namespace tristate {

struct MemoryRegion {
    uintptr_t baseAddress;
    size_t size;
};

class PhysicalMemoryMapper {
private:
    MemoryRegion validRegion;
    std::vector<uint8_t> hostBacking;
    bool useHostBacking{false};

    bool inBounds(uintptr_t targetAddress, size_t nbytes) const noexcept {
        if (nbytes == 0) return false;
        if (targetAddress < validRegion.baseAddress) return false;
        const uintptr_t end = validRegion.baseAddress + validRegion.size;
        if (targetAddress > end || nbytes > end - targetAddress) return false;
        return true;
    }

public:
    PhysicalMemoryMapper(uintptr_t base, size_t size)
        : validRegion{base, size}, useHostBacking(false) {}

    static PhysicalMemoryMapper withHostBuffer(uintptr_t logicalBase, size_t size) {
        PhysicalMemoryMapper m(logicalBase, size);
        m.hostBacking.assign(size, 0);
        m.useHostBacking = true;
        return m;
    }

    std::optional<uint32_t> readRegister(uintptr_t targetAddress) const noexcept {
        if (!inBounds(targetAddress, sizeof(uint32_t))) {
            return std::nullopt;
        }
        if (useHostBacking) {
            const size_t offset = static_cast<size_t>(targetAddress - validRegion.baseAddress);
            uint32_t value = 0;
            std::memcpy(&value, hostBacking.data() + offset, sizeof(uint32_t));
            return value;
        }
        auto* ptr = reinterpret_cast<const volatile uint32_t*>(targetAddress);
        return *ptr;
    }

    bool writeRegister(uintptr_t targetAddress, uint32_t value) noexcept {
        if (!inBounds(targetAddress, sizeof(uint32_t))) {
            return false;
        }
        if (useHostBacking) {
            const size_t offset = static_cast<size_t>(targetAddress - validRegion.baseAddress);
            std::memcpy(hostBacking.data() + offset, &value, sizeof(uint32_t));
            return true;
        }
        auto* ptr = reinterpret_cast<volatile uint32_t*>(targetAddress);
        *ptr = value;
        return true;
    }
};

} // namespace tristate

#endif
