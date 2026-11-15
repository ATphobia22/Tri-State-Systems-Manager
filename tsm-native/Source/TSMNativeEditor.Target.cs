using UnrealBuildTool;

/**
 * Editor target — compiles TSMNative with Unreal Editor (UE 5.8).
 * Canonical path: Source/TSMNativeEditor.Target.cs (UBT convention).
 */
public class TSMNativeEditorTarget : TargetRules
{
	public TSMNativeEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_8;
		ExtraModuleNames.Add("TSMNative");
	}
}
