#include "TSMTrainingStep.h"

UTSMTrainingStep::UTSMTrainingStep()
{
    InputPins.Empty();
    InputPins.Add(FFlowPin(TEXT("Start")));
    InputPins.Add(FFlowPin(TEXT("Acknowledge")));
    InputPins.Add(FFlowPin(TEXT("Cancel")));
    OutputPins.Empty();
    OutputPins.Add(FFlowPin(TEXT("Completed")));
    OutputPins.Add(FFlowPin(TEXT("Cancelled")));
}

void UTSMTrainingStep::ExecuteInput(const FName& PinName)
{
    if (PinName == TEXT("Start"))
    {
        if (!bAwaitingAcknowledgement)
        {
            bAwaitingAcknowledgement = true;
            OnPrompt.Broadcast(Instruction, EvidenceReference);
        }
        return;
    }
    if (!bAwaitingAcknowledgement)
    {
        return;
    }
    if (PinName == TEXT("Cancel") || PinName == TEXT("Acknowledge"))
    {
        bAwaitingAcknowledgement = false;
        TriggerOutput(PinName == TEXT("Cancel") ? TEXT("Cancelled") : TEXT("Completed"), true);
    }
}

void UTSMTrainingStep::Cleanup()
{
    bAwaitingAcknowledgement = false;
    Super::Cleanup();
}
