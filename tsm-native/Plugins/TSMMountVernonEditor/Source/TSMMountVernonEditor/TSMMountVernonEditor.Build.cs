using UnrealBuildTool;

public class TSMMountVernonEditor : ModuleRules
{
    public TSMMountVernonEditor(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PrivateDependencyModuleNames.AddRange(new string[] {
            "Core", "CoreUObject", "Engine", "UMG", "Slate", "SlateCore",
            "UnrealEd", "Blutility", "PythonScriptPlugin"
        });
    }
}
