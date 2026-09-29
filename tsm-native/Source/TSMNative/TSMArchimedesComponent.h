#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "TSMArchimedesComponent.generated.h"

USTRUCT(BlueprintType)
struct FTSMArchimedesSiteInput
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="TSM|Engineering")
    double X_EPSG2966_FtUS = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="TSM|Engineering")
    double Y_EPSG2966_FtUS = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="TSM|Engineering")
    double BFE_Ft = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="TSM|Engineering")
    double LAG_Ft = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="TSM|Engineering")
    double StageDelta_Ft = 0.0;
};

USTRUCT(BlueprintType)
struct FTSMArchimedesSiteMetrics
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category="TSM|Engineering")
    double BFE_Ft = 0.0;

    UPROPERTY(BlueprintReadOnly, Category="TSM|Engineering")
    double LAG_Ft = 0.0;

    UPROPERTY(BlueprintReadOnly, Category="TSM|Engineering")
    double SurfaceWaterElevation_Ft = 0.0;

    UPROPERTY(BlueprintReadOnly, Category="TSM|Engineering")
    bool bInundationActive = false;
};

USTRUCT(BlueprintType)
struct FTSMArchimedesSaintVenantConfig
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="TSM|Hydraulics")
    double CellWidth_Ft = 1.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="TSM|Hydraulics")
    double BedSlope = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="TSM|Hydraulics")
    double ManningsN = 0.03;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="TSM|Hydraulics")
    double Gravity_FtPerSec2 = 32.174;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="TSM|Hydraulics", meta=(ClampMin="0.01", ClampMax="1.0"))
    double CFL = 0.8;
};

UCLASS(ClassGroup=(TSM), meta=(BlueprintSpawnableComponent))
class TSMNATIVE_API UTSMArchimedesComponent final : public UActorComponent
{
    GENERATED_BODY()

public:
    UTSMArchimedesComponent();
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

    UFUNCTION(BlueprintCallable, Category="TSM|Engineering")
    bool InitializeArchimedes(const FString& LibraryPath, FString& ErrorMessage);

    UFUNCTION(BlueprintCallable, Category="TSM|Engineering")
    void ShutdownArchimedes();

    UFUNCTION(BlueprintPure, Category="TSM|Engineering")
    bool IsArchimedesLoaded() const;

    UFUNCTION(BlueprintCallable, Category="TSM|Engineering")
    bool EvaluateSite(const FTSMArchimedesSiteInput& Input, FTSMArchimedesSiteMetrics& Output, FString& ErrorMessage);

    UFUNCTION(BlueprintCallable, Category="TSM|Hydraulics")
    bool StepSaintVenant(const FTSMArchimedesSaintVenantConfig& Config, UPARAM(ref) TArray<double>& DepthFt, UPARAM(ref) TArray<double>& VelocityFps, double DeltaSeconds, FString& ErrorMessage);

private:
    class FArchimedesRuntime* Runtime = nullptr;
};
