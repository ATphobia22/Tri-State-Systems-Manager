using UnrealBuildTool;

public class TSMTraining : ModuleRules
{
    public TSMTraining(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(
            new[] { "Core", "CoreUObject", "Engine", "Flow" });
    }
}
