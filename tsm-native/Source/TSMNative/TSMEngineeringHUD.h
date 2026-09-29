#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "TSMEngineeringHUD.generated.h"

UCLASS()
class TSMNATIVE_API ATSMEngineeringHUD final : public AHUD
{
    GENERATED_BODY()

public:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

    UFUNCTION(BlueprintCallable, Category = "TSM|HUD")
    void SetEngineeringPanelsVisible(bool bVisible);

private:
    TSharedPtr<class SWidget> RootWidget;
    TSharedPtr<class SWidget> CollapsedWidget;
    bool bPanelsVisible = true;
};
