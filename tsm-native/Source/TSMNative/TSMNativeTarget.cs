using UnrealBuildTool;

public class TSMNativeTarget : TargetRules
{
    public TSMNativeTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V6;
        IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_8;
        ExtraModuleNames.Add("TSMNative");
    }
}
