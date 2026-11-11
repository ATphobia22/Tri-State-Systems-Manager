#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "TSMSceneLayerSubsystem.generated.h"

/** Native runtime scene layer: missing source data remains explicitly unavailable. */
UENUM(BlueprintType)
enum class ETSMSceneLayer : uint8
{
    Terrain, Imagery, Buildings, Roads, Parcels, Floodplain,
    SanitarySewer, StormSewer, PotableWater, Electric, Gas, Telecom,
    HydraulicResults, ProposedConstruction
};

USTRUCT(BlueprintType)
struct FTSMSceneLayerState
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly) ETSMSceneLayer Layer = ETSMSceneLayer::Terrain;
    UPROPERTY(BlueprintReadOnly) bool bRequestedVisible = false;
    UPROPERTY(BlueprintReadOnly) bool bSourceVerified = false;
    UPROPERTY(BlueprintReadOnly) bool bRenderedVisible = false;
    UPROPERTY(BlueprintReadOnly) FString SourceId;
    UPROPERTY(BlueprintReadOnly) FString SourceSha256;
    UPROPERTY(BlueprintReadOnly) FString Status = TEXT("SOURCE_UNAVAILABLE");
};

/** Actors register to this subsystem when source geometry is actually present. */
UCLASS()
class TSMNATIVE_API UTSMSceneLayerSubsystem final : public UWorldSubsystem
{
    GENERATED_BODY()
public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;

    UFUNCTION(BlueprintCallable, Category="TSM|Scene")
    void SetLayerVisibility(ETSMSceneLayer Layer, bool bVisible);

    UFUNCTION(BlueprintCallable, Category="TSM|Scene")
    bool RegisterLayerActor(ETSMSceneLayer Layer, AActor* Actor,
                            const FString& SourceId, const FString& SourceSha256,
                            bool bSourceVerified);

    UFUNCTION(BlueprintCallable, Category="TSM|Scene")
    void UnregisterLayerActor(AActor* Actor);

    UFUNCTION(BlueprintPure, Category="TSM|Scene")
    FTSMSceneLayerState GetLayerState(ETSMSceneLayer Layer) const;

    UFUNCTION(BlueprintCallable, Category="TSM|Scene")
    bool SaveVisibilityProfile(const FString& ProfileName) const;

    UFUNCTION(BlueprintCallable, Category="TSM|Scene")
    bool LoadVisibilityProfile(const FString& ProfileName);

private:
    struct FLayerActor
    {
        TWeakObjectPtr<AActor> Actor;
        FString SourceId;
        FString SourceSha256;
        bool bVerified = false;
    };
    TMap<ETSMSceneLayer, bool> Visibility;
    TMap<ETSMSceneLayer, TArray<FLayerActor>> Actors;
    void Refresh(ETSMSceneLayer Layer);
    static bool IsSafeProfileName(const FString& Name);
};
