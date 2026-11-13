#!/usr/bin/env python3
"""Unreal native installer: signed offline payload and publish-once online manifest tests."""
from __future__ import annotations
import importlib.util
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
SCRIPT=ROOT/"tsm-native/Installer/TSM-Native.iss"
BUILDER=ROOT/"scripts/native/Build-TSMNativeWindows.ps1"
WORKFLOW=ROOT/".github/workflows/tsm-native.yml"
MANIFEST=ROOT/"scripts/release/create_native_winget_manifest.py"


def load_generator():
    spec=importlib.util.spec_from_file_location("tsm_native_winget",MANIFEST)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class OfflineSetupTests(unittest.TestCase):
    def test_compiler_signs_setup_uninstaller_and_temporary_copies(self):
        installer=SCRIPT.read_text(encoding="utf-8")
        self.assertIn("SignTool=tsmrelease",installer)
        self.assertIn("SignedUninstaller=yes",installer)
        self.assertIn("SetupArchitecture=x64",installer)
        self.assertIn("ArchitecturesAllowed=x64compatible",installer)
        self.assertNotIn("download",installer.lower())

    def test_installer_is_compiled_with_pinned_release_signer(self):
        builder=BUILDER.read_text(encoding="utf-8")
        self.assertIn("--signtool=tsmrelease=",builder)
        self.assertIn("TSM_WINDOWS_SIGNING_CERT_SHA1",builder)
        self.assertIn("TSM_WINDOWS_TIMESTAMP_URL",builder)
        self.assertIn("signtool.exe",builder)
        self.assertIn("SignedUninstaller",SCRIPT.read_text(encoding="utf-8"))
        self.assertIn("ISCC.exe",builder)

    def test_workflow_does_not_resign_setup_after_compilation(self):
        workflow=WORKFLOW.read_text(encoding="utf-8")
        block=workflow.split("- name: Sign Windows release artifacts",1)[1].split(
            "- name: Verify all three signed Windows release binaries",1)[0]
        self.assertIn("verify /pa /all",block)
        self.assertNotIn("sign /sha1",block)


class WingetManifestTests(unittest.TestCase):
    def setUp(self):
        self.m=load_generator()
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.version="1.0.0"
        self.installer=self.root/"TSM-Native-Setup-1.0.0-windows-x64.exe"
        self.installer.write_bytes(b"MZ"+bytes(range(256))*16)
        self.digest=hashlib.sha256(self.installer.read_bytes()).hexdigest()
        self.commit="a"*40
        self.receipt=self.root/"signed.json"
        self.receipt.write_text(json.dumps({
            "schema":"tsm.native.signed-artifact-inventory.v1",
            "state":"SIGNED_ARTIFACT_INTEGRITY_VERIFIED_OFFLINE_RUNTIME_PENDING",
            "source_commit":self.commit,
            "signed_files":[{"role":"offline_installer","filename":self.installer.name,
                             "sha256":self.digest,"authenticode":"Valid",
                             "signer_thumbprint":"b"*40,
                             "timestamp_certificate_present":True}]
        }))
        self.url=("https://github.com/ATphobia22/Tri-State-Systems-Manager/releases/"
                  "download/v1.0.0/"+self.installer.name)

    def manifest(self):
        return self.m.generate_manifest(self.installer,self.receipt,self.url,self.version)

    def test_manifest_contains_exact_local_sha256_and_https_github_url(self):
        text=self.manifest()
        self.assertIn("InstallerType: inno",text)
        self.assertIn("PackageVersion: 1.0.0",text)
        self.assertIn("InstallerSha256: "+self.digest.upper(),text)
        self.assertIn("InstallerUrl: "+self.url,text)
        self.assertIn("License: Apache-2.0",text)
        self.assertIn("ManifestType: singleton",text)

    def test_mismatching_digest_rejected(self):
        receipt=json.loads(self.receipt.read_text())
        receipt["signed_files"][0]["sha256"]="0"*64
        self.receipt.write_text(json.dumps(receipt))
        with self.assertRaisesRegex(ValueError,"SHA-256"):
            self.manifest()

    def test_missing_signing_evidence_rejected(self):
        receipt=json.loads(self.receipt.read_text())
        receipt["signed_files"][0]["authenticode"]="Unknown"
        self.receipt.write_text(json.dumps(receipt))
        with self.assertRaisesRegex(ValueError,"Authenticode"):
            self.manifest()

    def test_untrusted_or_mismatched_release_url_rejected(self):
        for url in [
            "http://github.com/ATphobia22/Tri-State-Systems-Manager/releases/download/v1.0.0/"+self.installer.name,
            "https://example.com/"+self.installer.name,
            "https://github.com/ATphobia22/Tri-State-Systems-Manager/releases/download/v0.9.9/"+self.installer.name,
            self.url+"?token=secret",
            self.url.replace("ATphobia22","evilrepo"),
        ]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                self.m.generate_manifest(self.installer,self.receipt,url,self.version)

    def test_filename_version_mismatch_rejected(self):
        with self.assertRaises(ValueError):
            self.m.generate_manifest(self.installer,self.receipt,self.url,"2.0.0")

    def test_unverified_release_runtime_never_claimed(self):
        self.assertNotIn("ShippingVerified",self.manifest())


if __name__=="__main__":
    unittest.main()
