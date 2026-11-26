"""Test release launcher in a synthetic bundle, no external dependencies."""
import os
from pathlib import Path
import subprocess

LAUNCHER=Path(__file__).resolve().parents[1]/"runtime/roofer-tool.sh"

def test_roofer_isolates_release_data_and_preserves_args(tmp_path):
    for d in ("bin","lib","share/proj","share/gdal"):
        (tmp_path/d).mkdir(parents=True)
    exe=tmp_path/"bin/roofer"
    exe.write_text('#!/bin/bash\nprintf "%s\\n" "$PROJ_DATA" "$GDAL_DATA" "$LD_LIBRARY_PATH" "$PROJ_NETWORK" "$@"\n')
    exe.chmod(0o755)
    env={**os.environ,"TSM_ROOFER_PREFIX":str(tmp_path),"PROJ_DATA":"/wrong","GDAL_DATA":"/wrong","LD_LIBRARY_PATH":"/wrong","PROJ_NETWORK":"ON"}
    r=subprocess.run(["bash",str(LAUNCHER),"--help-all"],env=env,check=True,text=True,capture_output=True)
    assert r.stdout.splitlines()==[str(tmp_path/"share/proj"),str(tmp_path/"share/gdal"),str(tmp_path/"lib"),"OFF","--help-all"]

def test_roofer_rejects_missing_or_nonexecutable_binary(tmp_path):
    env={**os.environ,"TSM_ROOFER_PREFIX":str(tmp_path)}
    r=subprocess.run(["bash",str(LAUNCHER)],env=env,text=True,capture_output=True)
    assert r.returncode==2 and "Missing release" in r.stderr
    (tmp_path/"bin").mkdir()
    (tmp_path/"bin/roofer").touch()
    r=subprocess.run(["bash",str(LAUNCHER)],env=env,text=True,capture_output=True)
    assert r.returncode==2 and "not executable" in r.stderr
