#!/usr/bin/env python3
"""Static release guard for native offline Inno Setup configuration."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
ISS = ROOT / "tsm-native" / "Installer" / "TSM-Native.iss"

class NativeInstallerPolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.script = ISS.read_text(encoding="utf-8")
        cls.active = "\n".join(line for line in cls.script.splitlines()
                               if line.strip() and not line.lstrip().startswith(";"))

    def test_native_executable_only(self):
        self.assertIn('TSMNative.exe', self.active)
        self.assertIn('SetupArchitecture=x64', self.active)
        self.assertIn('ArchitecturesAllowed=x64compatible', self.active)

    def test_no_legacy_services_or_network_mutations(self):
        for token in ("initdb.exe", "pg_ctl.exe", "sc.exe", "netsh",
                      "TwinWatchdog", "verify_network_fidelity", "WebRTC",
                      "DefaultReceiveWindow", "DefaultSendWindow"):
            self.assertNotIn(token.lower(), self.active.lower())

    def test_no_uninstall_evidence_deletion(self):
        self.assertNotRegex(self.active.lower(), r"\[uninstalldelete\]")
        self.assertNotIn("deltree(", self.active.lower())

    def test_shipping_source_is_required(self):
        self.assertRegex(self.active, r'Source:\s*"\.\.\\\.\.\\dist\\tsm-native\\Windows\\TSMNative\\\*"')

if __name__ == "__main__":
    unittest.main()
