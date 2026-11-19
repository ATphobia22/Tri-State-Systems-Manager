"""One-click UE5.8 Editor Utility Widget for the checked Mount Vernon source scene.

Controls are created from source on first launch and bound to Python callbacks
when the editor tab opens. Editor-only: never imported by a Shipping executable.
"""
from __future__ import annotations

import os

WIDGET_PATH = "/Game/TSM/MountVernon/Editor/EUW_TSM_MountVernon"
_ACTIVE_BINDINGS = {}


def _create_widget(unreal):
    asset = unreal.EditorAssetLibrary.load_asset(WIDGET_PATH)
    if asset is not None:
        if not isinstance(asset, unreal.EditorUtilityWidgetBlueprint):
            raise RuntimeError("Conflicting asset exists at " + WIDGET_PATH)
        return asset
    factory = unreal.EditorUtilityWidgetBlueprintFactory()
    factory.set_editor_property("parent_class", unreal.EditorUtilityWidget)
    asset = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        "EUW_TSM_MountVernon", "/Game/TSM/MountVernon/Editor",
        unreal.EditorUtilityWidgetBlueprint, factory)
    if asset is None:
        raise RuntimeError("Unable to create Editor Utility Widget Blueprint")
    add = unreal.EditorUtilityLibrary.add_source_widget
    add(asset, unreal.VerticalBox, unreal.Name("Root"), unreal.Name("None"))
    heading = add(asset, unreal.TextBlock, unreal.Name("Heading"), unreal.Name("Root"))
    heading.set_text(unreal.Text("Mount Vernon 47620 | TSM source scene"))
    hint = add(asset, unreal.TextBlock, unreal.Name("Hint"), unreal.Name("Root"))
    hint.set_text(unreal.Text("Set TSM_MV_SCENE_DIR before starting UE5.8. Source checks mandatory."))
    for name, title in (
        ("Validate", "1 | Validate Inputs"),
        ("Generate", "2 | Generate Town + RVT"),
        ("RVT", "3 | Set Up RVT Materials"),
    ):
        add(asset, unreal.Button, unreal.Name(name), unreal.Name("Root"))
        label = add(asset, unreal.TextBlock, unreal.Name(name + "Label"), unreal.Name(name))
        label.set_text(unreal.Text(title))
    status = add(asset, unreal.TextBlock, unreal.Name("Status"), unreal.Name("Root"))
    status.set_text(unreal.Text("Idle | No source evidence has been verified"))
    unreal.BlueprintEditorLibrary.compile_blueprint(asset)
    if not unreal.EditorAssetLibrary.save_loaded_asset(asset):
        raise RuntimeError("Could not persist generated EUW asset")
    return asset


def open_panel():
    """Open a dockable EUW tab, wiring its three controls for this editor session."""
    import unreal

    asset = _create_widget(unreal)
    subsystem = unreal.get_editor_subsystem(unreal.EditorUtilitySubsystem)
    instance = subsystem.find_utility_widget_from_blueprint(asset)
    if instance is None:
        instance = subsystem.spawn_and_register_tab(asset)
    if instance is None:
        raise RuntimeError("Editor Utility tab failed to open")

    status = instance.get_widget_from_name("Status")
    if status is None:
        raise RuntimeError("EUW has no Status field; inspect and regenerate widget manually")

    def set_status(message):
        status.set_text(unreal.Text(message))
        unreal.log("TSM Mount Vernon: " + message)

    def run_command(action):
        try:
            if action == "RVT":
                import tsm_mv_rvt
                result = tsm_mv_rvt.setup()
            else:
                import tsm_mv_import
                path = os.environ.get("TSM_MV_SCENE_DIR", "")
                if not path:
                    raise RuntimeError("TSM_MV_SCENE_DIR is not set")
                if action == "Validate":
                    result = tsm_mv_import.run(path, dry_run=True)
                elif action == "Generate":
                    # Verify everything BEFORE creating materials or actors.
                    tsm_mv_import.run(path, dry_run=True)
                    import tsm_mv_rvt
                    tsm_mv_rvt.setup()
                    result = tsm_mv_import.run(path, save_map=True)
                else:
                    raise RuntimeError("Unknown action")
            set_status(action + " completed: " + str(result))
        except Exception as exc:
            set_status(action + " FAILED: " + str(exc))
            unreal.log_error("Mount Vernon generator: " + str(exc))

    key = instance.get_path_name()
    if key not in _ACTIVE_BINDINGS:
        callbacks = []
        for name in ("Validate", "Generate", "RVT"):
            button = instance.get_widget_from_name(name)
            if button is None:
                raise RuntimeError("Missing EUW button: " + name)
            callback = lambda action=name: run_command(action)
            button.on_clicked.add_callable(callback)
            callbacks.append(callback)
        _ACTIVE_BINDINGS[key] = callbacks
    set_status("Ready | Scene: " + (os.environ.get("TSM_MV_SCENE_DIR") or "(not configured)"))
    return instance


def register_menu():
    """Add Tools > TSM Mount Vernon Generator on UE Editor startup."""
    import unreal
    menus = unreal.ToolMenus.get()
    main = menus.extend_menu("LevelEditor.MainMenu.Tools")
    if main.find_section("TSM") is None:
        main.add_section("TSM", "Tri-State Systems Manager")
    entry = unreal.ToolMenuEntry(
        name=unreal.Name("TSM.MountVernonGenerator"),
        type=unreal.MultiBlockType.MENU_ENTRY)
    entry.set_label(unreal.Text("Mount Vernon Town Generator"))
    entry.set_tool_tip(unreal.Text("Open checked GIS source import and RVT setup panel"))
    entry.set_string_command(
        unreal.ToolMenuStringCommandType.PYTHON,
        unreal.Name(""),
        "import tsm_mv_widget; tsm_mv_widget.open_panel()")
    main.add_menu_entry("TSM", entry)
    menus.refresh_all_widgets()


if __name__ == "__main__":
    open_panel()
