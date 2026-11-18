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
    def test_single_read_input_prevents_parse_hash_file_race(self):
        code = SOURCE.read_text(encoding="utf-8")
        self.assertIn("FUTF8ToTCHAR", code)
        self.assertEqual(code.count("FFileHelper::LoadFileToArray(Bytes, *Input)"), 1)
        self.assertNotIn("FFileHelper::LoadFileToString(JsonText, *Input)", code)

    def test_receipt_is_created_exclusively_without_overwrite_race(self):
        code = SOURCE.read_text(encoding="utf-8")
        self.assertRegex(code, r"CreateFileWriter\(\s*\*ReceiptPath,\s*FILEWRITE_NoReplaceExisting\)")
        self.assertNotIn("FFileHelper::SaveStringToFile(ReceiptText, *ReceiptPath)", code)

    def test_passport_fact_types_are_bounded_before_public_export(self):
        code = SOURCE.read_text(encoding="utf-8")
        self.assertIn('TryGetStringField(TEXT("parcelId")', code)
        self.assertIn('TryGetStringField(TEXT("countyFips")', code)
        self.assertIn('TryGetBoolField(TEXT("sourceBytesVerifiedNotSourceClaims")', code)
        self.assertIn('TryGetBoolField(TEXT("controlPointVerified")', code)
        self.assertIn("EJson::Object", code)
        self.assertIn('TryGetArrayField(TEXT("reasons")', code)
        self.assertIn("EJson::Number", code)
        self.assertIn('TryGetArrayField(TEXT("reasons")', code)

    def test_sanitized_json_is_exported_instead_of_untrusted_raw_input(self):
        code = SOURCE.read_text(encoding="utf-8")
        self.assertIn("FJsonSerializer::Serialize(Passport.ToSharedRef(), SanitizedWriter)", code)
        self.assertIn("Output->Serialize(ExportBytes.GetData(), ExportBytes.Num())", code)
        self.assertNotIn("Output->Serialize(Bytes.GetData(), Bytes.Num())", code)

    def test_export_bytes_are_read_back_before_receipt_claim(self):
        code = SOURCE.read_text(encoding="utf-8")
        self.assertIn("FFileHelper::LoadFileToArray(ExportReadback, *ExportJson)", code)
        self.assertIn("ReadbackHash != FileSha256", code)

    def test_native_receipt_hashes_actual_export_bytes(self):
        code=SOURCE.read_text(encoding="utf-8")
        self.assertIn("TsmSha256HexOfString",code)
        self.assertIn("tsm.native.passport-json-export.v1",code)
        self.assertIn("DECLARED_NOT_REVALIDATED",code)

if __name__=="__main__":
    unittest.main()
