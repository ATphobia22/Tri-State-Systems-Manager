#!/usr/bin/env python3
"""Configure installed Unreal authoring plugins; never install dependencies."""
import argparse
import json
from pathlib import Path


def configure(project, houdini=False, flowgraph=False):
    project = Path(project).resolve(strict=True)
    data = json.loads(project.read_text(encoding='utf-8'))
    # Check optional plugins before changing the descriptor.
    requested = (['HoudiniEngine'] if houdini else []) + (['Flow', 'TSMTraining'] if flowgraph else [])
    available = {p.stem for root in (project.parent / 'Plugins',) for p in root.rglob('*.uplugin')}
    missing = set(requested) - available
    if missing:
        raise ValueError('Install reviewed project plugins first: ' + ', '.join(sorted(missing)))
    plugins = data.setdefault('Plugins', [])

    def enable(name, editor=False):
        entry = next((p for p in plugins if p['Name'] == name), None)
        if entry is None:
            entry = {'Name': name}
            plugins.append(entry)
        entry['Enabled'] = True
        if editor:
            entry['TargetAllowList'] = ['Editor']

    enable('CesiumForUnreal')
    for name in ('PythonScriptPlugin', 'EditorScriptingUtilities', 'MovieRenderPipeline'):
        enable(name, True)
    if houdini:
        enable('HoudiniEngine', True)
    if flowgraph:
        enable('Flow')
        enable('TSMTraining')
    backup = project.with_suffix('.uproject.before-tools')
    if not backup.exists():
        backup.write_bytes(project.read_bytes())
    project.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('project', type=Path)
    parser.add_argument('--houdini', action='store_true')
    parser.add_argument('--flowgraph', action='store_true')
    args = parser.parse_args()
    configure(args.project, args.houdini, args.flowgraph)


if __name__ == '__main__':
    main()
