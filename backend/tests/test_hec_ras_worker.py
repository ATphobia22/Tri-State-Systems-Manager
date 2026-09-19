from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from backend.engineering.hec_ras_worker import sha256_file, sha256_tree


class HecRasWorkerTests(unittest.TestCase):
    def test_file_and_tree_hashes_are_deterministic(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "a.txt").write_text("alpha", encoding="utf-8")
            (root / "nested").mkdir()
            (root / "nested" / "b.txt").write_text("beta", encoding="utf-8")
            self.assertEqual(sha256_file(root / "a.txt"), sha256_file(root / "a.txt"))
            self.assertEqual(sha256_tree(root), sha256_tree(root))


if __name__ == "__main__":
    unittest.main()
