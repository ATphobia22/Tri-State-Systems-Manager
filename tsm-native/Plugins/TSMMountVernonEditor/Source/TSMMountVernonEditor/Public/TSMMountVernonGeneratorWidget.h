#pragma once

#include "CoreMinimal.h"
#include "EditorUtilityWidget.h"
#include "TSMMountVernonGeneratorWidget.generated.h"

class UEditableTextBox;
class UTextBlock;
class UButton;
class SWidget;

/** Blueprint parent for the editor-only Mount Vernon importer. */
UCLASS(BlueprintType)
class TSMMOUNTVERNONEDITOR_API UTSMMountVernonGeneratorWidget : public UEditorUtilityWidget
{
    GENERATED_BODY()
protected:
    virtual TSharedRef<SWidget> RebuildWidget() override;
    virtual void NativeConstruct() override;

private:
    UPROPERTY(Transient)
    TObjectPtr<UEditableTextBox> ManifestInput;

    UPROPERTY(Transient)
    TObjectPtr<UTextBlock> StatusText;

    UPROPERTY(Transient)
    TObjectPtr<UButton> ValidateButton;

    UPROPERTY(Transient)
    TObjectPtr<UButton> GenerateButton;

    UPROPERTY(Transient)
    TObjectPtr<UButton> RvtButton;

    UFUNCTION()
    void ValidateSource();

    UFUNCTION()
    void GenerateVectors();

    UFUNCTION()
    void CreateRvtMaterials();

    void RunAction(const TCHAR* Action);
};
