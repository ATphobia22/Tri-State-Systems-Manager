#include "TSMMountVernonGeneratorWidget.h"

#include "Blueprint/WidgetTree.h"
#include "Components/Button.h"
#include "Components/EditableTextBox.h"
#include "Components/TextBlock.h"
#include "Components/VerticalBox.h"
#include "HAL/FileManager.h"
#include "HAL/PlatformMisc.h"
#include "IPythonScriptPlugin.h"
#include "Misc/Paths.h"

TSharedRef<SWidget> UTSMMountVernonGeneratorWidget::RebuildWidget()
{
    // Build WidgetTree BEFORE UUserWidget constructs its Slate representation.
    if (WidgetTree && !WidgetTree->RootWidget)
    {
        UVerticalBox* Root = WidgetTree->ConstructWidget<UVerticalBox>(
            UVerticalBox::StaticClass(), TEXT("MVRoot"));
        WidgetTree->RootWidget = Root;

        UTextBlock* Header = WidgetTree->ConstructWidget<UTextBlock>(
            UTextBlock::StaticClass(), TEXT("MVHeader"));
        Header->SetText(FText::FromString(
            TEXT("Mount Vernon 47620 | evidence-gated town vectors")));
        Root->AddChildToVerticalBox(Header);

        ManifestInput = WidgetTree->ConstructWidget<UEditableTextBox>(
            UEditableTextBox::StaticClass(), TEXT("MVManifestPath"));
        ManifestInput->SetHintText(FText::FromString(
            TEXT("Absolute path to manifest.json on local disk")));
        Root->AddChildToVerticalBox(ManifestInput);

        auto AddButton = [this, Root](const FName Name, const TCHAR* Caption) -> UButton*
        {
            UButton* Button = WidgetTree->ConstructWidget<UButton>(UButton::StaticClass(), Name);
            UTextBlock* Label = WidgetTree->ConstructWidget<UTextBlock>(UTextBlock::StaticClass());
            Label->SetText(FText::FromString(Caption));
            Button->AddChild(Label);
            Root->AddChildToVerticalBox(Button);
            return Button;
        };
        ValidateButton = AddButton(TEXT("MVValidate"), TEXT("1. Preflight (read only)"));
        GenerateButton = AddButton(TEXT("MVGenerate"), TEXT("2. Generate tagged native splines"));
        RvtButton = AddButton(TEXT("MVRvt"), TEXT("3. Create RVT/material templates"));

        StatusText = WidgetTree->ConstructWidget<UTextBlock>(
            UTextBlock::StaticClass(), TEXT("MVStatus"));
        StatusText->SetText(FText::FromString(
            TEXT("No data loaded. Review Output Log and generation receipts.")));
        Root->AddChildToVerticalBox(StatusText);
    }
    return Super::RebuildWidget();
}

void UTSMMountVernonGeneratorWidget::NativeConstruct()
{
    Super::NativeConstruct();
    if (ValidateButton && GenerateButton && RvtButton)
    {
        ValidateButton->OnClicked.AddUniqueDynamic(this, &UTSMMountVernonGeneratorWidget::ValidateSource);
        GenerateButton->OnClicked.AddUniqueDynamic(this, &UTSMMountVernonGeneratorWidget::GenerateVectors);
        RvtButton->OnClicked.AddUniqueDynamic(this, &UTSMMountVernonGeneratorWidget::CreateRvtMaterials);
    }
}

void UTSMMountVernonGeneratorWidget::ValidateSource() { RunAction(TEXT("validate")); }
void UTSMMountVernonGeneratorWidget::GenerateVectors() { RunAction(TEXT("generate")); }
void UTSMMountVernonGeneratorWidget::CreateRvtMaterials() { RunAction(TEXT("rvt")); }

void UTSMMountVernonGeneratorWidget::RunAction(const TCHAR* Action)
{
    if (!ManifestInput || !StatusText)
    {
        return;
    }
    const FString Manifest = ManifestInput->GetText().ToString().TrimStartAndEnd();
    if (Manifest.IsEmpty() || !IFileManager::Get().FileExists(*Manifest))
    {
        StatusText->SetText(FText::FromString(TEXT("ERROR: select an existing manifest.json.")));
        return;
    }
    const FString ScriptPath = FPaths::ConvertRelativePathToFull(
        FPaths::Combine(FPaths::ProjectContentDir(), TEXT("Python/tsm_mv_generator.py")));
    if (!IFileManager::Get().FileExists(*ScriptPath))
    {
        StatusText->SetText(FText::FromString(TEXT("ERROR: tsm_mv_generator.py was not installed.")));
        return;
    }
    FPlatformMisc::SetEnvironmentVar(TEXT("TSM_MV_MANIFEST"), *Manifest);
    FPlatformMisc::SetEnvironmentVar(TEXT("TSM_MV_ACTION"), Action);
    FPlatformMisc::SetEnvironmentVar(TEXT("TSM_MV_ENTRY_SCRIPT"), *ScriptPath);
    // Neither the manifest path nor the script path is interpolated into Python source.
    const bool bOk = IPythonScriptPlugin::Get()->ExecPythonCommand(
        TEXT("import os, runpy; runpy.run_path(os.environ['TSM_MV_ENTRY_SCRIPT'], run_name='__main__')"));
    StatusText->SetText(FText::FromString(
        bOk ? TEXT("Command returned. Verify Output Log and generation receipt.")
            : TEXT("Python command failed. See Output Log; release gates remain open.")));
}
