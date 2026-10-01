using UnrealBuildTool;
using System.IO;

public class TSMNative : ModuleRules
{
    public TSMNative(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicIncludePaths.Add(
            Path.GetFullPath(Path.Combine(ModuleDirectory, "../../../../native/archimedes/include")));

        PublicDependencyModuleNames.AddRange(
            new[]
            {
                "Core",
                "CoreUObject",
                "Engine",
                "InputCore",
                "EnhancedInput",
                "HeadMountedDisplay",
                "OpenXRHMD",
                "OpenXRInput",
                "UMG",
                "Slate",
                "SlateCore",
                "SQLiteCore",
                "CesiumRuntime",
                "HTTP",
                "Json",
                "TSMCrypto"
            });

        PrivateDependencyModuleNames.AddRange(new[] { "SQLiteSupport" });

        PublicDefinitions.Add("TSM_NATIVE_OFFLINE_RUNTIME=1");
    }
}
