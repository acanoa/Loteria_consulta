import tempfile
import unittest
from pathlib import Path

from app.services.processing import parse_lottery_csv


class CsvProcessingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.directory = Path(self.temporary_directory.name)

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def write_csv(self, content: str) -> Path:
        csv_file = self.directory / "draw.csv"
        csv_file.write_text(content, encoding="utf-8")
        return csv_file

    def test_parses_and_normalizes_csv(self) -> None:
        csv_file = self.write_csv(
            "NUMERO;FRACCIONES\n20;719\n00026;154\n"
        )
        self.assertEqual(
            parse_lottery_csv(csv_file),
            [("00020", 719), ("00026", 154)],
        )

    def test_rejects_duplicate_numbers(self) -> None:
        csv_file = self.write_csv("NUMERO;FRACCIONES\n20;1\n00020;2\n")
        with self.assertRaisesRegex(ValueError, "duplicado"):
            parse_lottery_csv(csv_file)

    def test_rejects_negative_fractions(self) -> None:
        csv_file = self.write_csv("NUMERO;FRACCIONES\n20;-1\n")
        with self.assertRaisesRegex(ValueError, "negativas"):
            parse_lottery_csv(csv_file)
