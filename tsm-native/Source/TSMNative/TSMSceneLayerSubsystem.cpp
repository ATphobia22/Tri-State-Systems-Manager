#include "TSMSceneLayerSubsystem.h"
#include "GameFramework/Actor.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "HAL/FileManager.h"

void UTSMSceneLayerSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    for (int32 I = 0; I <= static_cast<int32>(ETSMSceneLayer::ProposedConstruction); ++I)
    {
        Visibility.Add(static_cast<ETSMSceneLayer>(I), I <= static_cast<int32>(ETSMSceneLayer::Roads));
    }
}
void UTSMSceneLayerSubsystem::Deinitialize()
{
    Actors.Empty();
    Visibility.Empty();
    Super::Deinitialize();
}
void UTSMSceneLayerSubsystem::Refresh(ETSMSceneLayer Layer)
{
    const bool bVisible = Visibility.FindRef(Layer);
    if (TArray<FLayerActor>* Entries = Actors.Find(Layer))
    {
        for (FLayerActor& Entry : *Entries)
        {
            if (AActor* Actor = Entry.Actor.Get())
            {
                Actor->SetActorHiddenInGame(!bVisible);
            }
        }
    }
}
void UTSMSceneLayerSubsystem::SetLayerVisibility(ETSMSceneLayer Layer, bool bVisible)
{
    Visibility.Add(Layer, bVisible);
    Refresh(Layer);
}
bool UTSMSceneLayerSubsystem::RegisterLayerActor(ETSMSceneLayer Layer, AActor* Actor,
    const FString& SourceId, const FString& SourceSha256, bool bSourceVerified)
{
    if (!IsValid(Actor) || SourceId.IsEmpty() || SourceSha256.Len() != 64)
    {
        return false;
    }
    for (TCHAR C : SourceSha256)
    {
        if (!FChar::IsHexDigit(C)) return false;
    }
    TArray<FLayerActor>& Entries = Actors.FindOrAdd(Layer);
    for (const FLayerActor& Entry : Entries)
    {
        if (Entry.Actor.Get() == Actor) return false;
    }
    FLayerActor Entry;
    Entry.Actor = Actor;
    Entry.SourceId = SourceId;
    Entry.SourceSha256 = SourceSha256;
    Entry.bVerified = bSourceVerified;
    Entries.Add(MoveTemp(Entry));
    Refresh(Layer);
    return true;
}
void UTSMSceneLayerSubsystem::UnregisterLayerActor(AActor* Actor)
{
    for (auto& Pair : Actors)
    {
        Pair.Value.RemoveAll([Actor](const FLayerActor& Entry)
        {
            return !Entry.Actor.IsValid() || Entry.Actor.Get() == Actor;
        });
    }
}
FTSMSceneLayerState UTSMSceneLayerSubsystem::GetLayerState(ETSMSceneLayer Layer) const
{
    FTSMSceneLayerState State;
    State.Layer = Layer;
    State.bRequestedVisible = Visibility.FindRef(Layer);
    if (const TArray<FLayerActor>* Entries = Actors.Find(Layer))
    {
        int32 Count = 0;
        bool bAllVerified = true;
        for (const FLayerActor& Entry : *Entries)
        {
            if (!Entry.Actor.IsValid()) continue;
            ++Count;
            bAllVerified &= Entry.bVerified;
            if (State.SourceId.IsEmpty())
            {
                State.SourceId = Entry.SourceId;
                State.SourceSha256 = Entry.SourceSha256;
            }
        }
        if (Count > 0)
        {
            State.bSourceVerified = bAllVerified;
            State.bRenderedVisible = State.bRequestedVisible;
            State.Status = bAllVerified ? TEXT("SOURCE_REGISTERED_VERIFICATION_DECLARED") :
                TEXT("SOURCE_PRESENT_NOT_VERIFIED");
        }
    }
    return State;
}
bool UTSMSceneLayerSubsystem::IsSafeProfileName(const FString& Name)
{
    if (Name.IsEmpty() || Name.Len() > 64) return false;
    for (TCHAR C : Name)
    {
        if (!(FChar::IsAlnum(C) || C == TEXT('_') || C == TEXT('-'))) return false;
    }
    return true;
}
bool UTSMSceneLayerSubsystem::SaveVisibilityProfile(const FString& ProfileName) const
{
    if (!IsSafeProfileName(ProfileName)) return false;
    TSharedRef<FJsonObject> Root = MakeShared<FJsonObject>();
    Root->SetStringField(TEXT("schema"), TEXT("tsm.scene-visibility.v1"));
    TSharedRef<FJsonObject> Layers = MakeShared<FJsonObject>();
    for (const auto& Pair : Visibility)
    {
        Layers->SetBoolField(FString::FromInt(static_cast<int32>(Pair.Key)), Pair.Value);
    }
    Root->SetObjectField(TEXT("layers"), Layers);
    FString Json;
    const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Json);
    if (!FJsonSerializer::Serialize(Root, Writer)) return false;
    const FString Dir = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("TSM"), TEXT("SceneProfiles"));
    IFileManager::Get().MakeDirectory(*Dir, true);
    return FFileHelper::SaveStringToFile(Json, *FPaths::Combine(Dir, ProfileName + TEXT(".json")));
}
bool UTSMSceneLayerSubsystem::LoadVisibilityProfile(const FString& ProfileName)
{
    if (!IsSafeProfileName(ProfileName)) return false;
    const FString Path = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("TSM"), TEXT("SceneProfiles"), ProfileName + TEXT(".json"));
    FString Json;
    if (!FFileHelper::LoadFileToString(Json, *Path) || Json.Len() > 65536) return false;
    TSharedPtr<FJsonObject> Root;
    if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Json), Root) || !Root.IsValid()) return false;
    FString Schema;
    if (!Root->TryGetStringField(TEXT("schema"), Schema) || Schema != TEXT("tsm.scene-visibility.v1")) return false;
    const TSharedPtr<FJsonObject>* Layers = nullptr;
    if (!Root->TryGetObjectField(TEXT("layers"), Layers) || !Layers || !Layers->IsValid()) return false;
    TMap<ETSMSceneLayer, bool> NewVisibility = Visibility;
    for (int32 I = 0; I <= static_cast<int32>(ETSMSceneLayer::ProposedConstruction); ++I)
    {
        bool bVisible = false;
        if (!(*Layers)->TryGetBoolField(FString::FromInt(I), bVisible)) return false;
        NewVisibility.Add(static_cast<ETSMSceneLayer>(I), bVisible);
    }
    Visibility = MoveTemp(NewVisibility);
    for (const auto& Pair : Visibility) Refresh(Pair.Key);
    return true;
}
