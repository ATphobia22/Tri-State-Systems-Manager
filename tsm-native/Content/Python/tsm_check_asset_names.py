"""Check TSM asset conventions; this is not full style-guide compliance."""
import re
import unreal

PREFIXES = dict(StaticMesh='SM_', SkeletalMesh='SK_', Material='M_',
                MaterialInstanceConstant='MI_', Texture2D='T_', Blueprint='BP_',
                WidgetBlueprint='WBP_', LevelSequence='LS_', World='L_')


def main():
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    failures = []
    for asset in registry.get_assets_by_path('/Game/TSM', recursive=True):
        name = str(asset.asset_name)
        prefix = PREFIXES.get(str(asset.asset_class_path.asset_name))
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]*', name):
            failures.append(str(asset.package_name) + ': invalid characters')
        if prefix and not name.startswith(prefix):
            failures.append(str(asset.package_name) + ': expected ' + prefix)
    for failure in failures:
        unreal.log_error(failure)
    if failures:
        raise RuntimeError(f'{len(failures)} naming violations')
    unreal.log('TSM asset naming check passed')


if __name__ == '__main__':
    main()
