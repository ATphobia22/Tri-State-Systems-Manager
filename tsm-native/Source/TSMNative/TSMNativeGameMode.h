#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
class ATSMWorldPartitionStreamingAnchor;
#include "TSMNativeGameMode.generated.h"

UCLASS()
class TSMNATIVE_API ATSMNativeGameMode final : public AGameModeBase
{
    GENERATED_BODY()

public:
    ATSMNativeGameMode();

    UFUNCTION(BlueprintPure, Category="TSM|WorldPartition")
    ATSMWorldPartitionStreamingAnchor* GetStreamingAnchor() const { return StreamingAnchor; }

protected:
    virtual void BeginPlay() override;

private:
    UPROPERTY(Transient)
    TObjectPtr<ATSMWorldPartitionStreamingAnchor> StreamingAnchor;
};
