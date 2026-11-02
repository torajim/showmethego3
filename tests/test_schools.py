import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import fetch_schools as fs  # noqa: E402


class SchoolsTest(unittest.TestCase):
    def test_num(self):
        self.assertEqual(fs.num("940(15)"), 940)
        self.assertEqual(fs.num("  18.9"), 18.9)
        self.assertEqual(fs.num(31), 31)
        self.assertIsNone(fs.num(""))
        self.assertIsNone(fs.num(None))

    def test_merge(self):
        base = {"SCHUL_CODE": "S1", "SCHUL_NM": "가나고등학교", "HS_KND_SC_NM": "자율고등학교", "FOND_SC_CODE": "사립",
                "COEDU_SC_CODE": "남녀공학", "SCHUL_RDNMA": "경기도 용인시 수지구 ", "LTTUD": 37.3, "LGTUD": 127.1,
                "HMPG_ADRES": "", "ABSCH_YN": "N", "CLOSE_YN": "N", "DGHT_SC_CODE": "주간"}
        closed = {**base, "SCHUL_CODE": "S2", "ABSCH_YN": "Y"}
        night = {**base, "SCHUL_CODE": "S3", "DGHT_SC_CODE": "야간"}
        rows = {
            "0": [base, closed, night],
            "09": [{"SCHUL_CODE": "S1", "COL_S_SUM": 900, "COL_S1": 300, "COL_S2": 310, "COL_S3": 290,
                    "COL_C_SUM": 30, "COL_SUM": 30.0, "TEACH_CNT": 60, "TEACH_CAL": 15.0}],
            "10": [{"SCHUL_CODE": "S1", "MVIN_SUM": 12, "MVT_SUM": 20}],
            "56": [{"SCHUL_CODE": "S1", "CREAT_EXPER_ACT_CCCLU_FGR": 30, "STDNT_SLCTL_CCCLU_FGR": 12}],
        }
        out = fs.merge("gyeonggi", "용인시 수지구", "04", rows)
        self.assertEqual(len(out), 1)
        s = out[0]
        self.assertEqual(s["kind"], "자율고")
        self.assertEqual(s["level"], "high")
        self.assertEqual(s["addr"], "경기도 용인시 수지구")
        self.assertIsNone(s["url"])
        self.assertEqual(s["byGrade"], [300, 310, 290])
        self.assertEqual(s["clubs"], 42)
        self.assertEqual((s["moveIn"], s["moveOut"]), (12, 20))

    def test_merge_missing_details(self):
        base = {"SCHUL_CODE": "S9", "SCHUL_NM": "다라중학교", "ABSCH_YN": "N", "CLOSE_YN": "N"}
        s = fs.merge("seoul", "강남구", "03", {"0": [base]})[0]
        self.assertIsNone(s["kind"])
        self.assertIsNone(s["students"])
        self.assertIsNone(s["clubs"])

    def test_no_key(self):
        import os
        from unittest import mock
        env = {k: v for k, v in os.environ.items() if k not in ("SCHOOLINFO_API_KEY", "GITHUB_ACTIONS")}
        with mock.patch.dict(os.environ, env, clear=True):
            self.assertEqual(fs.main([]), 0)  # 로컬에서는 조용히 건너뜀
            os.environ["GITHUB_ACTIONS"] = "true"
            self.assertEqual(fs.main([]), 1)  # Actions에서는 실패로 표시


if __name__ == "__main__":
    unittest.main()
