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

    def test_calendar_exact_dates_have_sources_and_match_cohorts(self):
        events = {e["id"]: e for e in admissions.load("calendar")["events"]}
        csat = events["csat"]
        self.assertTrue(csat["sources"])
        # 2008년생 수능은 2026년, 2009년생은 2027년(통합형 첫 수능)
        for birth_year in (2008, 2009):
            year = admissions.milestones(birth_year).csat_exam_year
            self.assertIn(str(year), csat["exact"])
            self.assertTrue(csat["exact"][str(year)].startswith(f"{year}-11-"))

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


class StatsTest(unittest.TestCase):
    def test_every_stat_has_a_known_source(self):
        ids = {s["id"] for s in admissions.load("sources")["sources"]}
        self.assertEqual(admissions.validate_stats(ids), [])

    def test_missing_source_is_reported(self):
        self.assertTrue(admissions.validate_stats(set()))

    def test_susi_share_keeps_rising_through_2028(self):
        pts = admissions.load("stats")["susiJeongsi"]["points"]
        self.assertEqual(pts[-1]["year"], 2028)
        shares = [p["susi"] for p in pts]
        self.assertEqual(shares, sorted(shares))


class GuideTest(unittest.TestCase):
    def setUp(self):
        self.ids = {s["id"] for s in admissions.load("sources")["sources"]}
        self.cov = admissions.load("meta")["coverage"]

    def test_every_card_term_and_answer_has_a_known_source(self):
        self.assertEqual(admissions.validate_guide(self.ids, self.cov), [])

    def test_missing_source_is_reported(self):
        self.assertTrue(admissions.validate_guide(set(), self.cov))

    def test_three_reform_cards(self):
        ids = [r["id"] for r in admissions.load("guide")["reforms"]]
        self.assertEqual(ids, ["reform-2028", "credit-system", "grade-5"])
