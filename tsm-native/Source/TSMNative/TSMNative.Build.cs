using UnrealBuildTool;
using System.IO;

/**
 * TSMNative module rules (Unreal Engine 5.8).
 *
 * Public: Core/Engine for World Partition, subsystems, game framework.
 * Private/Public UI: Slate + SlateCore for engineering HUD; UMG for widgets.
 * Geospatial: CesiumRuntime (pinned Cesium for Unreal).
 * Evidence offline: SQLiteCore/SQLiteSupport, TSMCrypto, HTTP/Json adapters.
 * XR optional: OpenXR modules when HMD path is enabled.
 *
 * Does not claim Shipping acceptance — only compile-time dependency wiring.
 */
public class TSMNative : ModuleRules
{
	public TSMNative(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		// Optional Archimedes / survey math headers (present when native/archimedes is checked out).
		var archimedesInclude = Path.GetFullPath(
			Path.Combine(ModuleDirectory, "../../../native/archimedes/include"));
		if (Directory.Exists(archimedesInclude))
		{
			PublicIncludePaths.Add(archimedesInclude);
		}

		PublicDependencyModuleNames.AddRange(
			new string[]
			{
				"Core",
				"CoreUObject",
				"Engine",          // World Partition, subsystems, data layers
				"InputCore",
				"EnhancedInput",
				"HeadMountedDisplay",
				"OpenXRHMD",
				"OpenXRInput",
				"UMG",
				"Slate",           // Engineering HUD (runtime)
				"SlateCore",
				"SQLiteCore",
				"CesiumRuntime",
				"HTTP",
				"Json",
				"TSMCrypto"
			});

		PrivateDependencyModuleNames.AddRange(
			new string[]
			{
				"SQLiteSupport"
			});

		if (Target.Platform == UnrealTargetPlatform.Win64 && Target.Configuration == UnrealTargetConfiguration.Shipping)
		{
			RuntimeDependencies.Add("$(ProjectDir)/Binaries/ArchimedesCore.dll", StagedFileType.NonUFS);
			RuntimeDependencies.Add("$(ProjectDir)/Binaries/mod_spatialite.dll", StagedFileType.NonUFS);
		}

		PublicDefinitions.Add("TSM_NATIVE_OFFLINE_RUNTIME=1");
	}
}
