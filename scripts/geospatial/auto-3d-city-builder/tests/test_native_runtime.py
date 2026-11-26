"""Native runtime isolation regression tests, without external downloads."""
import os
from pathlib import Path
import subprocess

WRAPPER=Path(__file__).resolve().parents[1]/"runtime/native-tool.sh"

def fixture(tmp_path):
    prefix=tmp_path/"native"
    for d in ("share/proj","share/gdal","bin","lib"):
        (prefix/d).mkdir(parents=True,exist_ok=True)
    (prefix/"share/proj/proj.db").touch()
    executable=prefix/"bin/pdal"
    executable.write_text('#!/bin/bash\nprintf "%s\\n" "$PROJ_DATA" "$PROJ_LIB" "$GDAL_DATA" "$PROJ_NETWORK" "$LD_LIBRARY_PATH" "${GDAL_DRIVER_PATH-unset}" "$@"\n')
    executable.chmod(0o755)
    link=tmp_path/"pdal"
    link.symlink_to(WRAPPER)
    env={**os.environ,"TSM_PDAL_PREFIX":str(prefix),"PROJ_DATA":"/wrong/proj",
         "PROJ_LIB":"/wrong/legacy","GDAL_DATA":"/wrong/gdal","PROJ_NETWORK":"ON",
         "LD_LIBRARY_PATH":"/wrong/lib","GDAL_DRIVER_PATH":"/wrong/plugins"}
    return prefix,link,env

def test_native_cli_uses_matching_database_not_host_environment(tmp_path):
    prefix,link,env=fixture(tmp_path)
    result=subprocess.run(["bash",str(link),"pipeline","test.json"],env=env,check=True,text=True,capture_output=True)
    assert result.stdout.splitlines()==[str(prefix/"share/proj"),str(prefix/"share/proj"),
        str(prefix/"share/gdal"),"OFF",str(prefix/"lib"),"unset","pipeline","test.json"]

def test_native_cli_fails_before_execution_without_database(tmp_path):
    prefix,link,env=fixture(tmp_path)
    (prefix/"share/proj/proj.db").unlink()
    result=subprocess.run(["bash",str(link)],env=env,text=True,capture_output=True)
    assert result.returncode==2
    assert "Missing native PROJ database" in result.stderr
    assert not result.stdout
