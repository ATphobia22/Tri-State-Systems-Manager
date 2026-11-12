#include "TSMEngineeringHUD.h"

#include "Engine/Engine.h"
#include "Styling/CoreStyle.h"
#include "Engine/GameInstance.h"
#include "HAL/FileManager.h"
#include "Misc/Paths.h"
#include "TSMEngineeringRuntimeSubsystem.h"
#include "TSMExperienceSubsystem.h"
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
                        .Text(FText::FromString(TEXT("100-YEAR EVIDENCE")))
                        .OnClicked(this, &STSMEngineeringDashboard::Run100Year)
                    ]
                    + SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 8, 0)
                    [
                        SNew(SButton)
                        .Text(FText::FromString(TEXT("LOCAL DATA")))
                        .OnClicked(this, &STSMEngineeringDashboard::ShowLocalData)
                    ]
                    + SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 8, 0)
                    [
                        SNew(SButton)
                        .Text(FText::FromString(TEXT("ENGINEERING LIMITS")))
                        .OnClicked(this, &STSMEngineeringDashboard::ShowLimitations)
                    ]
                    + SHorizontalBox::Slot().AutoWidth()
                    [
                        SNew(SButton)
                        .Text(FText::FromString(TEXT("COLLAPSE HUD")))
                        .OnClicked(this, &STSMEngineeringDashboard::Collapse)
                    ]
                ]
                + SVerticalBox::Slot().AutoHeight().Padding(0, 8, 0, 0)
                [
                    SNew(SHorizontalBox)
                    + SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 8, 0)
                    [
                        SNew(SButton)
                        .Text(FText::FromString(TEXT("LIVING RIVER VALLEY")))
                        .OnClicked(this, &STSMEngineeringDashboard::OpenLivingRiver)
                    ]
                    + SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 8, 0)
                    [
                        SNew(SButton)
                        .Text(FText::FromString(TEXT("SCENARIO SANDBOX")))
                        .OnClicked(this, &STSMEngineeringDashboard::OpenScenarioSandbox)
                    ]
                    + SHorizontalBox::Slot().AutoWidth()
                    [
                        SNew(SButton)
                        .Text(FText::FromString(TEXT("EVIDENCE STORYBOARD")))
                        .OnClicked(this, &STSMEngineeringDashboard::OpenEvidenceStoryboard)
                    ]
                ]
                + SVerticalBox::Slot().AutoHeight().Padding(0, 10, 0, 0)
                [
                    SNew(STextBlock).Text(FText::FromString(TEXT("CITY SYSTEMS // INFRASTRUCTURE & DESIGN")))
                ]
                + SVerticalBox::Slot().AutoHeight().Padding(0, 6)
                [
                    SNew(SHorizontalBox)
                    + SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 6, 0)
                    [
                        SNew(SButton).Text(FText::FromString(TEXT("UTILITY LAYERS")))
                        .OnClicked(this, &STSMEngineeringDashboard::ShowUtilityLayers)
                    ]
                    + SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 6, 0)
                    [
                        SNew(SButton).Text(FText::FromString(TEXT("CITY MATERIALS")))
                        .OnClicked(this, &STSMEngineeringDashboard::ShowCityMaterials)
                    ]
                    + SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 6, 0)
                    [
                        SNew(SButton).Text(FText::FromString(TEXT("WEATHER & LIGHTING")))
                        .OnClicked(this, &STSMEngineeringDashboard::ShowWeatherSettings)
                    ]
                    + SHorizontalBox::Slot().AutoWidth()
                    [
                        SNew(SButton).Text(FText::FromString(TEXT("EVIDENCE / GRANTS")))
                        .OnClicked(this, &STSMEngineeringDashboard::ShowEvidenceWorkflow)
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
    UTSMExperienceSubsystem* Experience() const
    {
        if (!OwnerHUD.IsValid()) { return nullptr; }
        const UGameInstance* Instance = OwnerHUD->GetGameInstance();
        return Instance ? Instance->GetSubsystem<UTSMExperienceSubsystem>() : nullptr;
    }

    FReply OpenLivingRiver()
    {
        if (UTSMExperienceSubsystem* Subsystem = Experience())
        {
            Subsystem->SetWorkspace(ETSMExperienceWorkspace::LivingRiverValley);
            const FTSMLivingRiverState Scene = Subsystem->InspectLivingRiverValley(
                ETSMExperienceClock::Cinematic, FDateTime::UtcNow().ToIso8601());
            ResultText->SetText(FText::FromString(FString::Printf(
                TEXT("LIVING RIVER // %s\\nLocal snapshot: %s\\n")
                TEXT("Clock: cinematic (not observation). Manifest presence alone is not integrity verification."),
                *Scene.DataState, *Scene.DataRoot)));
        }
        return FReply::Handled();
    }

    FReply OpenScenarioSandbox()
    {
        if (UTSMExperienceSubsystem* Subsystem = Experience())
        {
            Subsystem->SetWorkspace(ETSMExperienceWorkspace::EngineeringScenarioSandbox);
            // No site measurements or placeholder rainfall are passed as real inputs.
            const FTSMScenarioScreenInput MissingInputs;
            const FTSMScenarioScreenResult Result = Subsystem->ScreenBermConcept(MissingInputs);
            ResultText->SetText(FText::FromString(FString::Printf(
                TEXT("SCENARIO SANDBOX // %s\\n")
                TEXT("Requires source SHA-256, CRS, vertical datum and operator-entered SI geometry. ")
                TEXT("Bind through the Blueprint-callable experience subsystem; no scenario was simulated."),
                *Result.Status)));
        }
        return FReply::Handled();
    }

    FReply OpenEvidenceStoryboard()
    {
        if (UTSMExperienceSubsystem* Subsystem = Experience())
        {
            Subsystem->SetWorkspace(ETSMExperienceWorkspace::EvidenceToCinemaStoryboard);
            ResultText->SetText(FText::FromString(TEXT(
                "EVIDENCE STORYBOARD // REVIEW_REQUIRED\\n")
                TEXT("Add source-attributed shots and cinematic-only shots using the native ")
                TEXT("experience subsystem. Export produces a JSON shot plan, not a rendered film, ")
                TEXT("and cannot certify source content or alter model outputs.")));
        }
        return FReply::Handled();
    }

    FReply ShowUtilityLayers()
    {
        if (ResultText.IsValid())
        {
            ResultText->SetText(FText::FromString(TEXT(
                "UTILITY & CONSTRUCTION LAYER CATALOG\\n"
                "Storm sewer | sanitary sewer | potable water | electric | gas | telecom | drainage | "
                "roads | right-of-way | parcels | proposed construction.\\n"
                "These are layer categories, NOT verified utility locations. Import survey/as-built GIS "
                "with horizontal CRS, vertical datum, units, authority and SHA-256 before displaying "
                "real infrastructure. No excavation clearance or design approval is implied.")));
        }
        return FReply::Handled();
    }

    FReply ShowCityMaterials()
    {
        if (ResultText.IsValid())
        {
            ResultText->SetText(FText::FromString(TEXT(
                "MOUNT VERNON // CITY MATERIALS & VISUAL FIDELITY\\n"
                "Road surfaces, building facade materials, roof geometry, street furniture, "
                "riverfront, sidewalks and vegetation require licensed, georeferenced source assets. "
                "Missing assets must display as UNVERIFIED VISUAL PROXY, not photogrammetric truth. "
                "Native UE scene materials and streaming must be checked in a headed GPU run.")));
        }
        return FReply::Handled();
    }

    FReply ShowWeatherSettings()
    {
        if (ResultText.IsValid())
        {
            ResultText->SetText(FText::FromString(TEXT(
                "CINEMATIC WEATHER & LIGHTING // VISUAL CONTROLS\\n"
                "Day/night, precipitation particles, cloud layers, fog, reflections, wind and "
                "storm lighting belong to the Unreal headed renderer. "
                "Weather animation is cinematic until bound to time-stamped observations; "
                "no forecast, flood depth or rainfall rate is implied. "
                "This panel is a configuration guide; it does not change active GPU effects.")));
        }
        return FReply::Handled();
    }

    FReply ShowEvidenceWorkflow()
    {
        if (ResultText.IsValid())
        {
            ResultText->SetText(FText::FromString(TEXT(
                "HEADLESS EVIDENCE / GRANT PACKAGING\\n"
                "Export provenance-aware registers using scripts/native/export-engineering-evidence-pdf.py "
                "--input evidence.json --output evidence.pdf. "
                "A PDF is a review artifact, not a verified blueprint, grant award, "
                "regulatory determination or construction approval. "
                "Each VERIFIED record requires source SHA-256, acquisition UTC, CRS, "
                "vertical datum, units and verification method.")));
        }
        return FReply::Handled();
    }

    FReply Run100Year()
    {
        // Never evaluate FTSMEngineeringInputs' illustrative defaults as an
        // observed 100-year water surface or a site-specific engineering design.
        // A verified scenario binding must be supplied before enabling a solver.
        if (ResultText.IsValid())
        {
            ResultText->SetText(FText::FromString(TEXT(
                "SOURCE_UNAVAILABLE // 100-YEAR RUN NOT AUTHORIZED\\n"
                "No verified rainfall, calibrated hydraulics, WSE NAVD88 or parcel-based "
                "scenario evidence is bound to this native HUD. No flood elevations "
                "or quantities have been computed. Human authority remains final.")));
        }
        return FReply::Handled();
    }

    FReply ShowLocalData()
    {
        if (!ResultText.IsValid()) { return FReply::Handled(); }
        const FString Manifest = FPaths::Combine(
            FPaths::ProjectContentDir(), TEXT("TSMData"), TEXT("data-manifest.json"));
        if (IFileManager::Get().FileExists(*Manifest))
        {
            ResultText->SetText(FText::FromString(TEXT(
                "LOCAL DATA PRESENT // INTEGRITY NOT YET VERIFIED HERE\\n"
                "A packaged TSMData manifest is present. Inspect its SHA-256 validation, "
                "EPSG/vertical datum, source date, license and tile coverage before "
                "authorizing engineering conclusions.")));
        }
        else
        {
            ResultText->SetText(FText::FromString(TEXT(
                "SOURCE_UNAVAILABLE // NO PACKAGED DATA MANIFEST\\n"
                "No verified TSMData snapshot is accessible. Cinematic placeholders "
                "must never be treated as surveying or hydraulic observations.")));
        }
        return FReply::Handled();
    }

    FReply ShowLimitations()
    {
        if (ResultText.IsValid())
        {
            ResultText->SetText(FText::FromString(TEXT(
                "ENGINEERING LIMITS\\n"
                "Local visualization is informational. Flood levels, profiles, parcel "
                "coordinates and 100-/500-year events require validated source provenance, "
                "datum transforms, calibrated models and human review. No automatic agency filings.")));
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

    CollapsedWidget = SNew(SButton)
        .Text(FText::FromString(TEXT("TSM  •  OPEN ENGINEERING HUD")))
        .OnClicked(FOnClicked::CreateLambda([this]()
        {
            SetEngineeringPanelsVisible(true);
            return FReply::Handled();
        }));

    if (GEngine && GEngine->GameViewport)
    {
        GEngine->GameViewport->AddViewportWidgetContent(RootWidget.ToSharedRef(), 10);
        GEngine->GameViewport->AddViewportWidgetContent(CollapsedWidget.ToSharedRef(), 11);
        CollapsedWidget->SetVisibility(EVisibility::Collapsed);
    }
}

void ATSMEngineeringHUD::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (GEngine && GEngine->GameViewport)
    {
        if (RootWidget.IsValid())
        {
            GEngine->GameViewport->RemoveViewportWidgetContent(RootWidget.ToSharedRef());
        }
        if (CollapsedWidget.IsValid())
        {
            GEngine->GameViewport->RemoveViewportWidgetContent(CollapsedWidget.ToSharedRef());
        }
    }

    RootWidget.Reset();
    CollapsedWidget.Reset();
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

    if (CollapsedWidget.IsValid())
    {
        CollapsedWidget->SetVisibility(
            bVisible ? EVisibility::Collapsed : EVisibility::Visible);
    }
}
