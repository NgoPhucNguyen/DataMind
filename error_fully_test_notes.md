# error_fully.xlsx — Test File Notes (v2, mapped to CAPABILITIES.md)

Rebuilt against the actual documented capabilities in `docs/CAPABILITIES.md`
(2026-08-02), instead of guessing. 42 data rows — enough to clear the
`correlation` (≥10 rows) and semantic-error thresholds (`≥ MAX(3, 5%)`)
described in Section 2.

Columns: STT, Tên công ty, Email, Số điện thoại, Danh mục SP, Ngày đặt hàng,
Số lượng, Đơn giá, Địa chỉ

## Mapped to detection logic

| Column | Expected classification | Planted issues |
|---|---|---|
| STT | numeric / SEQUENCE_NUMBER | Row 21: negative value (-5) — should trip `SEQUENCE_NUMBER` validation (must be > 0) |
| Tên công ty | categorical or text | Row 3: missing; Row 17: encoding garbage; Row 22: leading/trailing whitespace |
| Email | text / EMAIL semantic | Row 4: `not-an-email`; Row 14: `another_bad_email.com` — both should fail the EMAIL regex |
| Số điện thoại | text / PHONE_NUMBER semantic | Row 9: `abc-phone`; Row 19: `123` (too short); Row 28: `0000000` (edge case — passes length regex, worth checking if it should be flagged some other way) |
| Danh mục SP | multiple_choice | Row 20: 5 comma-separated tokens — tests the explode/unique-count path still classifies correctly |
| Ngày đặt hàng | datetime / DATE_TIME | Mixed formats throughout (YYYY-MM-DD vs DD/MM/YYYY) per the ≥80% `_try_datetime` threshold; Row 12: missing; Row 23: `"not a date"` (hard invalid) |
| Số lượng | numeric | Row 7: missing; Row 31: Vietnamese text `"hai muoi"` instead of number (type_mismatch); Rows 33–34: outliers (500, 480) for IQR detection |
| Đơn giá | disguised numeric / MONEY semantic | Mixed currency formats: `"$45.50"`, `"VND 320000"`, `"1,250,000đ"`, plain `"XXXXXX đ"`; Row 16: missing; Row 26: `"N/A"` placeholder |
| Địa chỉ | ADDRESS semantic | Row 18: encoding garbage (`"Đ?a ch? l?i"`) |
| (rows 41–42) | duplicates | Exact duplicates of rows 5 and 10 appended at the end — tests non-adjacent duplicate detection |

## What to verify at each stage, using CAPABILITIES.md as the checklist

**Profiler**
- Đơn giá should still classify as numeric/disguised-numeric despite `$`, `VND`, `đ`, and comma variants (Section 1's `NUMERIC_PATTERNS_STRIP` regex).
- Ngày đặt hàng should classify as datetime despite the two mixed formats — but confirm whether the 80% threshold holds with `"not a date"` and the missing value included in the sample.
- Danh mục SP should still be `multiple_choice`, not miscategorized as `text`, even with the 5-token row.

**Cleaner — detect_issues**
- `missing`: STT/company/date/price gaps should all surface.
- `duplicates`: rows 41–42 should be caught.
- `type_mismatch`: row 31 ("hai muoi" in a numeric column).
- `encoding`: rows 17–18.
- `semantic_error`: email rows 4/14, phone rows 9/19, and STT row 21 (negative) should all be flagged — confirm the threshold logic (`≥ MAX(3, 5% of non-null rows)`) actually fires given only ~2-3 violations per column at 42 rows (5% of 42 ≈ 2.1, so `MAX(3, 2.1) = 3` — email and phone each only have 2 bad values, so **this may NOT trigger** at current volumes; worth checking whether that's expected or whether you want to add a 3rd bad value per column to guarantee the flag fires).

**Cleaner — auto_clean / manual actions**
- Per Section 3's known gap: semantic errors (bad emails/phones) have **no automated cleaning action** — confirm they pass through untouched and are only fixable via `BATCH_EDIT_CELLS`, not silently "fixed" by auto-clean.
- Confirm `drop_column` doesn't accidentally trigger on any column here (none should hit the ≥90% missing threshold).

**Visualize**
- `histogram`/`box_plot`/`correlation`/`scatter` should all be available given 2 numeric columns (Số lượng, Đơn giá) and 42 rows (clears the ≥10 threshold for correlation).
- Outlier detection (IQR) should flag rows 33–34 in Số lượng.
- `trend_data` (Section 5) should bin Ngày đặt hàng by day/month given the date range — confirm the missing/invalid date rows (12, 23) are excluded rather than breaking the resample.
- Per Section 5's documented gap: there should be **no** "Sum of Đơn giá by month" style aggregation available — confirm the UI doesn't imply this exists yet.

**Provenance / Report**
- `cleaning_log` should contain entries for missing-value fills, duplicate removal, and type conversion (Section 6) — but nothing for semantic errors, per the known gap.
- `cleaning_provenance` should attach to Số lượng, Đơn giá, Ngày đặt hàng, Tên công ty in the visualize response.
- `report_sections` should update independently per stage as before.

## Note on the semantic-error threshold
Given the observation above (5% of 42 rows ≈ 2.1 → threshold rounds up to 3
minimum), if you want to *guarantee* semantic_error triggers in a single
pass without relying on percentage math, either shrink the file to ~20-30
rows (raising the 5% floor's bite) or add one more bad value per semantic
column. Left as-is intentionally, so you can also verify the threshold math
itself is working — not just check the theoretical detection.
