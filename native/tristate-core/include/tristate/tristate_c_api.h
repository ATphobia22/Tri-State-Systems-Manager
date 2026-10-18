#ifndef TRISTATE_C_API_H
#define TRISTATE_C_API_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct StateManagerHandle StateManagerHandle;

StateManagerHandle* tssm_create(void);
void tssm_destroy(StateManagerHandle* handle);
int32_t tssm_transition_state(StateManagerHandle* handle, uint8_t event_code);
uint8_t tssm_get_current_state(StateManagerHandle* handle);
int32_t tssm_request_bus_channel(StateManagerHandle* handle, uint8_t channel_idx);
void tssm_release_bus_channel(StateManagerHandle* handle, uint8_t channel_idx);

#ifdef __cplusplus
}
#endif

#endif
