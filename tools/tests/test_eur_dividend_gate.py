"""Integrity and fail-closed regressions for the frozen dividend review gate."""
import contextlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("dividend_gate", Path(__file__).resolve().parents[1] / "eur-dividend-gate.py")
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class DividendGateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.study = self.root / "study.json"
        self.review = self.root / "review.json"
        self.raw = self.root / "primary.txt"
        self.raw.write_text("Frozen issuer distribution announcement")
        self.write(self.study, {"spec": {"reference_close": "2030-01-04", "horizon_sessions": 10},
                                "ranking": ["CLEAR", "UNKNOWN", "EX"]})
        self.audit = {
            "reference_close": "2030-01-04", "reviewed_at": "2030-01-04T18:00:00+00:00",
            "window": {"start": "2030-01-07", "end": "2030-01-18", "sessions_assumed": 10},
            "sources": {"issuer": {"id": "issuer", "url": "https://issuer.example/dividends",
                                    "captured_at": "2030-01-04T17:00:00+00:00", "ok": True,
                                    "text_file": "primary.txt", "text_sha256": gate.digest(self.raw)}},
            "by_symbol": {},
        }
        for symbol, status, ex in [
            ("CLEAR", "none_in_current_published_schedule", "2030-02-01"),
            ("UNKNOWN", "unknown_calendar_coverage_incomplete", None),
            ("EX", "confirmed_ex_in_window", "2030-01-18"),
            ("UNRANKED", "none_in_current_published_schedule", "2030-02-01"),
        ]:
            self.audit["by_symbol"][symbol] = {
                "symbol": symbol, "window_start": "2030-01-07", "window_end": "2030-01-18",
                "window_status": status, "source_ids": ["issuer"],
                "coverage_basis": "Human review of full published distribution schedule",
                "approved_and_announced_schedule": [{"ex_date": ex, "payment_date": "2030-02-07",
                                                      "gross_per_ordinary_share": 1,
                                                      "distribution_currency": "EUR", "approval_status": "approved"}],
            }
        self.write(self.review, self.audit)

    @staticmethod
    def write(path, value):
        path.write_text(json.dumps(value))

    def build(self):
        return gate.assemble(self.study, [self.review], "2030-01-07", "2030-01-18")

    def test_unknown_and_boundary_ex_stay_research_and_unranked_audit_survives(self):
        result = self.build()
        self.assertEqual(result["actionable_symbols"], ["CLEAR"])
        self.assertEqual(result["research_only_symbols"], ["UNKNOWN", "EX"])
        self.assertEqual(result["rebase_required_symbols"], ["EX"])
        self.assertIn("UNRANKED", result["by_symbol"])

    def test_archive_mutation_fails(self):
        self.raw.write_text("Replaced source")
        with self.assertRaisesRegex(ValueError, "hash mismatch"):
            self.build()

    def test_missing_ranked_review_fails(self):
        del self.audit["by_symbol"]["UNKNOWN"]
        self.write(self.review, self.audit)
        with self.assertRaisesRegex(ValueError, "lack primary review"):
            self.build()

    def test_stale_window_and_horizon_fail(self):
        self.audit["window"]["end"] = "2030-01-21"
        self.write(self.review, self.audit)
        with self.assertRaisesRegex(ValueError, "window mismatch"):
            self.build()
        self.audit["window"].update(end="2030-01-18", sessions_assumed=5)
        self.write(self.review, self.audit)
        with self.assertRaisesRegex(ValueError, "horizon mismatch"):
            self.build()

    def test_false_clear_with_known_ex_event_fails(self):
        self.audit["by_symbol"]["EX"]["window_status"] = "none_in_current_published_schedule"
        self.write(self.review, self.audit)
        with self.assertRaisesRegex(ValueError, "contradicts"):
            self.build()

    def test_validate_rejects_actionability_and_study_changes(self):
        original = self.build()
        original["generated_at"] = "2030-01-04T19:00:00+00:00"
        artifact = self.root / "dividends.json"
        self.write(artifact, original)
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(gate.main(["validate", "--input", str(artifact)]), 0)
            original["actionable_symbols"].append("UNKNOWN")
            self.write(artifact, original)
            self.assertEqual(gate.main(["validate", "--input", str(artifact)]), 1)
            original["actionable_symbols"].remove("UNKNOWN")
            self.write(artifact, original)
            study = gate.read(self.study)
            study["ranking"].reverse()
            self.write(self.study, study)
            self.assertEqual(gate.main(["validate", "--input", str(artifact)]), 1)

    def test_failed_capture_cannot_become_primary_evidence(self):
        self.audit["sources"]["issuer"]["ok"] = False
        self.write(self.review, self.audit)
        with self.assertRaisesRegex(ValueError, "Failed source"):
            self.build()


if __name__ == "__main__":
    unittest.main()
