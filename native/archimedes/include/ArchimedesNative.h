#pragma once

#if defined(_WIN32)
  #if defined(ARCHIMEDESCORE_BUILD)
    #define ARCHIMEDES_API __declspec(dllexport)
  #else
    #define ARCHIMEDES_API __declspec(dllimport)
  #endif
#else
  #define ARCHIMEDES_API __attribute__((visibility("default")))
#endif

#ifdef __cplusplus
extern "C" {
#endif

typedef struct ArchimedesSiteInput {
    double x_epsg2966_ftus;
    double y_epsg2966_ftus;
    double bfe_ft;
    double lag_ft;
    double stage_delta_ft;
} ArchimedesSiteInput;

typedef struct ArchimedesSiteMetrics {
    double bfe_ft;
    double lag_ft;
    double surface_water_elevation_ft;
    int inundation_active;
} ArchimedesSiteMetrics;

typedef struct ArchimedesSaintVenantConfig {
    double cell_width_ft;
    double bed_slope;
    double mannings_n;
    double gravity_ft_s2;
    double cfl;
} ArchimedesSaintVenantConfig;

typedef enum ArchimedesStatus {
    ARCHIMEDES_OK = 0,
    ARCHIMEDES_INVALID_ARGUMENT = 1,
    ARCHIMEDES_NON_FINITE_INPUT = 2,
    ARCHIMEDES_INVALID_GEOMETRY = 3,
    ARCHIMEDES_UNSTABLE_TIMESTEP = 4,
    ARCHIMEDES_DRY_STATE = 5
} ArchimedesStatus;

ARCHIMEDES_API ArchimedesStatus ArchimedesEvaluateGeodeticInvariants(
    const ArchimedesSiteInput* input,
    ArchimedesSiteMetrics* output);

ARCHIMEDES_API ArchimedesStatus ArchimedesSolveSaintVenant1D(
    const ArchimedesSaintVenantConfig* config,
    double* depth_ft,
    double* velocity_fps,
    int cell_count,
    double dt_seconds);

ARCHIMEDES_API const char* ArchimedesStatusName(ArchimedesStatus status);

#ifdef __cplusplus
}
#endif
