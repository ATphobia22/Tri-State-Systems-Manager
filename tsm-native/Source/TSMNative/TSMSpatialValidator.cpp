#include "TSMSpatialValidator.h"

#include "Dom/JsonObject.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "TsmSha256.h"

namespace
{
bool IsSha256Hex(const FString& Value)
{
    if (Value.Len() != 64)
    {
        return false;
    }

    for (const TCHAR Character : Value)
    {
        const bool bHex =
            (Character >= TEXT('0') && Character <= TEXT('9')) ||
            (Character >= TEXT('a') && Character <= TEXT('f')) ||
            (Character >= TEXT('A') && Character <= TEXT('F'));

        if (!bHex)
        {
            return false;
        }
    }

    return true;
}
}

FString UTSMSpatialValidator::ComputeFileSha256(const FString& TargetFilePath)
{
    TArray<uint8> FileBinaryData;
    if (!FFileHelper::LoadFileToArray(FileBinaryData, *TargetFilePath))
    {
        return FString();
    }

    const TsmSha256Digest Digest = TsmComputeSha256(
        FileBinaryData.GetData(),
        static_cast<size_t>(FileBinaryData.Num()));

    return UTF8_TO_TCHAR(TsmSha256Hex(Digest).c_str());
}

bool UTSMSpatialValidator::IsSafeRelativeAssetPath(const FString& RelativeUri)
{
    if (RelativeUri.IsEmpty() || FPaths::IsRelative(RelativeUri) == false)
    {
        return false;
    }

    FString Normalized = RelativeUri;
    FPaths::NormalizeFilename(Normalized);
    FPaths::CollapseRelativeDirectories(Normalized);

    return !Normalized.StartsWith(TEXT("../"))
        && !Normalized.Contains(TEXT("/../"))
        && !Normalized.StartsWith(TEXT("/"))
        && !Normalized.Contains(TEXT(":"));
}

bool UTSMSpatialValidator::ValidateSpatialRuntimeFabric(
    const FString& ManifestFilePath,
    TArray<FTSM3DAssetNode>& OutVerifiedAssets)
{
    OutVerifiedAssets.Reset();

    FString ManifestJsonContent;
    if (!FFileHelper::LoadFileToString(ManifestJsonContent, *ManifestFilePath))
    {
        UE_LOG(LogTemp, Error, TEXT("[TSM Spatial] Manifest could not be read: %s"), *ManifestFilePath);
        return false;
    }

    TSharedPtr<FJsonObject> RootJsonObject;
    const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(ManifestJsonContent);
    if (!FJsonSerializer::Deserialize(Reader, RootJsonObject) || !RootJsonObject.IsValid())
    {
        UE_LOG(LogTemp, Error, TEXT("[TSM Spatial] Manifest JSON is invalid."));
        return false;
    }

    const TSharedPtr<FJsonObject>* LayersObject = nullptr;
    if (!RootJsonObject->TryGetObjectField(TEXT("layers"), LayersObject) ||
        LayersObject == nullptr ||
        !LayersObject->IsValid())
    {
        UE_LOG(LogTemp, Error, TEXT("[TSM Spatial] Manifest has no valid layers object."));
        return false;
    }

    const FString DataRootDirectory = FPaths::ConvertRelativePathToFull(
        FPaths::GetPath(ManifestFilePath));

    bool bSystemPassed = true;
    int32 AssetCount = 0;

    for (const FString& Classification : {TEXT("terrain_3ddep"), TEXT("structures_gltf"), TEXT("infrastructure_mesh")})
    {
        const TArray<TSharedPtr<FJsonValue>>* AssetArray = nullptr;
        if (!(*LayersObject)->TryGetArrayField(Classification, AssetArray) || AssetArray == nullptr)
        {
            continue;
        }

        for (const TSharedPtr<FJsonValue>& AssetValue : *AssetArray)
        {
            const TSharedPtr<FJsonObject> AssetObject = AssetValue.IsValid() ? AssetValue->AsObject() : nullptr;
            if (!AssetObject.IsValid())
            {
                bSystemPassed = false;
                continue;
            }

            FTSM3DAssetNode Node;
            if (!AssetObject->TryGetStringField(TEXT("file_name"), Node.FileName) ||
                !AssetObject->TryGetStringField(TEXT("relative_uri"), Node.RelativeUri) ||
                !AssetObject->TryGetStringField(TEXT("sha256_checksum"), Node.ExpectedSha256))
            {
                UE_LOG(LogTemp, Error, TEXT("[TSM Spatial] Asset entry is missing required provenance fields."));
                bSystemPassed = false;
                continue;
            }

            Node.ExpectedSha256 = Node.ExpectedSha256.ToLower();
            if (!IsSha256Hex(Node.ExpectedSha256) || !IsSafeRelativeAssetPath(Node.RelativeUri))
            {
                UE_LOG(LogTemp, Error, TEXT("[TSM Spatial] Invalid asset provenance envelope: %s"), *Node.FileName);
                bSystemPassed = false;
                continue;
            }

            FString RelativePath = Node.RelativeUri;
            FPaths::NormalizeFilename(RelativePath);
            FPaths::CollapseRelativeDirectories(RelativePath);

            const FString PhysicalPath = FPaths::ConvertRelativePathToFull(
                FPaths::Combine(DataRootDirectory, RelativePath));

            if (!PhysicalPath.StartsWith(DataRootDirectory, ESearchCase::IgnoreCase))
            {
                UE_LOG(LogTemp, Error, TEXT("[TSM Spatial] Asset path escaped manifest data root: %s"), *Node.RelativeUri);
                bSystemPassed = false;
                continue;
            }

            Node.ComputedSha256 = ComputeFileSha256(PhysicalPath);
            Node.bProvenanceVerified =
                !Node.ComputedSha256.IsEmpty() &&
                Node.ComputedSha256.Equals(Node.ExpectedSha256, ESearchCase::IgnoreCase);

            if (!Node.bProvenanceVerified)
            {
                UE_LOG(
                    LogTemp,
                    Error,
                    TEXT("[TSM Spatial] SHA-256 mismatch: %s expected=%s computed=%s"),
                    *Node.FileName,
                    *Node.ExpectedSha256,
                    *Node.ComputedSha256);
                bSystemPassed = false;
            }

            OutVerifiedAssets.Add(Node);
            ++AssetCount;
        }
    }

    if (AssetCount == 0)
    {
        UE_LOG(LogTemp, Error, TEXT("[TSM Spatial] Manifest contains no verifiable 3D assets."));
        return false;
    }

    return bSystemPassed;
}