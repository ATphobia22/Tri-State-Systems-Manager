#!/usr/bin/env python3
"""Static contract tests. They do not prove a compiled EXE or public trust."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
ISS = (ROOT / "tsm-native/Installer/TSM-Online.iss").read_text(encoding="utf-8")
PS1 = (ROOT / "scripts/native/Build-TSMOnlineInstaller.ps1").read_text(encoding="utf-8")
WORKFLOW = (ROOT / ".github/workflows/tsm-online-installer.yml").read_text(encoding="utf-8")
NATIVE_WORKFLOW = (ROOT / ".github/workflows/tsm-native.yml").read_text(encoding="utf-8")
TRUST = (ROOT / "scripts/native/Report-PublicAuthenticodeTrust.ps1").read_text(encoding="utf-8")


class OnlineInstallerPolicyTests(unittest.TestCase):
    def test_download_is_hardcoded_to_repository_and_pinned_sha256(self):
        self.assertIn("https://github.com/ATphobia22/Tri-State-Systems-Manager/releases/download/", ISS)
        self.assertIn("DownloadPage.Add('{#TSMReleaseURL}', '{#TSMOfflineFile}', '{#TSMOfflineSha256}')", ISS)
        self.assertIn("DownloadPage.Download;", ISS)
        self.assertIn("GetExceptionMessage", ISS)
        self.assertLess(ISS.index("DownloadPage.Download;"), ISS.index("Exec(InstalledSetup"))
        self.assertNotIn("DownloadTemporaryFile(", ISS)

    def test_bootstrapper_is_not_the_native_offline_installer(self):
        self.assertIn("CreateAppDir=no", ISS)
        self.assertIn("Uninstallable=no", ISS)
        self.assertIn("TSM-Online-Setup-", ISS)
        self.assertIn("TSM-Native-Setup-", ISS)
        self.assertIn("PrepareToInstall", ISS)
        self.assertIn("NeedsRestart", ISS)

    def test_release_identity_is_exact_and_untrusted_url_is_rejected(self):
        self.assertIn("^v([0-9]+)\\.([0-9]+)\\.([0-9]+)$", PS1)
        self.assertIn("^[0-9a-fA-F]{64}$", PS1)
        self.assertIn("hash", PS1.lower())
        self.assertIn("offlineFile", PS1)
        self.assertIn("SHA-256 does not match", PS1)
        self.assertIn("--define=TSMOfflineSha256=", PS1)
        self.assertIn("'NOT_EVIDENCED'", PS1)
        self.assertNotIn("New-SelfSignedCertificate", PS1)

    def test_build_only_on_explicit_dispatch_with_toolchain_digest(self):
        self.assertIn("workflow_dispatch:", WORKFLOW)
        self.assertIn("github.event_name == 'workflow_dispatch'", WORKFLOW)
        self.assertIn("8a5a6711c3766a6e5fb74f280ba0e3551e719ce94538d901fdbd1f8f9920b3f0", WORKFLOW)
        self.assertIn("Get-AuthenticodeSignature", WORKFLOW)
        self.assertIn("Build-TSMOnlineInstaller.ps1", WORKFLOW)
        self.assertIn("actions/attest@", WORKFLOW)
        self.assertNotIn("gh release upload", WORKFLOW)

    def test_trust_report_is_advisory_only(self):
        self.assertIn("ADVISORY_NON_BLOCKING", TRUST)
        self.assertIn("public_distribution_approved_by_this_check = $false", TRUST)
        self.assertIn("independent_windows11_chain", TRUST)
        self.assertIn("exit 0", TRUST)
        block = NATIVE_WORKFLOW.split("- name: Capture optional Windows signing evidence", 1)[1].split(
            "- name: Attest signed Windows artifact", 1
        )[0]
        self.assertIn("continue-on-error: true", block)
        self.assertIn("if: ${{ always() }}", block)


if __name__ == "__main__":
    unittest.main()
