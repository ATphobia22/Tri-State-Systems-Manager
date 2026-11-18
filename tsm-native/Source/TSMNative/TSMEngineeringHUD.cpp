#include "TSMEngineeringHUD.h"

#include "Engine/Engine.h"
#include "Styling/CoreStyle.h"
#include "Engine/GameInstance.h"
#include "HAL/FileManager.h"
#include "Misc/Paths.h"
#include "Containers/StringConv.h"
#include "Misc/FileHelper.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Dom/JsonValue.h"
#include "Serialization/JsonWriter.h"
#include "TsmSha256.h"
#include "TSMEngineeringRuntimeSubsystem.h"
#include "TSMExperienceSubsystem.h"
#include "TSMSceneLayerSubsystem.h"
#include "Engine/World.h"
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
                    + SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 6, 0)
                    [
                        SNew(SButton).Text(FText::FromString(TEXT("EVIDENCE / GRANTS")))
                        .OnClicked(this, &STSMEngineeringDashboard::ShowEvidenceWorkflow)
                    ]
                    + SHorizontalBox::Slot().AutoWidth()
                    [
                        SNew(SButton).Text(FText::FromString(TEXT("EXPORT PASSPORT JSON")))
                        .OnClicked(this, &STSMEngineeringDashboard::ExportCivicPassport)
                    ]
                ]
                + SVerticalBox::Slot().AutoHeight().Padding(0, 8)
                [
                    SNew(SHorizontalBox)
                    + SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 8, 0)
                    [
                        SNew(SButton).Text(FText::FromString(TEXT("BUILDINGS")))
                        .OnClicked(this, &STSMEngineeringDashboard::ToggleBuildings)
                    ]
                    + SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 8, 0)
                    [
                        SNew(SButton).Text(FText::FromString(TEXT("FLOODPLAIN")))
                        .OnClicked(this, &STSMEngineeringDashboard::ToggleFloodplain)
                    ]
                    + SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 8, 0)
                    [
                        SNew(SButton).Text(FText::FromString(TEXT("UTILITIES")))
                        .OnClicked(this, &STSMEngineeringDashboard::ToggleUtilities)
                    ]
                    + SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 8, 0)
                    [
                        SNew(SButton).Text(FText::FromString(TEXT("SAVE LAYERS")))
                        .OnClicked(this, &STSMEngineeringDashboard::SaveLayers)
                    ]
                    + SHorizontalBox::Slot().AutoWidth()
                    [
                        SNew(SButton).Text(FText::FromString(TEXT("LOAD LAYERS")))
                        .OnClicked(this, &STSMEngineeringDashboard::LoadLayers)
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

    UTSMSceneLayerSubsystem* SceneLayers() const
    {
        if (!OwnerHUD.IsValid() || !OwnerHUD->GetWorld()) return nullptr;
        return OwnerHUD->GetWorld()->GetSubsystem<UTSMSceneLayerSubsystem>();
    }

    FReply ToggleOneLayer(ETSMSceneLayer Layer, const TCHAR* LayerName)
    {
        if (UTSMSceneLayerSubsystem* Subsystem = SceneLayers())
        {
            const bool bNewVisible = !Subsystem->GetLayerState(Layer).bRequestedVisible;
            Subsystem->SetLayerVisibility(Layer, bNewVisible);
            const FTSMSceneLayerState State = Subsystem->GetLayerState(Layer);
            if (ResultText.IsValid())
            {
                ResultText->SetText(FText::FromString(FString::Printf(
                    TEXT("%s // %s\\n%s\\nActor visibility changed; this does not load missing GIS evidence."),
                    LayerName, bNewVisible ? TEXT("ON") : TEXT("OFF"), *State.Status)));
            }
        }
        return FReply::Handled();
    }

    FReply ToggleBuildings() { return ToggleOneLayer(ETSMSceneLayer::Buildings, TEXT("BUILDINGS")); }
    FReply ToggleFloodplain() { return ToggleOneLayer(ETSMSceneLayer::Floodplain, TEXT("FLOODPLAIN")); }
    FReply ToggleUtilities()
    {
        if (UTSMSceneLayerSubsystem* Subsystem = SceneLayers())
        {
            const bool bNewVisible = !Subsystem->GetLayerState(ETSMSceneLayer::SanitarySewer).bRequestedVisible;
            for (int32 I = static_cast<int32>(ETSMSceneLayer::SanitarySewer);
                 I <= static_cast<int32>(ETSMSceneLayer::Telecom); ++I)
            {
                Subsystem->SetLayerVisibility(static_cast<ETSMSceneLayer>(I), bNewVisible);
            }
            if (ResultText.IsValid())
                ResultText->SetText(FText::FromString(TEXT(
                    "UTILITIES // VISIBILITY TOGGLED\\nNo missing or unverified subsurface infrastructure was synthesized.")));
        }
        return FReply::Handled();
    }
    FReply SaveLayers()
    {
        const bool bSaved = SceneLayers() && SceneLayers()->SaveVisibilityProfile(TEXT("operator-default"));
        if (ResultText.IsValid()) ResultText->SetText(FText::FromString(
            bSaved ? TEXT("LAYER PROFILE // SAVED OFFLINE") : TEXT("LAYER PROFILE // SAVE FAILED")));
        return FReply::Handled();
    }
    FReply LoadLayers()
    {
        const bool bLoaded = SceneLayers() && SceneLayers()->LoadVisibilityProfile(TEXT("operator-default"));
        if (ResultText.IsValid()) ResultText->SetText(FText::FromString(
            bLoaded ? TEXT("LAYER PROFILE // RESTORED") : TEXT("LAYER PROFILE // NOT FOUND OR INVALID")));
        return FReply::Handled();
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

    FReply ExportCivicPassport()
    {
        // Explicit operator action only. No Python runtime, shell, WebView,
        // network dependency or arbitrary third-party executable is started.
        if (!ResultText.IsValid())
            return FReply::Handled();

        const FString Input = FPaths::Combine(FPaths::ProjectSavedDir(),
            TEXT("PublicEvidence"), TEXT("parcel-evidence.json"));
        const int64 ByteCount = IFileManager::Get().FileSize(*Input);
        constexpr int64 MaxInputSize = 2LL * 1024LL * 1024LL;
        if (ByteCount <= 0 || ByteCount > MaxInputSize)
        {
            ResultText->SetText(FText::FromString(TEXT(
                "PASSPORT // SOURCE_UNAVAILABLE\\n"
                "Expected a bounded previously audited public passport at "
                "Saved/PublicEvidence/parcel-evidence.json. No placeholder was exported.")));
            return FReply::Handled();
        }

        TArray<uint8> Bytes;
        if (!FFileHelper::LoadFileToArray(Bytes, *Input) ||
            Bytes.Num() != ByteCount)
        {
            ResultText->SetText(FText::FromString(TEXT("PASSPORT // LOCAL SOURCE READ FAILED")));
            return FReply::Handled();
        }
        // Decode *exactly* the bytes later hashed and exported. Reading the
        // source a second time risks validating different content if the file
        // is changed between reads.
        const FUTF8ToTCHAR Decoder(reinterpret_cast<const ANSICHAR*>(Bytes.GetData()), Bytes.Num());
        const FString JsonText(Decoder.Length(), Decoder.Get());
        TSharedPtr<FJsonObject> Passport;
        if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(JsonText), Passport)
            || !Passport.IsValid())
        {
            ResultText->SetText(FText::FromString(TEXT("PASSPORT // INVALID JSON SOURCE")));
            return FReply::Handled();
        }
        FString Schema;
        bool bEngineering = true, bRegulatory = true, bSurvey = true;
        FString DeclaredIntegrity;
        const TArray<TSharedPtr<FJsonValue>>* Facts = nullptr;
        if (!Passport->TryGetStringField(TEXT("schema"), Schema) ||
            Schema != TEXT("tsm.public-evidence.passport.v1") ||
            !Passport->TryGetBoolField(TEXT("engineeringUse"), bEngineering) || bEngineering ||
            !Passport->TryGetBoolField(TEXT("regulatoryDetermination"), bRegulatory) || bRegulatory ||
            !Passport->TryGetBoolField(TEXT("surveyCertification"), bSurvey) || bSurvey ||
            !Passport->TryGetStringField(TEXT("integritySha256"), DeclaredIntegrity) ||
            DeclaredIntegrity.Len() != 64 ||
            !Passport->TryGetArrayField(TEXT("facts"), Facts) || !Facts || Facts->Num() > 500 ||
            Passport->HasField(TEXT("owner")))
        {
            ResultText->SetText(FText::FromString(TEXT(
                "PASSPORT // UNVERIFIED OR RESTRICTED INPUT\\n"
                "Only the bounded, public and explicitly non-regulatory passport format is exportable.")));
            return FReply::Handled();
        }
        // The existing audited passport exporter emits only these
        // public-facing fields. Reject unexpected owner/contact/private
        // attributes instead of blindly copying an arbitrary JSON object.
        const TArray<FString> AllowedPassportKeys = {
            TEXT("schema"), TEXT("parcelId"), TEXT("countyFips"), TEXT("asOf"),
            TEXT("snapshotId"), TEXT("facts"), TEXT("evidenceStateCounts"),
            TEXT("engineeringUse"), TEXT("regulatoryDetermination"),
            TEXT("surveyCertification"), TEXT("sourceBytesVerifiedNotSourceClaims"),
            TEXT("notice"), TEXT("integritySha256")
        };
        const TArray<FString> AllowedFactKeys = {
            TEXT("label"), TEXT("value"), TEXT("units"), TEXT("verticalDatum"),
            TEXT("dataRole"), TEXT("sourceId"), TEXT("sourceSha256"),
            TEXT("observedAt"), TEXT("evidenceState"), TEXT("reasons"),
            TEXT("controlPointVerified"), TEXT("valueIndependentlyValidated")
        };
        for (const auto& Pair : Passport->Values)
        {
            if (!AllowedPassportKeys.Contains(Pair.Key))
            {
                ResultText->SetText(FText::FromString(TEXT(
                    "PASSPORT // UNEXPECTED PRIVATE OR UNSUPPORTED FIELD")));
                return FReply::Handled();
            }
        }
        FString ParcelId, CountyFips, SnapshotId, AsOf, Notice;
        bool bSourceBytesVerifiedNotSourceClaims = false;
        const TSharedPtr<FJsonValue>* EvidenceCounts = Passport->Values.Find(TEXT("evidenceStateCounts"));
        if (!Passport->TryGetStringField(TEXT("parcelId"), ParcelId) ||
            !Passport->TryGetStringField(TEXT("countyFips"), CountyFips) ||
            !Passport->TryGetStringField(TEXT("snapshotId"), SnapshotId) ||
            !Passport->TryGetStringField(TEXT("asOf"), AsOf) ||
            !Passport->TryGetStringField(TEXT("notice"), Notice) ||
            !Passport->TryGetBoolField(TEXT("sourceBytesVerifiedNotSourceClaims"),
                                       bSourceBytesVerifiedNotSourceClaims) ||
            !bSourceBytesVerifiedNotSourceClaims ||
            ParcelId.IsEmpty() || ParcelId.Len() > 128 ||
            CountyFips.Len() != 5 ||
            SnapshotId.IsEmpty() || SnapshotId.Len() > 128 ||
            AsOf.IsEmpty() || AsOf.Len() > 64 ||
            Notice.IsEmpty() || Notice.Len() > 1024 ||
            !EvidenceCounts || !EvidenceCounts->IsValid() ||
            (*EvidenceCounts)->Type != EJson::Object)
        {
            ResultText->SetText(FText::FromString(TEXT(
                "PASSPORT // REQUIRED PUBLIC SOURCE METADATA MISSING OR MALFORMED")));
            return FReply::Handled();
        }
        for (const TCHAR Digit : CountyFips)
        {
            if (Digit < TEXT('0') || Digit > TEXT('9'))
            {
                ResultText->SetText(FText::FromString(TEXT("PASSPORT // INVALID COUNTY FIPS")));
                return FReply::Handled();
            }
        }
        for (const auto& Pair : (*EvidenceCounts)->AsObject()->Values)
        {
            if (!Pair.Value.IsValid() || Pair.Value->Type != EJson::Number ||
                Pair.Value->AsNumber() < 0 || !FMath::IsFinite(Pair.Value->AsNumber()))
            {
                ResultText->SetText(FText::FromString(TEXT("PASSPORT // INVALID EVIDENCE COUNTER")));
                return FReply::Handled();
            }
        }
        for (const TSharedPtr<FJsonValue>& FactValue : *Facts)
        {
            const TSharedPtr<FJsonObject> Fact =
                FactValue.IsValid() ? FactValue->AsObject() : nullptr;
            if (!Fact.IsValid())
            {
                ResultText->SetText(FText::FromString(TEXT("PASSPORT // INVALID FACT RECORD")));
                return FReply::Handled();
            }
            for (const auto& Pair : Fact->Values)
            {
                if (!AllowedFactKeys.Contains(Pair.Key))
                {
                    ResultText->SetText(FText::FromString(TEXT(
                        "PASSPORT // RESTRICTED OR UNSUPPORTED FACT FIELD")));
                    return FReply::Handled();
                }
            }
            FString Label, SourceId, DataRole, EvidenceState;
            bool bControlPointVerified = true;
            const TArray<TSharedPtr<FJsonValue>>* Reasons = nullptr;
            const TSharedPtr<FJsonValue>* FactPayload = Fact->Values.Find(TEXT("value"));
            if (!Fact->TryGetStringField(TEXT("label"), Label) ||
                !Fact->TryGetStringField(TEXT("sourceId"), SourceId) ||
                !Fact->TryGetStringField(TEXT("dataRole"), DataRole) ||
                !Fact->TryGetStringField(TEXT("evidenceState"), EvidenceState) ||
                !Fact->TryGetBoolField(TEXT("controlPointVerified"), bControlPointVerified) ||
                bControlPointVerified ||
                !Fact->TryGetArrayField(TEXT("reasons"), Reasons) || !Reasons ||
                Reasons->Num() > 32 ||
                Label.IsEmpty() || Label.Len() > 120 ||
                SourceId.IsEmpty() || SourceId.Len() > 128 ||
                DataRole.IsEmpty() || DataRole.Len() > 64 ||
                EvidenceState.IsEmpty() || EvidenceState.Len() > 64 ||
                !FactPayload || !FactPayload->IsValid() ||
                ((*FactPayload)->Type != EJson::String &&
                 (*FactPayload)->Type != EJson::Number &&
                 (*FactPayload)->Type != EJson::Null))
            {
                ResultText->SetText(FText::FromString(TEXT(
                    "PASSPORT // UNSUPPORTED FACT TYPES OR SCIENTIFIC CLAIMS")));
                return FReply::Handled();
            }
            if (((*FactPayload)->Type == EJson::String &&
                 (*FactPayload)->AsString().Len() > 200) ||
                ((*FactPayload)->Type == EJson::Number &&
                 !FMath::IsFinite((*FactPayload)->AsNumber())))
            {
                ResultText->SetText(FText::FromString(TEXT("PASSPORT // INVALID FACT VALUE")));
                return FReply::Handled();
            }
            for (const TSharedPtr<FJsonValue>& Reason : *Reasons)
            {
                if (!Reason.IsValid() || Reason->Type != EJson::String ||
                    Reason->AsString().Len() > 512)
                {
                    ResultText->SetText(FText::FromString(TEXT("PASSPORT // INVALID FACT REASON")));
                    return FReply::Handled();
                }
            }
            const TArray<FString> NullableTextFields = {
                TEXT("units"), TEXT("verticalDatum"), TEXT("sourceSha256"),
                TEXT("observedAt")
            };
            for (const FString& Key : NullableTextFields)
            {
                const TSharedPtr<FJsonValue>* OptionalValue = Fact->Values.Find(Key);
                if (!OptionalValue || !OptionalValue->IsValid() ||
                    ((*OptionalValue)->Type != EJson::Null &&
                     (*OptionalValue)->Type != EJson::String) ||
                    ((*OptionalValue)->Type == EJson::String &&
                     (*OptionalValue)->AsString().Len() > 256))
                {
                    ResultText->SetText(FText::FromString(TEXT(
                        "PASSPORT // UNEXPECTED NESTED OR OVERSIZED FACT METADATA")));
                    return FReply::Handled();
                }
            }
            bool bIndependentlyValidated = true;
            if (!Fact->TryGetBoolField(TEXT("valueIndependentlyValidated"),
                                       bIndependentlyValidated) ||
                bIndependentlyValidated)
            {
                ResultText->SetText(FText::FromString(TEXT(
                    "PASSPORT // SCIENTIFIC VALUE CLAIM NOT VERIFIED HERE")));
                return FReply::Handled();
            }
        }
        for (const TCHAR Ch : DeclaredIntegrity)
        {
            if (!((Ch >= TEXT('0') && Ch <= TEXT('9')) ||
                  (Ch >= TEXT('a') && Ch <= TEXT('f'))))
            {
                ResultText->SetText(FText::FromString(TEXT("PASSPORT // MALFORMED DECLARED HASH")));
                return FReply::Handled();
            }
        }
        // The current native path hashes actual bytes, but does NOT recompute
        // Python's canonical sorted-key passport digest; no false integrity claim.
        const std::string Digest = TsmSha256HexOfString(
            reinterpret_cast<const char*>(Bytes.GetData()),
            static_cast<size_t>(Bytes.Num()));
        const FString FileSha256 = UTF8_TO_TCHAR(Digest.c_str());
        const FString OutputDir = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("CivicExports"));
        if (!IFileManager::Get().MakeDirectory(*OutputDir, true))
        {
            ResultText->SetText(FText::FromString(TEXT("PASSPORT // EXPORT DIRECTORY UNAVAILABLE")));
            return FReply::Handled();
        }
        const FString Stamp = FDateTime::UtcNow().ToString(TEXT("%Y%m%d-%H%M%S"));
        const FString Base = FPaths::Combine(OutputDir, FString::Printf(TEXT("parcel-evidence-%s"), *Stamp));
        const FString ExportJson = Base + TEXT(".json");
        const FString ReceiptPath = Base + TEXT(".receipt.json");
        if (IFileManager::Get().FileExists(*ExportJson) ||
            IFileManager::Get().FileExists(*ReceiptPath))
        {
            ResultText->SetText(FText::FromString(TEXT("PASSPORT // EXPORT EXISTS; WILL NOT REPLACE")));
            return FReply::Handled();
        }

        TUniquePtr<FArchive> Output(IFileManager::Get().CreateFileWriter(
            *ExportJson, FILEWRITE_NoReplaceExisting));
        if (!Output)
        {
            ResultText->SetText(FText::FromString(TEXT("PASSPORT // CANNOT CREATE EXPORT FILE")));
            return FReply::Handled();
        }
        Output->Serialize(Bytes.GetData(), Bytes.Num());
        const bool bWritten = !Output->IsError();
        Output.Reset();
        if (!bWritten)
        {
            IFileManager::Get().Delete(*ExportJson);
            ResultText->SetText(FText::FromString(TEXT("PASSPORT // EXPORT WRITE FAILED")));
            return FReply::Handled();
        }

        // Hash the *written destination*, not just the source buffer,
        // before asserting an exported-file SHA-256 in the receipt.
        TArray<uint8> ExportReadback;
        if (!FFileHelper::LoadFileToArray(ExportReadback, *ExportJson) ||
            ExportReadback.Num() != Bytes.Num())
        {
            IFileManager::Get().Delete(*ExportJson);
            ResultText->SetText(FText::FromString(TEXT("PASSPORT // EXPORT READBACK FAILED")));
            return FReply::Handled();
        }
        const std::string ReadbackDigest = TsmSha256HexOfString(
            reinterpret_cast<const char*>(ExportReadback.GetData()),
            static_cast<size_t>(ExportReadback.Num()));
        const FString ReadbackHash = UTF8_TO_TCHAR(ReadbackDigest.c_str());
        if (ReadbackHash != FileSha256)
        {
            IFileManager::Get().Delete(*ExportJson);
            ResultText->SetText(FText::FromString(TEXT("PASSPORT // EXPORT SHA-256 MISMATCH")));
            return FReply::Handled();
        }

        TSharedRef<FJsonObject> Receipt = MakeShared<FJsonObject>();
        Receipt->SetStringField(TEXT("schema"), TEXT("tsm.native.passport-json-export.v1"));
        Receipt->SetStringField(TEXT("inputSource"), TEXT("Saved/PublicEvidence/parcel-evidence.json"));
        Receipt->SetStringField(TEXT("exportedFile"), FPaths::GetCleanFilename(ExportJson));
        Receipt->SetStringField(TEXT("exportedBytesSha256"), FileSha256);
        Receipt->SetStringField(TEXT("passportDeclaredIntegritySha256"), DeclaredIntegrity);
        Receipt->SetStringField(TEXT("passportIntegrityValidation"), TEXT("DECLARED_NOT_REVALIDATED"));
        Receipt->SetBoolField(TEXT("sourceDataIndependentlyVerified"), false);
        Receipt->SetBoolField(TEXT("regulatoryDetermination"), false);
        Receipt->SetBoolField(TEXT("surveyCertification"), false);
        Receipt->SetStringField(TEXT("notice"),
            TEXT("This is a local exported copy of a supplied informational passport, "
                 "not an independently validated parcel join or reviewed DOCX/XLSX packet."));
        FString ReceiptText;
        TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&ReceiptText);
        if (!FJsonSerializer::Serialize(Receipt, Writer))
        {
            IFileManager::Get().Delete(*ExportJson);
            ResultText->SetText(FText::FromString(TEXT("PASSPORT // RECEIPT SERIALIZATION FAILED")));
            return FReply::Handled();
        }
        const FTCHARToUTF8 EncodedReceipt(*ReceiptText);
        TArray<uint8> ReceiptBytes;
        ReceiptBytes.Append(reinterpret_cast<const uint8*>(EncodedReceipt.Get()), EncodedReceipt.Length());
        TUniquePtr<FArchive> ReceiptFile(IFileManager::Get().CreateFileWriter(
            *ReceiptPath, FILEWRITE_NoReplaceExisting));
        if (!ReceiptFile)
        {
            IFileManager::Get().Delete(*ExportJson);
            ResultText->SetText(FText::FromString(TEXT("PASSPORT // RECEIPT FILE EXISTS OR UNAVAILABLE")));
            return FReply::Handled();
        }
        ReceiptFile->Serialize(ReceiptBytes.GetData(), ReceiptBytes.Num());
        const bool bReceiptWritten = !ReceiptFile->IsError();
        ReceiptFile.Reset();
        if (!bReceiptWritten)
        {
            IFileManager::Get().Delete(*ReceiptPath);
            IFileManager::Get().Delete(*ExportJson);
            ResultText->SetText(FText::FromString(TEXT("PASSPORT // RECEIPT WRITE FAILED")));
            return FReply::Handled();
        }
        ResultText->SetText(FText::FromString(FString::Printf(
            TEXT("PASSPORT // JSON EXPORTED OFFLINE\\n%s\\n")
            TEXT("Actual-byte SHA-256: %s\\n")
            TEXT("Local exported copy only. Canonical passport integrity NOT revalidated here; ")
            TEXT("DOCX/XLSX generation remains a separate headless exporter."),
            *ExportJson, *FileSha256)));
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
