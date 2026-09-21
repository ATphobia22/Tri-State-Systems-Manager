#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TSMGeodeticViewport.generated.h"
class UStaticMeshComponent; class USceneComponent; class FArchimedesRuntime; class FTSMEmbeddedStore;
UCLASS() class TSMNATIVE_API ATSMGeodeticViewport final : public AActor {
 GENERATED_BODY()
public: ATSMGeodeticViewport();
protected: virtual void BeginPlay() override; virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override; virtual void Tick(float DeltaTime) override;
private:
 bool LoadAndEvaluateSite(); bool StepHydroSimulation(double DeltaSeconds); void PublishHydroState();
 UPROPERTY(VisibleAnywhere,Category="TSM|Terrain") TObjectPtr<UStaticMeshComponent> TerrainRoot;
 UPROPERTY(VisibleAnywhere,Category="TSM|Hydrology") TObjectPtr<USceneComponent> WaterSurface;
 UPROPERTY(EditAnywhere,Category="TSM|Data") FString DatabaseRelativePath=TEXT("Content/Data/tsm-native.sqlite");
 UPROPERTY(EditAnywhere,Category="TSM|Data") FString SiteKey;
 UPROPERTY(EditAnywhere,Category="TSM|Data") int32 ExpectedHorizontalSrid=2966;
 UPROPERTY(EditAnywhere,Category="TSM|Data") FString ExpectedVerticalDatum;
 UPROPERTY(EditAnywhere,Category="TSM|Runtime") FString ArchimedesLibraryRelativePath;
 UPROPERTY(EditAnywhere,Category="TSM|Runtime") FString SpatiaLiteLibraryRelativePath;
 UPROPERTY(EditAnywhere,Category="TSM|Hydrology") int32 HydroCellCount=128;
 UPROPERTY(EditAnywhere,Category="TSM|Hydrology") double HydroCellWidthFt=10.0;
 UPROPERTY(EditAnywhere,Category="TSM|Hydrology") double HydroBedSlope=0.0002;
 UPROPERTY(EditAnywhere,Category="TSM|Hydrology") double HydroManningsN=0.035;
 UPROPERTY(EditAnywhere,Category="TSM|Hydrology") double HydroGravityFtS2=32.174;
 UPROPERTY(EditAnywhere,Category="TSM|Hydrology") double HydroCfl=0.8;
 UPROPERTY(EditAnywhere,Category="TSM|Hydrology") double HydroStepSeconds=0.05;
 UPROPERTY(EditAnywhere,Category="TSM|Rendering") double FeetToCentimeters=30.48;
 TUniquePtr<FArchimedesRuntime> Runtime; TUniquePtr<FTSMEmbeddedStore> Store; TArray<double> HydroDepthFt; TArray<double> HydroVelocityFps; double HydroAccumulatorSeconds=0.0;
};