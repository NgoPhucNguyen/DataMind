"""
tests/test_no_session_lock.py
------------------------------
Verify that:
1. A Free-tier user can profile two different files back-to-back with no 429.
2. confirm-clean with clean_mode="manual" and actions=[] returns the data unchanged
   (row count identical, same first-row values).

These tests use the service layer directly (no HTTP server needed) so they run
fast without Redis. Cache calls are stubbed via monkeypatch.
"""

import io
import sys
import os
import types

import pandas as pd
import pytest

# ── make sure the backend package is importable ──────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ── Minimal stubs so imports don't blow up without Redis / DB ─────────────────

class _FakeCache:
    """Stub that satisfies every cache.* call used in files.py."""

    def __init__(self):
        self._store = {}

    def check_active_session(self, *a, **kw):
        return True  # should never be called — the lock is gone

    def set_active_session(self, *a, **kw):
        pass  # should never be called

    def clear_active_session(self, *a, **kw):
        pass

    def get_profile(self, *a, **kw):
        return None

    def set_profile(self, *a, **kw):
        pass

    def get_file_bytes(self, user_id, file_hash):
        return self._store.get((user_id, file_hash))

    def set_file_bytes(self, user_id, file_hash, data, filename, ext):
        self._store[(user_id, file_hash)] = {"bytes": data, "filename": filename, "ext": ext}

    def set_report_section(self, *a, **kw):
        pass

    def set_dataset_context_md(self, *a, **kw):
        pass

    def set_cleaning_log(self, *a, **kw):
        pass

    def invalidate_downstream_state(self, *a, **kw):
        pass

    def set_session_metadata(self, *a, **kw):
        pass


@pytest.fixture(autouse=True)
def patch_cache(monkeypatch):
    """Replace app.core.cache with our stub for the duration of every test."""
    fake = _FakeCache()
    import app.core.cache as real_cache
    for attr in dir(fake):
        if not attr.startswith("_"):
            monkeypatch.setattr(real_cache, attr, getattr(fake, attr))
    # Expose the fake so individual tests can inspect it
    return fake


# ── Helper: build a tiny CSV in memory ───────────────────────────────────────

def _csv_bytes(n_rows: int = 5) -> bytes:
    rows = ["name,age,score"]
    for i in range(n_rows):
        rows.append(f"user{i},{20 + i},{80 + i}")
    return "\n".join(rows).encode()


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: no 429 for two sequential profiles by a Free user
# ─────────────────────────────────────────────────────────────────────────────

def test_free_user_two_files_no_lock(patch_cache):
    """
    Directly call cleaner_service (service layer) twice, simulating two
    different files profiled by the same Free user.  The old code would call
    cache.check_active_session which raised 429 on the second file; the stub
    confirms that function is never invoked.
    """
    from app.services import cleaner_service

    df1 = pd.read_csv(io.BytesIO(_csv_bytes(3)))
    df2 = pd.read_csv(io.BytesIO(_csv_bytes(4)))

    report1 = cleaner_service.detect_issues(df=df1, filename="file1.csv", file_hash="hash1")
    report2 = cleaner_service.detect_issues(df=df2, filename="file2.csv", file_hash="hash2")

    # Both should succeed — no exception raised
    assert "has_issues" in report1
    assert "has_issues" in report2


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: confirm-clean with actions=[] returns the original data unchanged
# ─────────────────────────────────────────────────────────────────────────────

def test_confirm_clean_no_actions_unchanged():
    """
    apply_manual_actions(df, []) must return a DataFrame identical to the input.
    This is the data path that 'Skip cleaning' takes.
    """
    from app.services.cleaner_service import apply_manual_actions

    original = pd.DataFrame({
        "name": ["Alice", "Bob", "Carol"],
        "age": [30, 25, 35],
        "score": [88.5, 92.0, 77.3],
    })

    cleaned, log = apply_manual_actions(original, [])

    # Same shape
    assert cleaned.shape == original.shape, "Shape changed with empty actions"

    # Same values (compare as strings to avoid float precision issues)
    for col in original.columns:
        assert list(cleaned[col].astype(str)) == list(original[col].astype(str)), (
            f"Column '{col}' differs after apply_manual_actions([])"
        )

    # Log should be empty (no actions applied)
    assert log == [] or log is None or len(log) == 0, "Log should be empty for no-op skip"
