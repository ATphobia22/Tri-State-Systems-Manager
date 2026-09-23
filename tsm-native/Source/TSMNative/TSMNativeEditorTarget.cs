using UnrealBuildTool;

public class TSMNativeEditorTarget : TargetRules
{
    public TSMNativeEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.V6;
        IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_8;
        ExtraModuleNames.Add("TSMNative");
    }
}
