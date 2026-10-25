#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "TSMNativeGameMode.generated.h"

class ATSMWorldPartitionStreamingAnchor;

UCLASS()
class TSMNATIVE_API ATSMNativeGameMode final : public AGameModeBase
{
    GENERATED_BODY()

public:
    ATSMNativeGameMode();

    UFUNCTION(BlueprintPure, Category="TSM|WorldPartition")
    ATSMWorldPartitionStreamingAnchor* GetStreamingAnchor() const { return StreamingAnchor.Get(); }

protected:
    virtual void BeginPlay() override;

private:
    UPROPERTY(Transient)
    TObjectPtr<ATSMWorldPartitionStreamingAnchor> StreamingAnchor;
};
