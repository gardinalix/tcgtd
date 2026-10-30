"""Cross-runtime smoke test: the browser-side XLSX must open as a real ZIP of valid XML."""
import io
import subprocess
import unittest
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class CardArchiveWorkbookTests(unittest.TestCase):
    def test_full_archive_is_readable_zip_with_valid_office_xml(self):
        program = """
import { readFileSync } from 'node:fs';
import { buildCardArchiveRows, buildCardArchiveXlsx } from './src/domain/cardArchiveExport.js';
const data = JSON.parse(readFileSync('web/app-data.json', 'utf8'));
const rows = buildCardArchiveRows([...data.cards, ...data.resourceCards], { includeVariants: true });
process.stdout.write(Buffer.from(buildCardArchiveXlsx(rows, { snapshot: data.cardSnapshotGeneratedAt })));
"""
        result = subprocess.run(
            ["node", "--input-type=module", "-e", program],
            cwd=ROOT,
            capture_output=True,
            check=True,
        )
        with zipfile.ZipFile(io.BytesIO(result.stdout), "r") as workbook:
            self.assertIsNone(workbook.testzip(), "ZIP CRC integrity failed")
            xml_files = [name for name in workbook.namelist() if name.endswith((".xml", ".rels"))]
            self.assertEqual(len(xml_files), 7)
            for name in xml_files:
                with self.subTest(xml_file=name):
                    ET.fromstring(workbook.read(name))
            sheet = ET.fromstring(workbook.read("xl/worksheets/sheet1.xml"))
            namespace = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
            rows = sheet.findall("./" + namespace + "sheetData/" + namespace + "row")
            self.assertGreater(len(rows), 1000)
            self.assertEqual(len(rows), 2032, "The committed 2026-10-23 snapshot contains 2,031 printings")

            rules = sheet.findall("./" + namespace + "conditionalFormatting")
            self.assertEqual(len(rules), 1)
            self.assertEqual(rules[0].get("sqref"), "E2:E2032")
            conditions = rules[0].findall("./" + namespace + "cfRule")
            self.assertEqual(len(conditions), 8)
            required = {"BLUE", "GREEN", "RED", "PURPLE", "WHITE", "NEUTRAL", "YELLOW", "BLACK"}
            detected = set()
            for condition in conditions:
                self.assertEqual(condition.get("type"), "expression")
                self.assertIsNotNone(condition.get("dxfId"))
                formula = condition.find("./" + namespace + "formula").text
                self.assertTrue(formula.startswith('UPPER(TRIM($E2))="'))
                detected.add(formula.split('"')[1])
            self.assertEqual(detected, required)
            styles = ET.fromstring(workbook.read("xl/styles.xml"))
            styles_dxfs = styles.find("./" + namespace + "dxfs")
            self.assertEqual(styles_dxfs.get("count"), "8")
            self.assertEqual(len(styles_dxfs), 8)



if __name__ == "__main__":
    unittest.main()
