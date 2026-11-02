import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import admissions  # noqa: E402


class MilestoneTest(unittest.TestCase):
    def test_2008_takes_last_selective_csat(self):
        m = admissions.milestones(2008)
        self.assertEqual(m.high_entry, 2024)
        self.assertEqual(m.csat_exam_year, 2026)  # 2026.11.19 시행
        self.assertEqual(m.admission_year, 2027)

    def test_2009_is_first_2028_reform_cohort(self):
        m = admissions.milestones(2009)
        self.assertEqual(m.middle_entry, 2022)  # 지역인재 중학교 요건 첫 대상
        self.assertEqual(m.high_entry, 2025)  # 고교학점제·5등급 첫 고1
        self.assertEqual(m.admission_year, 2028)

    def test_2012_first_middle_2022_curriculum(self):
        self.assertEqual(admissions.milestones(2012).middle_entry, 2025)

    def test_grade_changes_in_march(self):
        self.assertEqual(admissions.grade_in(2009, 2026, 11), "고2")
        self.assertEqual(admissions.grade_in(2009, 2027, 2), "고2")
        self.assertEqual(admissions.grade_in(2009, 2027, 3), "고3")
        self.assertEqual(admissions.grade_in(2020, 2026, 11), "미취학")
        self.assertEqual(admissions.grade_in(2014, 2026, 11), "초6")


class DataTest(unittest.TestCase):
    def test_data_is_valid(self):
        self.assertEqual(admissions.validate(), [])

    def test_region_filter(self):
        rules = admissions.load("rules")["rules"]
        seoul = {r["id"] for r in admissions.rules_for(2012, "seoul", rules)}
        gyeonggi = {r["id"] for r in admissions.rules_for(2012, "gyeonggi", rules)}
        self.assertIn("seoul-hs-absolute-grade", seoul)
        self.assertNotIn("seoul-hs-absolute-grade", gyeonggi)
        self.assertIn("gyeonggi-equalized-hs", gyeonggi)
        self.assertIn("csat-integrated-2028", seoul & gyeonggi)


if __name__ == "__main__":
    unittest.main()
