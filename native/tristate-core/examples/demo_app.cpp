#include <iostream>
#include <cstdint>

#include "tristate_manager.h"

/** 16-bit 5D word: T in bits 10-12. Under VRAM pressure, force T=1 (procedural). */
static uint16_t evaluate_state_word(uint16_t current_word, float vram_ratio) {
    constexpr uint16_t texture_mask = 0b0001110000000000;
    if (vram_ratio > 0.80f) {
        current_word = static_cast<uint16_t>(current_word & ~texture_mask);
        current_word = static_cast<uint16_t>(current_word | (1u << 10));
    }
    return current_word;
}

int main() {
    std::cout << "=========================================\n";
    std::cout << " Tri-State Systems Manager v"
              << TSSM_VERSION_MAJOR << "."
              << TSSM_VERSION_MINOR << "."
              << TSSM_VERSION_PATCH << "\n";
    std::cout << "=========================================\n";

    StateManagerHandle* handle = tssm_create();
    if (!handle) {
        std::cerr << "Failed to allocate system handle.\n";
        return 1;
    }

    std::cout << "Current State: " << static_cast<int>(tssm_get_current_state(handle)) << "\n";

    std::cout << "Transitioning to Active...\n";
    const int32_t res = tssm_transition_state(handle, TSSM_EVENT_ENABLE_ACTIVE);
    std::cout << "Result: " << (res == TSSM_SUCCESS ? "SUCCESS" : "FAILED") << "\n";
    std::cout << "New State: " << static_cast<int>(tssm_get_current_state(handle)) << "\n";

    std::cout << "Isolating System (High-Z)...\n";
    tssm_transition_state(handle, TSSM_EVENT_ISOLATE);
    std::cout << "New State: " << static_cast<int>(tssm_get_current_state(handle)) << "\n";

    if (tssm_request_bus_channel(handle, 0) == TSSM_SUCCESS) {
        std::cout << "Bus channel 0 granted.\n";
        tssm_release_bus_channel(handle, 0);
        std::cout << "Bus channel 0 released.\n";
    }

    const uint16_t initial = 0b0111111111111111;
    const uint16_t degraded = evaluate_state_word(initial, 0.92f);
    std::cout << std::hex;
    std::cout << "Initial State Word:  0x" << initial << "\n";
    std::cout << "Degraded State Word: 0x" << degraded << "\n";
    std::cout << std::dec;

    tssm_destroy(handle);
    std::cout << "System shutdown completed cleanly.\n";
    return 0;
}
