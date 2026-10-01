#include "TSMManifestDownloader.h"

#include "HttpModule.h"
#include "Interfaces/IHttpResponse.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "GenericPlatform/GenericPlatformHttp.h"

namespace
{
constexpr TCHAR AllowedPagesHost[] = TEXT("atphobia22.github.io");
constexpr TCHAR RequiredPagesPath[] = TEXT("/Tri-State-Systems-Manager/");
}

void UTSMManifestDownloader::DispatchManifestDownloadTask(
    const FString& SecureTargetUrl,
    const FString& LocalDataStoragePath)
{
    const FString Domain = FPlatformHttp::GetUrlDomain(SecureTargetUrl);
    const FString Path = FPlatformHttp::GetUrlPath(SecureTargetUrl, false, false);

    if (!FPlatformHttp::IsSecureProtocol(SecureTargetUrl).Get(false) ||
        !Domain.Equals(AllowedPagesHost, ESearchCase::IgnoreCase) ||
        !Path.StartsWith(RequiredPagesPath, ESearchCase::IgnoreCase))
    {
        OnVerificationFailed.Broadcast(
            TEXT("REJECTED: Manifest downloads require HTTPS from the TSM GitHub Pages origin."));
        return;
    }

    CachedLocalPath = FPaths::ConvertRelativePathToFull(LocalDataStoragePath);
    IFileManager::Get().MakeDirectory(*CachedLocalPath, true);

    const FString ManifestPath = FPaths::Combine(CachedLocalPath, TEXT("spatial-layer-manifest.json"));

    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
    Request->SetURL(SecureTargetUrl);
    Request->SetVerb(TEXT("GET"));
    Request->SetHeader(TEXT("Accept"), TEXT("application/json"));
    Request->SetHeader(TEXT("User-Agent"), TEXT("TSM-Native-5.8-SpatialVerifier"));
    Request->SetTimeout(30.0f);
    Request->OnProcessRequestComplete().BindUObject(
        this,
        &UTSMManifestDownloader::OnManifestResponseReceived);

    UE_LOG(LogTemp, Log, TEXT("[TSM Spatial] Downloading manifest from %s"), *SecureTargetUrl);

    if (!Request->ProcessRequest())
    {
        OnVerificationFailed.Broadcast(TEXT("NETWORK_FAULT: HTTP request could not be queued."));
        return;
    }

    CachedLocalPath = FPaths::GetPath(ManifestPath);
}

void UTSMManifestDownloader::OnManifestResponseReceived(
    FHttpRequestPtr Request,
    FHttpResponsePtr Response,
    bool bWasConnectedSuccessfully)
{
    if (!bWasConnectedSuccessfully || !Response.IsValid())
    {
        OnVerificationFailed.Broadcast(TEXT("NETWORK_FAULT: HTTPS manifest request failed."));
        return;
    }

    if (Response->GetResponseCode() != 200)
    {
        OnVerificationFailed.Broadcast(
            FString::Printf(TEXT("SERVER_ERROR: manifest returned HTTP %d"), Response->GetResponseCode()));
        return;
    }

    const TArray<uint8>& Content = Response->GetContent();
    if (Content.Num() == 0 || Content.Num() > 8 * 1024 * 1024)
    {
        OnVerificationFailed.Broadcast(TEXT("REJECTED: Manifest payload is empty or exceeds the 8 MiB safety limit."));
        return;
    }

    const FString ManifestPath = FPaths::Combine(
        CachedLocalPath,
        TEXT("spatial-layer-manifest.json"));

    if (!FFileHelper::SaveArrayToFile(Content, *ManifestPath))
    {
        OnVerificationFailed.Broadcast(TEXT("FILESYSTEM_EXCEPTION: Unable to persist downloaded manifest."));
        return;
    }

    TArray<FTSM3DAssetNode> VerifiedAssets;
    const bool bPassed =
        UTSMSpatialValidator::ValidateSpatialRuntimeFabric(
            ManifestPath,
            VerifiedAssets);

    if (!bPassed)
    {
        OnVerificationFailed.Broadcast(
            TEXT("PROVENANCE_FAILURE: Manifest or referenced 3D assets failed SHA-256 validation."));
        return;
    }

    OnVerificationComplete.Broadcast(VerifiedAssets, true);
}