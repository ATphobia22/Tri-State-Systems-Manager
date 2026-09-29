#pragma once
// TSMCrypto — Blueprint-facing hash library.
// Requires Unreal Engine 5.8+ on Windows to compile; NOT compiled or tested
// in this environment. The underlying digest is computed by the engine-free
// TsmSha256 core (Source/TSMCrypto/Public/TsmSha256.h), which is verified
// against NIST FIPS 180-4 test vectors.
#include "Kismet/BlueprintFunctionLibrary.h"
#include "TsmHashLibrary.generated.h"

UCLASS()
class TSMCRYPTO_API UTsmHashLibrary : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()

public:
    // Genuine SHA-256 of the UTF-8 bytes of Input, returned as 64 lowercase
    // hex characters. (Earlier drafts returned MD5/SHA-1 here; this one does
    // not. See TsmSha256.h.)
    UFUNCTION(BlueprintCallable, Category = "TSM|Crypto")
    static FString ComputeSHA256(const FString& Input);
};
