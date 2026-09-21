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
                "SQLiteCore"
            });

        PrivateDependencyModuleNames.AddRange(new[] { "SQLiteSupport" });

        // Deliberately do not depend on HTTP, WebSockets, OnlineSubsystem,
        // WebBrowser, WebBrowserWidget, or SocketSubsystem modules.
    }
}
