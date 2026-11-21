"""Register TSM Editor-only authoring menu; never generate scene on startup."""
import unreal

try:
    import tsm_mv_widget
    tsm_mv_widget.register_menu()
    unreal.log("TSM Mount Vernon authoring menu registered")
except Exception as exc:
    unreal.log_warning("TSM Mount Vernon authoring menu unavailable: " + str(exc))
