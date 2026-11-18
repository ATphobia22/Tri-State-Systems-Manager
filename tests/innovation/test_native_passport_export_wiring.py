"""Native C++ GUI integration contracts; actual Win64 Shipping still requires runner."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/"tsm-native/Source/TSMNative/TSMEngineeringHUD.cpp"

class NativePassportExportWiringTests(unittest.TestCase):
    def test_explicit_operator_action_and_no_webview(self):
        code=SOURCE.read_text(encoding="utf-8")
        self.assertIn("EXPORT PASSPORT JSON",code)
        self.assertIn("ExportCivicPassport",code)
        self.assertNotIn('#include "WebBrowser.h"',code)
        self.assertNotIn("FPlatformProcess::CreateProc",code)
        self.assertNotIn("FPlatformProcess::LaunchURL",code)
    def test_source_is_constrained_to_local_audited_passport(self):
        code=SOURCE.read_text(encoding="utf-8")
        self.assertIn("tsm.public-evidence.passport.v1",code)
        self.assertIn("regulatoryDetermination",code)
        self.assertIn("engineeringUse",code)
        self.assertIn("surveyCertification",code)
        self.assertIn("FILEWRITE_NoReplaceExisting",code)
    def test_native_receipt_hashes_actual_export_bytes(self):
        code=SOURCE.read_text(encoding="utf-8")
        self.assertIn("TsmSha256HexOfString",code)
        self.assertIn("tsm.native.passport-json-export.v1",code)
        self.assertIn("DECLARED_NOT_REVALIDATED",code)

if __name__=="__main__":
    unittest.main()
