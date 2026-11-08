#pragma once

#include "CoreMinimal.h"
#include "Nodes/FlowNode.h"
#include "TSMTrainingStep.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
    FTSMTrainingPrompt, FText, Instruction, FString, EvidenceReference);

UCLASS(NotBlueprintable, meta = (DisplayName = "TSM Training Step"))
class TSMTRAINING_API UTSMTrainingStep : public UFlowNode
{
    GENERATED_BODY()

public:
    UTSMTrainingStep();

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "TSM|Training")
    FText Instruction;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "TSM|Training")
    FString EvidenceReference;

    UPROPERTY(BlueprintAssignable, Category = "TSM|Training")
    FTSMTrainingPrompt OnPrompt;

    UPROPERTY(BlueprintReadOnly, Category = "TSM|Training")
    bool bAwaitingAcknowledgement = false;

protected:
    virtual void ExecuteInput(const FName& PinName) override;
    virtual void Cleanup() override;
};
