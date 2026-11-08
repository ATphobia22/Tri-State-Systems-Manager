"""Configure TSM's existing local tileset actor in the open editor map."""
import os
from pathlib import Path
import unreal


def main():
    root = Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()
    tileset = Path(os.environ['TSM_LOCAL_TILESET']).resolve(strict=True)
    relative = tileset.relative_to(root).as_posix()
    cls = unreal.load_class(None, '/Script/TSMNative.TSMOfflineTileset')
    if cls is None:
        raise RuntimeError('Compile TSMNative before configuring tiles')
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    actors = [a for a in subsystem.get_all_level_actors() if a.get_class() == cls]
    if len(actors) > 1:
        raise RuntimeError('Multiple offline tileset actors; select one manually')
    actor = actors[0] if actors else subsystem.spawn_actor_from_class(cls, unreal.Vector(0, 0, 0))
    if actor is None:
        raise RuntimeError('Could not create offline actor')
    actor.set_actor_label('TSM_OfflineBuildings')
    actor.set_editor_property('local_tileset_json_relative_path', relative)
    actor.set_editor_property('maximum_screen_space_error', 8.0)
    unreal.log('Configured ' + relative + '. Review placement and save the map.')


if __name__ == '__main__':
    main()
