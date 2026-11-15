using UnrealBuildTool;

/**
 * Standalone / Shipping game target for TSMNative (UE 5.8).
 * Canonical path: Source/TSMNative.Target.cs (UBT convention).
 */
public class TSMNativeTarget : TargetRules
{
	public TSMNativeTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_8;
		ExtraModuleNames.Add("TSMNative");
	}
}
