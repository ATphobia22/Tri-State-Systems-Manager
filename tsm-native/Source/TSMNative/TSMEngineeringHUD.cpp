#include "TSMEngineeringHUD.h"

#include "Engine/Engine.h"
#include "Styling/CoreStyle.h"
#include "Engine/GameInstance.h"
#include "TSMEngineeringRuntimeSubsystem.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Text/STextBlock.h"

namespace
{
class STSMEngineeringDashboard final : public SCompoundWidget
{
public:
    SLATE_BEGIN_ARGS(STSMEngineeringDashboard) {}
        SLATE_ARGUMENT(TWeakObjectPtr<ATSMEngineeringHUD>, OwnerHUD)
    SLATE_END_ARGS()

    void Construct(const FArguments& InArgs)
    {
        OwnerHUD = InArgs._OwnerHUD;

        ChildSlot
        [
            SNew(SBorder)
            .Padding(18.0f)
            [
                SNew(SVerticalBox)
                + SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 10)
                [
                    SNew(STextBlock)
                    .Text(FText::FromString(TEXT("TSM // ENGINEERING MASTERCLASS")))
                    .Font(FCoreStyle::GetDefaultFontStyle("Bold", 22))
                ]
                + SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 8)
                [
                    SNew(STextBlock)
                    .Text(FText::FromString(
                        TEXT("DIGITAL TWIN  •  HYDROLOGY  •  HYDRAULICS  •  TERRAIN  •  EVIDENCE")))
                ]
                + SVerticalBox::Slot().AutoHeight().Padding(0, 4)
                [
                    SNew(SHorizontalBox)
                    + SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 8, 0)
                    [
                        SNew(SButton)
                        .Text(FText::FromString(TEXT("RUN 100-YEAR")))
                        .OnClicked(this, &STSMEngineeringDashboard::Run100Year)
                    ]
                    + SHorizontalBox::Slot().AutoWidth()
                    [
                        SNew(SButton)
                        .Text(FText::FromString(TEXT("COLLAPSE HUD")))
                        .OnClicked(this, &STSMEngineeringDashboard::Collapse)
                    ]
                ]
                + SVerticalBox::Slot().AutoHeight().Padding(0, 12, 0, 0)
                [
                    SAssignNew(ResultText, STextBlock)
                    .Text(FText::FromString(
                        TEXT("Ready. Select a scenario to evaluate the local digital twin.")))
                ]
            ]
        ];
    }

private:
    FReply Run100Year()
    {
        if (!OwnerHUD.IsValid())
        {
            return FReply::Handled();
        }

        if (UGameInstance* GameInstance = OwnerHUD->GetGameInstance())
        {
            if (UTSMEngineeringRuntimeSubsystem* Runtime =
                GameInstance->GetSubsystem<UTSMEngineeringRuntimeSubsystem>())
            {
                FTSMEngineeringInputs Inputs;
                const FTSMEngineeringResult Result =
                    Runtime->EvaluateScenario(Inputs, ETSMFloodScenario::Design100Year);

                const FString Summary = FString::Printf(
                    TEXT("100-YEAR SCREENING RESULT\nPeak flow: %.2f m^3/s\nManning capacity: %.2f m^3/s\nFlood depth: %.2f m\nRequired design elevation: %.2f m\nBerm fill: %.0f m^3"),
                    Result.RationalPeakFlowCubicMetersPerSecond,
                    Result.ManningCapacityCubicMetersPerSecond,
                    Result.FloodDepthMeters,
                    Result.RequiredDesignElevationMeters,
                    Result.BermFillVolumeCubicMeters);

                ResultText->SetText(FText::FromString(Summary));
            }
        }

        return FReply::Handled();
    }

    FReply Collapse()
    {
        if (OwnerHUD.IsValid())
        {
            OwnerHUD->SetEngineeringPanelsVisible(false);
        }
        return FReply::Handled();
    }

    TWeakObjectPtr<ATSMEngineeringHUD> OwnerHUD;
    TSharedPtr<STextBlock> ResultText;
};
}

void ATSMEngineeringHUD::BeginPlay()
{
    Super::BeginPlay();

    RootWidget = SNew(STSMEngineeringDashboard).OwnerHUD(this);
    if (GEngine && GEngine->GameViewport)
    {
        GEngine->GameViewport->AddViewportWidgetContent(RootWidget.ToSharedRef(), 10);
    }
}

void ATSMEngineeringHUD::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (GEngine && GEngine->GameViewport && RootWidget.IsValid())
    {
        GEngine->GameViewport->RemoveViewportWidgetContent(RootWidget.ToSharedRef());
    }

    RootWidget.Reset();
    Super::EndPlay(EndPlayReason);
}

void ATSMEngineeringHUD::SetEngineeringPanelsVisible(const bool bVisible)
{
    bPanelsVisible = bVisible;

    if (RootWidget.IsValid())
    {
        RootWidget->SetVisibility(
            bVisible ? EVisibility::Visible : EVisibility::Collapsed);
    }
}
