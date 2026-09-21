using UnrealBuildTool;

public class TSMNative : ModuleRules
{
    public TSMNative(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

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
