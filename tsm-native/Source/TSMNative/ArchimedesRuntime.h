#pragma once
#include "CoreMinimal.h"
#include "ArchimedesNative.h"
struct FTSMSiteMetrics { double BfeFt=0.0; double LagFt=0.0; double SurfaceWaterElevationFt=0.0; bool bInundationActive=false; };
class FArchimedesRuntime final {
public:
 bool Load(const FString& LibraryPath,FString& OutError); void Unload();
 bool Evaluate(const ArchimedesSiteInput& Input,FTSMSiteMetrics& OutMetrics,FString& OutError) const;
 bool StepSaintVenant(const ArchimedesSaintVenantConfig& Config,TArray<double>& DepthFt,TArray<double>& VelocityFps,double DeltaSeconds,FString& OutError) const;
private:
 void* LibraryHandle=nullptr;
 ArchimedesStatus (*EvaluateFn)(const ArchimedesSiteInput*,ArchimedesSiteMetrics*)=nullptr;
 ArchimedesStatus (*SaintVenantFn)(const ArchimedesSaintVenantConfig*,double*,double*,int,double)=nullptr;
 const char* (*StatusNameFn)(ArchimedesStatus)=nullptr;
};