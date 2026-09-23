#include "TSMNative.h"

#include "Modules/ModuleManager.h"

IMPLEMENT_PRIMARY_GAME_MODULE(FTSMNativeModule, TSMNative, "TSMNative");

void FTSMNativeModule::StartupModule()
{
    UE_LOG(LogTemp, Log, TEXT("TSM Native runtime initialized: application network transport disabled."));
}

void FTSMNativeModule::ShutdownModule()
{
    UE_LOG(LogTemp, Log, TEXT("TSM Native runtime shutdown."));
}
