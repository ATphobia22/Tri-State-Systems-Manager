from __future__ import annotations

import hashlib
import os
from pathlib import Path
from subprocess import CompletedProcess
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from backend.engineering.hec_ras_worker import run_worker, sha256_file, sha256_tree


class HecRasWorkerTests(unittest.TestCase):
    def test_file_and_tree_hashes_are_deterministic(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "a.txt").write_text("alpha", encoding="utf-8")
            (root / "nested").mkdir()
            (root / "nested" / "b.txt").write_text("beta", encoding="utf-8")

            self.assertEqual(sha256_file(root / "a.txt"), sha256_file(root / "a.txt"))
            self.assertEqual(sha256_tree(root), sha256_tree(root))

    def test_tree_hash_matches_canonical_cross_platform_manifest_encoding(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "a.txt").write_text("alpha", encoding="utf-8")
            (root / "nested").mkdir()
            (root / "nested" / "b.txt").write_text("beta", encoding="utf-8")

            expected = hashlib.sha256()
            for relative, path in (
                ("a.txt", root / "a.txt"),
                ("nested/b.txt", root / "nested" / "b.txt"),
            ):
                expected.update(relative.encode("utf-8"))
                expected.update(b"\0")
                expected.update(bytes.fromhex(sha256_file(path)))

            self.assertEqual(sha256_tree(root), expected.hexdigest())

    def test_tree_hash_rejects_symlinks_to_prevent_package_escape(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory) / "package"
            root.mkdir()
            outside = Path(directory) / "outside.txt"
            outside.write_text("outside package", encoding="utf-8")
            try:
                (root / "external.txt").symlink_to(outside)
            except (NotImplementedError, OSError) as exc:
                self.skipTest(f"Symlink creation unavailable: {exc}")

            with self.assertRaisesRegex(ValueError, "symbolic link"):
                sha256_tree(root)

    def test_tree_hash_requires_an_existing_directory(self) -> None:
        with TemporaryDirectory() as directory:
            missing = Path(directory) / "missing"
            with self.assertRaises((FileNotFoundError, ValueError)):
                sha256_tree(missing)

            file_path = Path(directory) / "not-a-directory.txt"
            file_path.write_text("data", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "directory"):
                sha256_tree(file_path)

    def test_worker_rejects_nonempty_output_directory_to_avoid_stale_results(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            package = root / "package"
            output = root / "output"
            package.mkdir()
            output.mkdir()
            (package / "input.prj").write_text("model", encoding="utf-8")
            (output / "stale.hdf").write_bytes(b"stale")

            with self.assertRaisesRegex(ValueError, "must be empty"):
                run_worker(["worker"], package, output)

    def test_worker_rejects_overlapping_package_and_output_directories(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            package = root / "package"
            package.mkdir()
            (package / "input.prj").write_text("model", encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "separate, non-nested"):
                run_worker(["worker"], package, package / "output")

    def test_worker_rejects_invalid_timeout_values_including_boolean(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            package = root / "package"
            package.mkdir()
            (package / "input.prj").write_text("model", encoding="utf-8")

            for timeout in (True, False, 0, -1, 86_401, 1.5):
                with self.subTest(timeout=timeout):
                    with self.assertRaisesRegex(ValueError, "integer between 1 and 86400"):
                        run_worker(["worker"], package, root / f"output-{timeout}", timeout_seconds=timeout)

    def test_worker_rejects_a_string_instead_of_argument_sequence(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            package = root / "package"
            package.mkdir()
            (package / "input.prj").write_text("model", encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "sequence of non-blank strings"):
                run_worker("worker", package, root / "output")

    @patch("backend.engineering.hec_ras_worker.subprocess.run")
    def test_worker_hashes_only_fresh_outputs_and_keeps_results_unvalidated(self, run_mock) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            package = root / "package"
            output = root / "output"
            package.mkdir()
            (package / "input.prj").write_text("model", encoding="utf-8")
            output.mkdir()

            def complete_worker(*args, **kwargs):
                self.assertFalse(kwargs["shell"])
                self.assertEqual(kwargs["cwd"], package.resolve())
                (output / "result.hdf").write_bytes(b"new solver output")
                return CompletedProcess(args[0], 0, stdout="completed", stderr="")

            run_mock.side_effect = complete_worker
            result = run_worker(["worker", "--input", "input.prj"], package, output)

            self.assertEqual(result["return_code"], 0)
            self.assertEqual(result["input_manifest_sha256"], sha256_tree(package))
            self.assertEqual(result["result_sha256"], sha256_tree(output))
            self.assertEqual(result["stdout"], "completed")
            self.assertEqual(result["validation_state"], "unvalidated")
            self.assertTrue(result["human_review_required"])

    @patch("backend.engineering.hec_ras_worker.subprocess.run")
    def test_nonzero_exit_is_never_promoted_to_validated_evidence(self, run_mock) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            package = root / "package"
            output = root / "output"
            package.mkdir()
            output.mkdir()
            (package / "input.prj").write_text("model", encoding="utf-8")
            run_mock.return_value = CompletedProcess(["worker"], 17, stdout="", stderr="solver error")

            result = run_worker(["worker"], package, output)

            self.assertEqual(result["return_code"], 17)
            self.assertIsNone(result["result_sha256"])
            self.assertEqual(result["validation_state"], "unvalidated")
            self.assertTrue(result["human_review_required"])


if __name__ == "__main__":
    unittest.main()
