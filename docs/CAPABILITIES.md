# DataMind Capabilities Reference

*Last updated: 2026-08-02*
*Note: This is a living document. It must be revised whenever new detection, cleaning, or visualization features are deployed.*

This document serves as the single source of truth describing what DataMind's pipeline can currently detect, handle, and visualize across its stages: Profiler, Cleaner, and Visualize. 

---

## 1. Column Type Detection (Profiler)
*Module: `app/services/profiler_service.py`*

DataMind detects column types dynamically without relying on column names.
- **`numeric`**: Detected via Pandas `is_numeric_dtype`. Also detects **disguised numeric** columns (e.g., string columns with currency symbols) using `is_disguised_numeric()` if ≥60% of the non-null string values can be successfully cast to float after stripping characters like `$, đ, %, VND`, commas, and parentheses.
- **`datetime`**: Detected via Pandas `is_datetime64_any_dtype`. For string columns, `_try_datetime()` samples the top 100 rows; if ≥80% parse successfully, the column is classified as `datetime`.
- **`multiple_choice`**: Detected if the column is string-based, contains commas in >20% of rows, and the exploded (split) tokens yield ≤25 unique values.
- **`categorical`**: Detected if the unique value count is ≤15 (and strictly less than total valid rows), or if the column dtype is boolean.
- **`text`**: Fallback type for string columns that have >15 unique values, or an average string length > 30 characters.

**Known Limitations:** 
- Disguised numeric stripping is naive and relies on a hardcoded regex (`NUMERIC_PATTERNS_STRIP`).
- Mixed date formats in a single column might fail the `_try_datetime` 80% threshold.

---

## 2. Data Issues Detected (Cleaner)
*Module: `app/services/cleaner_service.py` (`detect_issues`) and `app/services/semantic_rules.py`*

- **Missing Values (`missing`)**: Any `NaN/NaT/None` values.
- **Duplicate Rows (`duplicates`)**: Exact row-level duplicates across all columns (`df.duplicated()`).
- **Wrong Type (`type_mismatch`)**: Object columns inferred as `numeric` where some rows fail to convert to `float`.
- **Encoding Issues (`encoding`)**: String columns containing bad/unprintable characters detected via regex.
- **Semantic Errors (`semantic_error`)**: Validates cells based on an AI-inferred `semantic_type`. Current supported semantic types:
  - `EMAIL`: Regex validation `^[\w\.-]+@[\w\.-]+\.\w+$`.
  - `PHONE_NUMBER`: Strips spaces/dots/parens/hyphens, validates against `^\+?\d{7,15}$`.
  - `SEQUENCE_NUMBER`: Validates as an integer > 0.
  - `MONEY`: Regex allowing `+ - $ VNĐ đ` and commas/dots.
  - `DATE_TIME`: Validates via `pd.to_datetime`.
  - `CODE_ID`: Basic alphanumeric with dots/hyphens.
  - `PERSON_NAME` / `ADDRESS`: Length ≥ 2, cannot be all digits.
  - *Threshold Logic*: The system flags a column with semantic errors if violations are `≥ MAX(3, 5% of non-null rows)`.
  - *Downgrade Logic*: If violation rate > 50%, the severity is downgraded to a "hint" to avoid blocking the pipeline on poor AI semantic classification.

---

## 3. Cleaning Actions Available (Cleaner)
*Module: `app/services/cleaner_service.py` (`auto_clean` and `apply_manual_actions`)*

- **Drop Column**: Automatically drops columns with ≥90% missing values (`drop_column`). Manual support: `DROP_COLUMN`.
- **Drop Duplicates**: Keeps the first occurrence (`drop_duplicates`). Manual support: `DROP_DUPLICATES`.
- **Strip Bad Characters**: Fixes encoding issues in strings (`strip_bad_chars`). Manual support: `STRIP_BAD_CHARS`.
- **Convert to Numeric**: Strips currencies/chars and casts to `float64` (`convert_to_numeric`). Manual support: `CONVERT_TO_NUMERIC`.
- **Convert to Datetime**: Casts strings to `datetime64` coercing errors to `NaT` (`convert_to_datetime`). Manual support: `CONVERT_TO_DATETIME`.
- **Fill Missing**: 
  - Numeric: Fills with `median` (Auto). Manual supports Median, Mean, Mode, and Custom Value.
  - Categorical/Text: Fills with `"Không xác định"` (Auto). Manual supports Mode and Custom Value.
- **Rename Column**: Manual only (`RENAME_COLUMN`).
- **Batch Edit Cells**: Manual only (`BATCH_EDIT_CELLS` to overwrite specific cell `row_id` and `column`).

**Current Gaps:** 
- No automated cleaning actions for Semantic Errors (e.g., standardizing phones or fixing emails). Users must fix these via manual cell edits.

---

## 4. Visualization Capabilities (Visualize)
*Module: `app/services/cleaner_service.py` (`validate_clean_dataset`) & `app/services/visualize_service.py`*

DataMind determines chart capabilities dynamically based on dataset properties:
- **`bar_chart` / `pie_chart`**: Requires `len(df) >= 1`.
- **`histogram`**: Requires ≥ 1 numeric column and `len(df) >= 5`. 
- **`box_plot`**: Requires ≥ 1 numeric column.
- **`correlation`**: Requires ≥ 2 numeric columns and `len(df) >= 10`. Generates a full correlation matrix.
- **`scatter`**: Requires ≥ 2 numeric columns. Downsampled to 500 points using seeded random.
- **`line_chart`**: Requires `len(df) >= 2`.

**Additional Computed Stats:**
- **Distribution Bins**: Extracted for numeric columns with >10 unique values (20 bins).
- **Top Values**: Frequency counts for `categorical` and `multiple_choice` columns (top 10/15 items).
- **Outliers**: Identified via IQR (`1.5 * IQR`) for numeric columns.

---

## 5. Provenance & Reporting
**Status: RECENTLY IMPLEMENTED (Working).**

- **Provenance Tracking (`cleaning_log`)**: All actions in `auto_clean` and `apply_manual_actions` deterministically append to a structured log detailing the `column`, `action`, `rows_affected`, and `reason`.
- **Visualization Referencing**: `visualize_service.py` retrieves this `cleaning_log` via Redis and matches it to specific columns, emitting a `cleaning_provenance` array alongside the column's visualization statistics.
- **Incremental Report Assembly**: 
  - Reports are built using a `report_sections:{user_id}:{file_hash}` caching paradigm.
  - The Profiler and Cleaner stages independently save their sections to Redis. 
  - The Visualize stage stores confirmed charts. 
  - If a user navigates backwards to re-clean data, `cache.invalidate_downstream_state()` correctly drops the visualize section.
  - `/report/intro` merges these sections dynamically into a prompt for the LLM.

---

## 6. Known Gaps / Explicitly NOT Handled
- **Metric Aggregation over Time**: No resampling of numeric columns against datetime indices.
- **Automated Semantic Resolution**: No auto-clean rules for fixing PII or semantic formatting (addresses, phone numbers).
- **Outlier Pruning/Capping**: Visualize detects outliers, but Cleaner has no action rule to automatically cap or drop them.
- **Cross-Column Validation**: The pipeline evaluates columns in isolation. It cannot validate relational logic (e.g., `EndDate > StartDate`).
- **Multi-File Joins**: DataMind processes solitary uploaded files; there is no support for relational merging or VLOOKUP functionality between datasets.
