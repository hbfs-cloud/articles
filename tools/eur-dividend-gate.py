#!/usr/bin/env python3
"""Normalize frozen primary dividend reviews; never fetch or certify future absence.

This gate verifies provenance integrity and review coverage, not the truth of a
human primary-source assessment. Exchange-session bounds are supplied explicitly
by the dated reviews; this tool never substitutes a weekday calendar.
"""
import argparse
import hashlib
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = "eur-dividend-gate.v1"
CLEAR = "clear_published_schedule"
STATUSES = {
    "no_ex_date_in_published_approved_schedule": CLEAR,
    "none_in_current_published_schedule": CLEAR,
    "unknown": "unknown",
    "unknown_calendar_coverage_incomplete": "unknown",
    "confirmed_ex_in_window": "ex_in_window",
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read(path):
    return json.loads(Path(path).read_text())


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def path_label(path):
    path = Path(path).resolve()
    return str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path)


def resolve(path):
    p = Path(path)
    return p if p.is_absolute() else ROOT / p


def iso_date(value):
    require(isinstance(value, str), "Expected ISO date string")
    require(date.fromisoformat(value).isoformat() == value, f"Invalid date: {value}")
    return value


def timestamp(value):
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(parsed.tzinfo is not None, f"Capture timestamp lacks timezone: {value}")
    return value


def source_evidence(source, directory):
    url = source.get("url", "")
    require(urlparse(url).scheme in ("https", "http") and urlparse(url).hostname,
            f"Missing primary URL: {source.get('id')}")
    require(source.get("ok") is not False and source.get("status") != "failed"
            and not source.get("error"), f"Failed source used as evidence: {url}")
    if "status_code" in source:
        require(200 <= source["status_code"] < 300, f"HTTP failure used as evidence: {url}")
    captured = timestamp(source.get("fetched_at") or source.get("captured_at") or "")
    archives = []
    for file_key, hash_key in (("raw_file", "raw_sha256"),
                               ("text_file", "text_sha256"),
                               ("archive_file", "archive_sha256")):
        if source.get(file_key):
            file = (directory / source[file_key]).resolve()
            require(file.is_relative_to(directory.resolve()), f"Archive escapes review directory: {file}")
            require(file.is_file(), f"Missing archive: {file}")
            expected = source.get(hash_key)
            require(expected and digest(file) == expected, f"Archive hash mismatch: {file}")
            archives.append({"path": path_label(file), "sha256": expected})
    require(archives, f"No hashed archive for primary URL: {url}")
    return {"id": source["id"], "url": url, "fetched_at": captured,
            "representation": source.get("representation") or source.get("capture_method")
            or "HTTP body and extracted text", "archives": archives}


def event(raw):
    if raw is None:
        return None
    require(isinstance(raw, dict), "Dividend event must be an object")
    result = dict(raw)
    for field in ("ex_date", "record_date", "payment_date"):
        value = raw.get(field)
        result[field] = iso_date(value) if value else None
    result["gross_amount_per_share"] = raw.get("gross_amount_per_share", raw.get("gross_per_ordinary_share"))
    result["currency"] = raw.get("currency", raw.get("distribution_currency"))
    result["status"] = raw.get("status", raw.get("approval_status", "unknown"))
    result["type"] = raw.get("type", "unspecified_in_review")
    amount = result["gross_amount_per_share"]
    require(amount is None or (type(amount) in (int, float) and amount >= 0), "Invalid gross dividend amount")
    return result


def assemble(study_path, audit_paths, start, end):
    start, end = iso_date(start), iso_date(end)
    require(start <= end, "Window end precedes start")
    study_path = Path(study_path).resolve()
    study = read(study_path)
    reference = iso_date(study["spec"]["reference_close"])
    require(reference < start, "Dividend window must begin after reference close")
    sessions = study["spec"]["horizon_sessions"]
    require(type(sessions) is int and sessions > 0, "Invalid study horizon")
    ranking = study["ranking"]
    require(isinstance(ranking, list) and all(isinstance(s, str) for s in ranking)
            and len(ranking) == len(set(ranking)), "Invalid study ranking")
    audits, by_symbol = [], {}
    require(audit_paths, "At least one dated primary review is required")
    for audit_path in audit_paths:
        audit_path = Path(audit_path).resolve()
        audit = read(audit_path)
        require(audit.get("reference_date", audit.get("reference_close")) == reference,
                f"Stale review reference: {audit_path}")
        window = audit["window"]
        require(window["start"] == start and window["end"] == end,
                f"Review window mismatch: {audit_path}")
        require(window.get("sessions", window.get("sessions_assumed")) == sessions,
                f"Review horizon mismatch: {audit_path}")
        require(window.get("inclusive", True) is True, "Review window must be inclusive")
        reviewed = timestamp(audit.get("reviewed_as_of", audit.get("reviewed_at", "")))
        audit_ref = {"path": path_label(audit_path), "sha256": digest(audit_path), "reviewed_at": reviewed}
        if "reviews" in audit:
            rows = audit["reviews"]
            manifest_path = audit_path.parent / "manifest.json"
            manifest = read(manifest_path)
            sources = {s["id"]: s for s in manifest["sources"]}
            require(len(sources) == len(manifest["sources"]), "Duplicate primary source identifiers")
            audit_ref["manifest"] = {"path": path_label(manifest_path), "sha256": digest(manifest_path)}
        else:
            rows = list(audit["by_symbol"].values())
            require(all(k == v["symbol"] for k, v in audit["by_symbol"].items()), "Review symbol/key mismatch")
            sources = audit["sources"]
        audits.append(audit_ref)
        for row in rows:
            symbol = row["symbol"]
            require(symbol not in by_symbol, f"Duplicate dividend review: {symbol}")
            require(row["window_start"] == start and row["window_end"] == end,
                    f"Stale per-symbol window: {symbol}")
            raw_status = row.get("window_ex_date_status", row.get("window_status"))
            require(raw_status in STATUSES, f"Unrecognized review status for {symbol}: {raw_status}")
            status = STATUSES[raw_status]
            require(row.get("coverage_basis"), f"Missing coverage rationale: {symbol}")
            ids = row.get("source_ids", [])
            require(ids and len(ids) == len(set(ids)), f"Missing/duplicate primary sources: {symbol}")
            evidence = [source_evidence(sources[s], audit_path.parent) for s in ids]
            schedule = [event(e) for e in row.get("approved_or_scheduled_distributions_reviewed",
                                                row.get("approved_and_announced_schedule", []))]
            require(schedule or status == "unknown", f"No approved/published schedule: {symbol}")
            in_window = [e for e in schedule if e["ex_date"] and start <= e["ex_date"] <= end]
            require((status == "ex_in_window") == bool(in_window),
                    f"Review status contradicts dated ex-events: {symbol}")
            if "ex_in_window" in row:
                expected = None if status == "unknown" else bool(in_window)
                require(row["ex_in_window"] is expected, f"Inconsistent ex-event flag: {symbol}")
            by_symbol[symbol] = {
                "symbol": symbol, "status": status, "original_review_status": raw_status,
                "in_ranking": symbol in ranking, "dividend_gate_actionable": symbol in ranking and status == CLEAR,
                "requires_rebase": status == "ex_in_window", "coverage_basis": row["coverage_basis"],
                "source_urls": [s["url"] for s in evidence], "sources": evidence,
                "review_path": path_label(audit_path), "review_sha256": digest(audit_path),
                "reviewed_at": reviewed, "schedule": schedule, "in_window_events": in_window,
                "in_window_payment_events": [e for e in schedule if e["payment_date"] and start <= e["payment_date"] <= end],
                "next_event": event(row.get("next_ex_distribution", row.get("next_known_distribution"))),
                "next_known_distribution": event(row.get("next_known_distribution")),
                "unknown_fields": row.get("unknown_fields", row.get("missing_or_provisional_fields", [])),
            }
    require(not set(ranking) - set(by_symbol), f"Ranked symbols lack primary review: {sorted(set(ranking) - set(by_symbol))}")
    actionable = [s for s in ranking if by_symbol[s]["dividend_gate_actionable"]]
    research_only = [s for s in ranking if s not in actionable]
    rebases = sorted(s for s, r in by_symbol.items() if r["requires_rebase"])
    return {
        "schema_version": SCHEMA, "reference_close": reference,
        "window": {"start": start, "end": end, "sessions": sessions, "inclusive": True,
                   "basis": "Explicit matching dated primary-review bounds and study horizon; no weekday or exchange-calendar inference"},
        "study": {"path": path_label(study_path), "sha256": digest(study_path), "ranking": ranking},
        "audits": audits, "by_symbol": by_symbol,
        "actionable_symbols": actionable, "research_only_symbols": research_only,
        "rebase_required_symbols": rebases,
        "counts": {"reviewed": len(by_symbol), "ranked": len(ranking), "actionable": len(actionable),
                   "research_only_ranked": len(research_only),
                   "clear_published_schedule": sum(r["status"] == CLEAR for r in by_symbol.values()),
                   "unknown": sum(r["status"] == "unknown" for r in by_symbol.values()),
                   "ex_in_window": len(rebases)},
        "limits": ["Clear means no ex-date in the reviewed published/approved schedule, not guaranteed absence of later announcements.",
                   "Unknown coverage and in-window detachments remain research-only; ex-events require rebuilding price references before action.",
                   "Actionable here means dividend-gate eligible only, not an order or approval of other investment criteria.",
                   "Gross receivables, payment dates and price returns are distinct; no personal tax, FX execution or purification assumption is made.",
                   "Hash validation proves the frozen evidence chain, not issuer authenticity or factual correctness of human reviews."],
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    build = sub.add_parser("build", help="Merge already collected primary reviews and verify all referenced archive hashes")
    build.add_argument("--study", required=True, type=Path)
    build.add_argument("--audit", required=True, action="append", type=Path, help="Dated primary review JSON; repeat for each source bundle")
    build.add_argument("--window-start", required=True, help="Inclusive ISO date, matching all primary reviews")
    build.add_argument("--window-end", required=True, help="Inclusive ISO date, matching all primary reviews")
    build.add_argument("--output", required=True, type=Path)
    validate = sub.add_parser("validate", help="Rebuild from frozen audits and study; reject missing/tampered evidence or changed actionability")
    validate.add_argument("--input", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        if args.command == "build":
            result = assemble(args.study, args.audit, args.window_start, args.window_end)
            result["generated_at"] = datetime.now(timezone.utc).isoformat()
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        else:
            actual = read(args.input)
            timestamp(actual.pop("generated_at"))
            result = assemble(resolve(actual["study"]["path"]),
                              [resolve(a["path"]) for a in actual["audits"]],
                              actual["window"]["start"], actual["window"]["end"])
            require(actual == result, "Dividend artifact differs from reconstructed frozen evidence")
        print(json.dumps({"status": "PASS", "counts": result["counts"],
                          "actionable_symbols": result["actionable_symbols"],
                          "research_only_symbols": result["research_only_symbols"],
                          "rebase_required_symbols": result["rebase_required_symbols"]}))
        return 0
    except (ValueError, KeyError, TypeError, OSError) as exc:
        print(json.dumps({"status": "FAIL", "error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
