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
    double x_epsg2966_m;
    double y_epsg2966_m;
    double bfe_ft;
    double lag_ft;
    double stage_delta_ft;
} ArchimedesSiteInput;

typedef struct ArchimedesSiteMetrics {
    double bfe_ft;
    double lag_ft;
    double surface_water_elevation_ft;
} ArchimedesSiteMetrics;

typedef enum ArchimedesStatus {
    ARCHIMEDES_OK = 0,
    ARCHIMEDES_INVALID_ARGUMENT = 1,
    ARCHIMEDES_NON_FINITE_INPUT = 2,
    ARCHIMEDES_INVALID_GEOMETRY = 3
} ArchimedesStatus;

ARCHIMEDES_API ArchimedesStatus ArchimedesEvaluateGeodeticInvariants(
    const ArchimedesSiteInput* input,
    ArchimedesSiteMetrics* output);

ARCHIMEDES_API const char* ArchimedesStatusName(ArchimedesStatus status);

#ifdef __cplusplus
}
#endif
