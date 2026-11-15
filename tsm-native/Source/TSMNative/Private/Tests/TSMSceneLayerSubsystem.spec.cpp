// Unreal Automation Framework tests for UTSMSceneLayerSubsystem
// (lens / layer visibility). Class name is the subsystem — there is no
// separate ATSMSceneLayerManager type in this repo.
//
// Run (Editor host with UE 5.8):
//   UnrealEditor-Cmd.exe TSMNative.uproject -ExecCmds="Automation RunTests TSM.SceneLayer;Quit" -unattended -NullRHI

#include "Misc/AutomationTest.h"
#include "TSMSceneLayerSubsystem.h"
#include "Engine/World.h"
#include "Engine/Engine.h"
#include "Tests/AutomationCommon.h"

#if WITH_DEV_AUTOMATION_TESTS

namespace
{
/** 64 hex chars — valid shape for RegisterLayerActor SHA gate. */
const TCHAR* ValidSha =
	TEXT("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
const TCHAR* BadShaShort = TEXT("abc");
const TCHAR* BadShaNonHex =
	TEXT("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz");

UTSMSceneLayerSubsystem* GetOrCreateSceneLayers(UWorld* World)
{
	if (!World)
	{
		return nullptr;
	}
	return World->GetSubsystem<UTSMSceneLayerSubsystem>();
}
} // namespace

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FTSMSceneLayerDefaultVisibilityTest,
	"TSM.SceneLayer.DefaultVisibility",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FTSMSceneLayerDefaultVisibilityTest::RunTest(const FString& Parameters)
{
	UWorld* World = AutomationCommon::CreateWorld();
	TestNotNull(TEXT("Automation world"), World);
	if (!World)
	{
		return false;
	}

	UTSMSceneLayerSubsystem* Layers = GetOrCreateSceneLayers(World);
	TestNotNull(TEXT("UTSMSceneLayerSubsystem"), Layers);
	if (!Layers)
	{
		return false;
	}

	// Initialize defaults: Terrain..Roads visible; Floodplain+ hidden.
	const FTSMSceneLayerState Terrain = Layers->GetLayerState(ETSMSceneLayer::Terrain);
	const FTSMSceneLayerState Buildings = Layers->GetLayerState(ETSMSceneLayer::Buildings);
	const FTSMSceneLayerState Roads = Layers->GetLayerState(ETSMSceneLayer::Roads);
	const FTSMSceneLayerState Flood = Layers->GetLayerState(ETSMSceneLayer::Floodplain);
	const FTSMSceneLayerState Proposed =
		Layers->GetLayerState(ETSMSceneLayer::ProposedConstruction);

	TestTrue(TEXT("Terrain requested visible by default"), Terrain.bRequestedVisible);
	TestTrue(TEXT("Buildings requested visible by default"), Buildings.bRequestedVisible);
	TestTrue(TEXT("Roads requested visible by default"), Roads.bRequestedVisible);
	TestFalse(TEXT("Floodplain hidden by default"), Flood.bRequestedVisible);
	TestFalse(TEXT("ProposedConstruction hidden by default"), Proposed.bRequestedVisible);
	TestEqual(TEXT("No actors => SOURCE_UNAVAILABLE"), Terrain.Status, FString(TEXT("SOURCE_UNAVAILABLE")));
	TestFalse(TEXT("No rendered geometry without registration"), Terrain.bRenderedVisible);

	AutomationCommon::DestroyWorld(World);
	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FTSMSceneLayerVisibilityToggleTest,
	"TSM.SceneLayer.VisibilityToggle",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FTSMSceneLayerVisibilityToggleTest::RunTest(const FString& Parameters)
{
	UWorld* World = AutomationCommon::CreateWorld();
	TestNotNull(TEXT("Automation world"), World);
	if (!World)
	{
		return false;
	}

	UTSMSceneLayerSubsystem* Layers = GetOrCreateSceneLayers(World);
	TestNotNull(TEXT("UTSMSceneLayerSubsystem"), Layers);
	if (!Layers)
	{
		return false;
	}

	Layers->SetLayerVisibility(ETSMSceneLayer::Floodplain, true);
	TestTrue(
		TEXT("Floodplain requested after enable"),
		Layers->GetLayerState(ETSMSceneLayer::Floodplain).bRequestedVisible);

	Layers->SetLayerVisibility(ETSMSceneLayer::Buildings, false);
	TestFalse(
		TEXT("Buildings requested after disable"),
		Layers->GetLayerState(ETSMSceneLayer::Buildings).bRequestedVisible);

	// Still no actors: rendered stays false / status unavailable.
	const FTSMSceneLayerState B = Layers->GetLayerState(ETSMSceneLayer::Buildings);
	TestFalse(TEXT("Hidden buildings not rendered without actors"), B.bRenderedVisible);
	TestEqual(TEXT("Status remains SOURCE_UNAVAILABLE"), B.Status, FString(TEXT("SOURCE_UNAVAILABLE")));

	AutomationCommon::DestroyWorld(World);
	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FTSMSceneLayerRegisterRejectsBadShaTest,
	"TSM.SceneLayer.RegisterRejectsBadSha",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FTSMSceneLayerRegisterRejectsBadShaTest::RunTest(const FString& Parameters)
{
	UWorld* World = AutomationCommon::CreateWorld();
	TestNotNull(TEXT("Automation world"), World);
	if (!World)
	{
		return false;
	}

	UTSMSceneLayerSubsystem* Layers = GetOrCreateSceneLayers(World);
	TestNotNull(TEXT("UTSMSceneLayerSubsystem"), Layers);
	if (!Layers)
	{
		return false;
	}

	// Null actor / empty source / bad SHA must fail without inventing geometry.
	TestFalse(
		TEXT("Null actor rejected"),
		Layers->RegisterLayerActor(
			ETSMSceneLayer::Buildings, nullptr, TEXT("src-a"), ValidSha, false));
	TestFalse(
		TEXT("Short SHA rejected"),
		Layers->RegisterLayerActor(
			ETSMSceneLayer::Buildings, nullptr, TEXT("src-a"), BadShaShort, false));
	TestFalse(
		TEXT("Non-hex SHA rejected"),
		Layers->RegisterLayerActor(
			ETSMSceneLayer::Buildings, nullptr, TEXT("src-a"), BadShaNonHex, false));
	TestFalse(
		TEXT("Empty SourceId rejected"),
		Layers->RegisterLayerActor(
			ETSMSceneLayer::Buildings, nullptr, TEXT(""), ValidSha, false));

	AutomationCommon::DestroyWorld(World);
	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FTSMSceneLayerProfileNameSafetyTest,
	"TSM.SceneLayer.ProfileNameSafety",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FTSMSceneLayerProfileNameSafetyTest::RunTest(const FString& Parameters)
{
	UWorld* World = AutomationCommon::CreateWorld();
	TestNotNull(TEXT("Automation world"), World);
	if (!World)
	{
		return false;
	}

	UTSMSceneLayerSubsystem* Layers = GetOrCreateSceneLayers(World);
	TestNotNull(TEXT("UTSMSceneLayerSubsystem"), Layers);
	if (!Layers)
	{
		return false;
	}

	TestFalse(TEXT("Empty profile name"), Layers->SaveVisibilityProfile(TEXT("")));
	TestFalse(TEXT("Path traversal rejected"), Layers->SaveVisibilityProfile(TEXT("../evil")));
	TestFalse(TEXT("Slash rejected"), Layers->SaveVisibilityProfile(TEXT("a/b")));
	TestTrue(TEXT("Safe name accepted"), Layers->SaveVisibilityProfile(TEXT("default_profile")));
	TestTrue(TEXT("Safe name loads"), Layers->LoadVisibilityProfile(TEXT("default_profile")));

	AutomationCommon::DestroyWorld(World);
	return true;
}

#endif // WITH_DEV_AUTOMATION_TESTS
