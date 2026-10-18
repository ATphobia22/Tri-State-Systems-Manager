#ifndef TRISTATE_MANAGER_PUBLIC_H
#define TRISTATE_MANAGER_PUBLIC_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

#define TSSM_VERSION_MAJOR 2
#define TSSM_VERSION_MINOR 0
#define TSSM_VERSION_PATCH 0

/* 0 success; positive = domain failure; negative = caller/API error */
#define TSSM_SUCCESS              0
#define TSSM_ERROR_INVALID_PARAM (-1)
#define TSSM_ERROR_ILLEGAL_STATE  1
#define TSSM_ERROR_BUSY           2
#define TSSM_ERROR_OUT_OF_BOUNDS  3
#define TSSM_ERROR_EXCEPTION     (-2)

typedef enum {
    TSSM_STATE_INACTIVE = 0,
    TSSM_STATE_ACTIVE   = 1,
    TSSM_STATE_HIGH_Z   = 2
} tssm_state_t;

typedef enum {
    TSSM_EVENT_ENABLE_ACTIVE = 0,
    TSSM_EVENT_SUSPEND       = 1,
    TSSM_EVENT_ISOLATE       = 2,
    TSSM_EVENT_RESET         = 3
} tssm_event_t;

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

#endif /* TRISTATE_MANAGER_PUBLIC_H */
