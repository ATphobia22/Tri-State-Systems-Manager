#include "tristate/tristate_c_api.h"
#include "core/state_manager.hpp"
#include "core/bus_arbitrator.hpp"

struct StateManagerHandle {
    tristate::TriStateController controller;
    tristate::BusArbitrator arbitrator;
};

extern "C" {

StateManagerHandle* tssm_create(void) {
    try {
        return new StateManagerHandle();
    } catch (...) {
        return nullptr;
    }
}

void tssm_destroy(StateManagerHandle* handle) {
    delete handle;
}

int32_t tssm_transition_state(StateManagerHandle* handle, uint8_t event_code) {
    if (!handle) return -1;
    if (event_code > 3) return -1;
    try {
        const auto event = static_cast<tristate::SystemEvent>(event_code);
        const bool success = handle->controller.handleEvent(event);
        return success ? 0 : 1;
    } catch (...) {
        return -2;
    }
}

uint8_t tssm_get_current_state(StateManagerHandle* handle) {
    if (!handle) return 0;
    return static_cast<uint8_t>(handle->controller.getState());
}

int32_t tssm_request_bus_channel(StateManagerHandle* handle, uint8_t channel_idx) {
    if (!handle || channel_idx > 3) return -1;
    const bool granted =
        handle->arbitrator.requestAccess(static_cast<tristate::BusChannel>(channel_idx));
    return granted ? 0 : 1;
}

void tssm_release_bus_channel(StateManagerHandle* handle, uint8_t channel_idx) {
    if (!handle || channel_idx > 3) return;
    handle->arbitrator.releaseAccess(static_cast<tristate::BusChannel>(channel_idx));
}

} // extern "C"
