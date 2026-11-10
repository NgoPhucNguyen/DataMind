import pandas as pd
import numpy as np
import random
import io
import json
from app.services import cleaner_service
from app.services import chart_insights
from app.core.errors import DataMindException, ErrorSeverity
from app.core import cache
from app.core.rules import (
    VIZ_DISCRETE_MAX_UNIQUE,
    VIZ_DISCRETE_MAX_RANGE,
    VIZ_SCALE_MAX_VALUES,
    HIGH_MISSING_PCT,
    VIZ_CORR_MAX_COLS,
    VIZ_CORR_MIN_PAIR_N,
)


def _get_column_letter(df: pd.DataFrame, col: str, default_idx: int = 0) -> str:
    """Trả về ký tự chữ cái (A, B, ..., AA) của cột trong DataFrame."""
    column_letters = getattr(df, "attrs", {}).get("column_letters", {}) if hasattr(df, "attrs") else {}
    if col in column_letters:
        return column_letters[col]
    try:
        col_list = list(df.columns)
        idx = col_list.index(col) if col in col_list else default_idx
        return cleaner_service.col_index_to_letter(idx)
    except Exception:
        return cleaner_service.col_index_to_letter(default_idx)


def _inspect_discrete(series: pd.Series) -> dict:
    """
    Xác định một series số có phải dạng rời rạc (discrete / scale) hay không,
    và trả về danh sách đầy đủ các bậc (levels), bao gồm cả các bậc khuyết nếu là thang đo (scale).
    """
    valid = pd.to_numeric(series, errors="coerce").dropna()
    if valid.empty:
        return {"is_discrete": False, "is_scale": False, "levels": [], "scale_min": None, "scale_max": None}

    num_unique = int(valid.nunique())
    if not (2 <= num_unique <= VIZ_DISCRETE_MAX_UNIQUE):
        return {"is_discrete": False, "is_scale": False, "levels": [], "scale_min": None, "scale_max": None}

    val_min_f = float(valid.min())
    val_max_f = float(valid.max())
    is_integer = cleaner_service.is_integer_numeric(valid)
    is_max_scale = any(abs(val_max_f - bound) < 1e-9 for bound in VIZ_SCALE_MAX_VALUES)
    is_scale = bool(
        is_integer
        and val_min_f >= 0
        and is_max_scale
        and (val_max_f - val_min_f) <= VIZ_DISCRETE_MAX_RANGE
    )

    if is_scale:
        scale_min = 0 if abs(val_min_f) < 1e-9 else 1
        scale_max = int(round(val_max_f))
        levels = list(range(scale_min, scale_max + 1))
        return {
            "is_discrete": True,
            "is_scale": True,
            "levels": levels,
            "scale_min": scale_min,
            "scale_max": scale_max,
        }
    else:
        val_counts = valid.value_counts().sort_index()
        levels = [int(round(val)) if is_integer else float(val) for val in val_counts.index]
        return {
            "is_discrete": True,
            "is_scale": False,
            "levels": levels,
            "scale_min": None,
            "scale_max": None,
        }


def _compute_column_stats(
    df: pd.DataFrame,
    col: str,
    overridden_types: dict = None,
    profile_cols: dict = None,
    cleaning_log: list = None,
    col_idx: int = 0
) -> dict:
    """
    Tính toán thông số thống kê cho một cột trong DataFrame.
    Độc lập với Redis/cache để có thể gọi trực tiếp trong unit test.
    """
    if overridden_types is None:
        overridden_types = {}
    if profile_cols is None:
        profile_cols = {}
    if cleaning_log is None:
        cleaning_log = []

    series = df[col]
    missing_pct = round(float(series.isna().mean() * 100), 2)
    unique_count = int(series.nunique())

    # 1. Determine logical type (SSOT priority: override -> profiler -> fallback inference)
    col_override = overridden_types.get(col) or overridden_types.get(str(col))
    if col_override == "auto":
        col_override = None

    col_prof = profile_cols.get(col) or profile_cols.get(str(col))
    prof_detected = col_prof.get("detected_type") if col_prof else None

    VALID_TYPES = {"numeric", "datetime", "categorical", "multiple_choice", "text"}

    if col_override in VALID_TYPES:
        dtype = col_override
    elif prof_detected in VALID_TYPES:
        dtype = prof_detected
    else:
        # Fallback inference if profile expired or column missing
        if pd.api.types.is_numeric_dtype(series):
            dtype = "numeric"
        elif pd.api.types.is_datetime64_any_dtype(series):
            dtype = "datetime"
        elif (
            pd.api.types.is_object_dtype(series)
            or pd.api.types.is_categorical_dtype(series)
            or pd.api.types.is_string_dtype(series)
            or pd.api.types.is_bool_dtype(series)
        ):
            is_datetime = False
            if pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series):
                try:
                    dt_series = pd.to_datetime(series, errors='coerce', format='mixed')
                    if dt_series.notna().sum() > len(series) * 0.5:
                        dtype = "datetime"
                        series = dt_series
                        is_datetime = True
                except Exception:
                    pass

            if not is_datetime:
                if unique_count <= 20 or pd.api.types.is_bool_dtype(series):
                    dtype = "categorical"
                else:
                    dtype = "text"
        else:
            dtype = "text"

    if dtype == "numeric":
        if not pd.api.types.is_numeric_dtype(series):
            series = pd.to_numeric(series, errors='coerce')
        valid_numeric = series.dropna()
        unique_count = int(valid_numeric.nunique())
    elif dtype == "datetime":
        if not pd.api.types.is_datetime64_any_dtype(series):
            try:
                series = pd.to_datetime(series, errors='coerce', format='mixed')
            except Exception:
                pass

    col_summary = {
        "letter": _get_column_letter(df, col, col_idx),
        "dtype": dtype,
        "missing_pct": missing_pct,
        "unique_count": unique_count,
        "skip_chart": False,
        "skip_key": None,
        "skip_reason": None,
    }

    # Reference provenance from cleaning_log
    if cleaning_log:
        prov = [log for log in cleaning_log if log.get("column") in (str(col), "all")]
        if prov:
            col_summary["cleaning_provenance"] = prov

    # Check ignore conditions
    if missing_pct >= HIGH_MISSING_PCT:
        col_summary["low_confidence"] = True
        col_summary["skip_chart"] = True
        col_summary["skip_key"] = "missing_high"
        col_summary["skip_reason"] = f"Tỷ lệ thiếu cao (≥ {HIGH_MISSING_PCT}%)"
    elif unique_count <= 1:
        col_summary["skip_chart"] = True
        col_summary["skip_key"] = "single_value"
        col_summary["skip_reason"] = "Không đủ variance (unique_count ≤ 1)"
    elif dtype == "text":
        col_summary["skip_chart"] = True
        col_summary["skip_key"] = "free_text"
        col_summary["skip_reason"] = "free_text"

    if not col_summary.get("skip_chart"):
        valid_series = series.dropna()

        if dtype == "numeric" and len(valid_series) > 0:
            valid_series = pd.to_numeric(valid_series, errors="coerce").dropna().astype(float)
            respondents = len(valid_series)
            val_min = float(valid_series.min())
            val_max = float(valid_series.max())
            col_summary.update({
                "min": val_min,
                "max": val_max,
                "mean": float(valid_series.mean()),
                "median": float(valid_series.median()),
                "std": float(valid_series.std()) if len(valid_series) > 1 else 0.0,
                "skewness": float(valid_series.skew()) if len(valid_series) > 2 else 0.0,
                "kurtosis": float(valid_series.kurtosis()) if len(valid_series) > 3 else 0.0,
            })
            try:
                q1 = valid_series.quantile(0.25)
                q3 = valid_series.quantile(0.75)
                iqr = q3 - q1
                col_summary.update({
                    "p25": float(q1),
                    "p75": float(q3),
                    "iqr": float(iqr)
                })
                # Outliers
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                outliers = valid_series[(valid_series < lower_bound) | (valid_series > upper_bound)]
                col_summary["outlier_count"] = int(len(outliers))
            except Exception:
                pass

            num_unique = int(valid_series.nunique())
            col_summary["unique_count"] = num_unique
            disc_info = _inspect_discrete(valid_series)
            if disc_info["is_discrete"]:
                is_integer = cleaner_service.is_integer_numeric(valid_series)
                if disc_info["is_scale"]:
                    scale_min = disc_info["scale_min"]
                    scale_max = disc_info["scale_max"]
                    bins = []
                    discrete_vals = disc_info["levels"]
                    int_counts = valid_series.round().astype(int).value_counts().to_dict()
                    for v in discrete_vals:
                        cnt = int_counts.get(v, 0)
                        pct = chart_insights._round_half_up(cnt / respondents * 100, 1) if respondents > 0 else 0.0
                        bins.append({
                            "label": str(v),
                            "value": v,
                            "count": cnt,
                            "pct": pct,
                            "bin_start": float(v),
                            "bin_end": float(v),
                        })

                    col_summary.update({
                        "is_discrete": True,
                        "is_scale": True,
                        "scale_min": scale_min,
                        "scale_max": scale_max,
                        "respondents": respondents,
                        "discrete_values": discrete_vals,
                        "distribution_bins": bins,
                        "skip_chart": False,
                        "skip_key": None,
                    })
                else:
                    val_counts = valid_series.value_counts().sort_index()
                    bins = []
                    discrete_vals = disc_info["levels"]
                    for val, count in val_counts.items():
                        v = int(round(val)) if is_integer else float(val)
                        lbl = str(v) if is_integer else f"{v:g}"
                        pct = chart_insights._round_half_up(float(count / respondents * 100), 1) if respondents > 0 else 0.0
                        bins.append({
                            "label": lbl,
                            "value": v,
                            "count": int(count),
                            "pct": pct,
                            "bin_start": float(val),
                            "bin_end": float(val),
                        })

                    col_summary.update({
                        "is_discrete": True,
                        "is_scale": False,
                        "scale_min": None,
                        "scale_max": None,
                        "respondents": respondents,
                        "discrete_values": discrete_vals,
                        "distribution_bins": bins,
                        "skip_chart": False,
                        "skip_key": None,
                    })
            else:
                col_summary["is_discrete"] = False
                try:
                    q1_f = float(valid_series.quantile(0.25))
                    med_f = float(valid_series.median())
                    q3_f = float(valid_series.quantile(0.75))
                    iqr_f = float(q3_f - q1_f)
                    mean_f = float(valid_series.mean())
                    lower_bound = q1_f - 1.5 * iqr_f
                    upper_bound = q3_f + 1.5 * iqr_f

                    in_whiskers_low = valid_series[valid_series >= lower_bound]
                    whisker_low = float(in_whiskers_low.min()) if not in_whiskers_low.empty else val_min

                    in_whiskers_high = valid_series[valid_series <= upper_bound]
                    whisker_high = float(in_whiskers_high.max()) if not in_whiskers_high.empty else val_max

                    outlier_series = valid_series[(valid_series < whisker_low) | (valid_series > whisker_high)]
                    outliers_total = int(len(outlier_series))
                    outliers_unique_sorted = sorted([float(x) for x in outlier_series.unique()])[:50]

                    col_summary["box"] = {
                        "q1": q1_f,
                        "median": med_f,
                        "q3": q3_f,
                        "iqr": iqr_f,
                        "whisker_low": whisker_low,
                        "whisker_high": whisker_high,
                        "mean": mean_f,
                        "outliers": outliers_unique_sorted,
                        "outliers_total": outliers_total,
                    }
                except Exception:
                    pass

                if num_unique > VIZ_DISCRETE_MAX_UNIQUE:
                    try:
                        counts, bin_edges = np.histogram(valid_series, bins=20)
                        col_summary["distribution_bins"] = [
                            {
                                "bin_start": float(bin_edges[i]),
                                "bin_end": float(bin_edges[i+1]),
                                "count": int(counts[i])
                            }
                            for i in range(len(counts))
                        ]
                    except Exception:
                        pass

        elif dtype == "categorical" and len(valid_series) > 0:
            total = len(valid_series)
            value_counts = valid_series.astype(str).value_counts()
            all_values = [
                {"value": str(val), "count": int(count), "pct": round(count / total * 100, 2)}
                for val, count in value_counts.items()
            ]
            top_10 = all_values[:10]
            if len(value_counts) > 10:
                rest = all_values[10:]
                sum_of_rest = sum(item["count"] for item in rest)
                pct_of_rest = round(sum_of_rest / total * 100, 2)
                hidden_n = len(value_counts) - 10
                top_values = top_10 + [{
                    "value": "__other__",
                    "count": int(sum_of_rest),
                    "pct": pct_of_rest,
                    "other_n": int(hidden_n)
                }]
            else:
                top_values = top_10

            col_summary["mode"] = str(value_counts.index[0]) if len(value_counts) > 0 else ""
            col_summary["top_values"] = top_values
            col_summary["all_values"] = all_values[:200]

        elif dtype == "multiple_choice" and len(valid_series) > 0:
            respondents = len(valid_series)
            token_lists = valid_series.astype(str).apply(
                lambda x: [t.strip() for t in x.split(",") if t.strip()]
            )
            total_tokens = int(token_lists.apply(len).sum())
            avg_choices = round(total_tokens / respondents, 1) if respondents > 0 else 0.0

            all_tokens = [tok for sublist in token_lists for tok in sublist]
            token_series = pd.Series(all_tokens) if all_tokens else pd.Series(dtype=object)
            value_counts = token_series.value_counts()

            all_values = [
                {"value": str(val), "count": int(count), "pct": round(count / respondents * 100, 2)}
                for val, count in value_counts.items()
            ]
            top_10 = all_values[:10]
            if len(value_counts) > 10:
                rest = all_values[10:]
                sum_of_rest = sum(item["count"] for item in rest)
                pct_of_rest = round(sum_of_rest / respondents * 100, 2)
                hidden_n = len(value_counts) - 10
                top_values = top_10 + [{
                    "value": "__other__",
                    "count": int(sum_of_rest),
                    "pct": pct_of_rest,
                    "other_n": int(hidden_n)
                }]
            else:
                top_values = top_10

            col_summary["respondents"] = respondents
            col_summary["avg_choices"] = avg_choices
            col_summary["mode"] = str(value_counts.index[0]) if len(value_counts) > 0 else ""
            col_summary["top_values"] = top_values
            col_summary["all_values"] = all_values[:200]

        elif dtype == "datetime" and len(valid_series) > 0:
            col_summary["min_date"] = valid_series.min().isoformat()
            col_summary["max_date"] = valid_series.max().isoformat()
            time_range = valid_series.max() - valid_series.min()
            col_summary["range_days"] = int(time_range.days)

            # Xác định khoảng chia (freq) dựa trên time_range
            if time_range.total_seconds() <= 48 * 3600:
                freq = "h"
            elif time_range.days <= 60:
                freq = "D"
            elif time_range.days <= 730:
                freq = "M"
            else:
                freq = "Y"

            # Trend data
            try:
                trend = valid_series.dt.to_period(freq).value_counts().sort_index()
                col_summary["trend_data"] = [
                    {"period": str(period), "count": int(count)}
                    for period, count in trend.items()
                ]
            except Exception:
                pass

    if dtype == "categorical":
        col_summary.setdefault("top_values", [])
        col_summary.setdefault("all_values", [])
        col_summary.setdefault("mode", "")
    elif dtype == "multiple_choice":
        col_summary.setdefault("top_values", [])
        col_summary.setdefault("all_values", [])
        col_summary.setdefault("mode", "")
        col_summary.setdefault("respondents", 0)
        col_summary.setdefault("avg_choices", 0.0)

    col_summary["auto_insights"] = chart_insights.generate_insights(col_summary)
    return col_summary


def compute_statistics_df(
    df: pd.DataFrame,
    warnings: list = None,
    overridden_types: dict = None,
    profile_data: dict = None,
    cleaning_log: list = None
) -> dict:
    """
    Tính toán thống kê từ DataFrame đã load sẵn (dùng cho service lẫn unit test).
    """
    if warnings is None:
        warnings = []
    if overridden_types is None:
        overridden_types = {}
    if cleaning_log is None:
        cleaning_log = []

    report_header = cleaner_service.build_report_header(warnings, len(df))

    profile_cols = {}
    if profile_data and isinstance(profile_data, dict):
        profile_cols = {
            c.get("name"): c
            for c in profile_data.get("columns", [])
            if isinstance(c, dict) and "name" in c
        }

    summary = {
        "shape": [len(df), len(df.columns)],
        "computed_at": pd.Timestamp.utcnow().isoformat(),
        "columns": {},
        "skipped_columns": [],
        "correlation_matrix": {},
        "top_correlations": [],
        "report_header": report_header,
    }

    column_letters = getattr(df, "attrs", {}).get("column_letters", {}) if hasattr(df, "attrs") else {}
    numeric_cols = []
    skipped_columns = []
    numeric_candidates = []
    dropped_columns = []

    for col_idx, col in enumerate(df.columns):
        col_stats = _compute_column_stats(
            df=df,
            col=col,
            overridden_types=overridden_types,
            profile_cols=profile_cols,
            cleaning_log=cleaning_log,
            col_idx=col_idx
        )
        letter = column_letters.get(col) or cleaner_service.col_index_to_letter(col_idx)
        col_stats["letter"] = letter
        summary["columns"][col] = col_stats

        if col_stats.get("skip_chart"):
            skipped_columns.append({
                "column": str(col),
                "reason": col_stats.get("skip_key"),
                "missing_pct": float(col_stats.get("missing_pct", 0.0)),
                "letter": letter
            })

        if col_stats.get("dtype") == "numeric":
            is_constant = (
                col_stats.get("skip_key") == "single_value"
                or col_stats.get("unique_count", 0) <= 1
                or (not col_stats.get("skip_chart") and col_stats.get("std", 0.0) <= 0)
            )
            if is_constant:
                dropped_columns.append({"name": str(col), "reason": "no_variance"})
            elif not col_stats.get("skip_chart") and col_stats.get("std", 0.0) > 0:
                numeric_cols.append(col)
                numeric_candidates.append({
                    "name": str(col),
                    "file_idx": col_idx,
                    "letter": letter,
                    "missing_pct": float(col_stats.get("missing_pct", 0.0)),
                    "is_discrete": bool(col_stats.get("is_discrete", False)),
                    "is_scale": bool(col_stats.get("is_scale", False)),
                })

    summary["skipped_columns"] = skipped_columns

    # Column selection for correlation
    # If more than VIZ_CORR_MAX_COLS: keep the ones with lowest missing_pct (tie: file order).
    # Output order = original file order.
    if len(numeric_candidates) > VIZ_CORR_MAX_COLS:
        sorted_candidates = sorted(numeric_candidates, key=lambda c: (c["missing_pct"], c["file_idx"]))
        kept_candidates = sorted_candidates[:VIZ_CORR_MAX_COLS]
        dropped_excess = sorted_candidates[VIZ_CORR_MAX_COLS:]

        kept_candidates.sort(key=lambda c: c["file_idx"])
        dropped_excess.sort(key=lambda c: c["file_idx"])
        for d in dropped_excess:
            dropped_columns.append({"name": d["name"], "reason": "too_many_columns"})
    else:
        kept_candidates = numeric_candidates

    # If fewer than 2 columns: correlation_v2 = null and keep the existing correlation_error behavior
    if len(kept_candidates) < 2:
        summary["correlation_error"] = "Dữ liệu không đủ cột dạng số để vẽ biểu đồ tương quan (cần tối thiểu 2 cột)."
        summary["correlation_v2"] = None
        summary["correlation_matrix"] = {}
        summary["top_correlations"] = []
        return summary

    # Correlation V2
    v2_columns = [
        {
            "name": c["name"],
            "letter": c["letter"],
            "is_discrete": c["is_discrete"],
            "is_scale": c["is_scale"],
            "missing_pct": c["missing_pct"],
        }
        for c in kept_candidates
    ]

    discrete_count = sum(1 for c in kept_candidates if c["is_discrete"])
    default_method = "spearman" if discrete_count >= len(kept_candidates) / 2.0 else "pearson"

    selected_names = [c["name"] for c in kept_candidates]
    corr_num_df = df[selected_names].apply(pd.to_numeric, errors="coerce")

    # Pairwise correlations with min_periods
    corr_pearson = corr_num_df.corr(method="pearson", min_periods=VIZ_CORR_MIN_PAIR_N)
    corr_spearman = corr_num_df.corr(method="spearman", min_periods=VIZ_CORR_MIN_PAIR_N)

    notna_mat = corr_num_df.notna().astype(int)
    n_matrix = notna_mat.T.dot(notna_mat)

    pairs = []
    for i in range(len(selected_names)):
        for j in range(i + 1, len(selected_names)):
            col_a = selected_names[i]
            col_b = selected_names[j]
            pair_n = int(n_matrix.loc[col_a, col_b])

            val_p = corr_pearson.loc[col_a, col_b]
            val_s = corr_spearman.loc[col_a, col_b]

            p_clean = None if (pair_n < VIZ_CORR_MIN_PAIR_N or pd.isna(val_p)) else round(float(val_p), 4)
            s_clean = None if (pair_n < VIZ_CORR_MIN_PAIR_N or pd.isna(val_s)) else round(float(val_s), 4)

            pairs.append({
                "a": col_a,
                "b": col_b,
                "pearson": p_clean,
                "spearman": s_clean,
                "n": pair_n,
            })

    def _pair_sort_key(p):
        p_abs = abs(p["pearson"]) if p["pearson"] is not None else -1.0
        s_abs = abs(p["spearman"]) if p["spearman"] is not None else -1.0
        return max(p_abs, s_abs)

    pairs.sort(key=_pair_sort_key, reverse=True)

    summary["correlation_v2"] = {
        "columns": v2_columns,
        "default_method": default_method,
        "pairs": pairs,
        "dropped_columns": dropped_columns,
    }

    # Existing correlation response fields (correlation_matrix, top_correlations)
    corr_cols = numeric_cols[:20]
    if len(corr_cols) >= 2:
        legacy_corr_df = df[corr_cols].apply(pd.to_numeric, errors="coerce").astype(float).corr()
        corr_matrix = {}
        top_correlations = []
        for i, col_a in enumerate(corr_cols):
            corr_matrix[col_a] = {}
            for j, col_b in enumerate(corr_cols):
                val = legacy_corr_df.loc[col_a, col_b]
                if pd.isna(val):
                    val = 0.0
                val = float(val)
                corr_matrix[col_a][col_b] = val
                if i < j and abs(val) > 0.5:
                    top_correlations.append({"col_a": col_a, "col_b": col_b, "r": round(val, 4)})
        summary["correlation_matrix"] = corr_matrix
        summary["top_correlations"] = sorted(top_correlations, key=lambda x: abs(x["r"]), reverse=True)
    else:
        summary["correlation_matrix"] = {}
        summary["top_correlations"] = []

    return summary


def compute_statistics(user_id: int, session_id: str, warnings: list = None, overridden_types: dict[str, str] = None) -> dict:
    if warnings is None:
        warnings = []
    if overridden_types is None:
        overridden_types = {}

    # ── Load file bytes & parse DataFrame (chỉ chạy khi metadata pass/absent) ──
    # Lazy import để tránh circular dependency (router → service → router)
    from app.routers.files import _read_dataframe

    cached_file = cache.get_file_bytes(user_id, session_id)
    if cached_file is None:
        raise DataMindException(
            code="ERR_SYS_CACHE_EXPIRED",
            severity=ErrorSeverity.CRITICAL,
            user_message="Phiên làm việc đã hết hạn hoặc file không tìm thấy. Vui lòng upload lại.",
            technical_detail={
                "module": "visualize_service",
                "location": "compute_statistics",
                "root_cause": f"cache.get_file_bytes('{session_id}') trả về None — TTL hết hoặc Redis miss"
            },
            suggested_action=None
        )

    file_bytes = io.BytesIO(cached_file["bytes"])
    df = _read_dataframe(file_bytes, cached_file["ext"])

    # Get cleaning provenance and profiler information (SSOT)
    session_meta = cache.get_session_metadata(user_id, session_id) or {}
    file_hash = session_meta.get("file_hash")
    cleaning_log = cache.get_cleaning_log(user_id, file_hash) if file_hash else []
    profile_data = cache.get_profile(user_id, file_hash) if file_hash else None

    return compute_statistics_df(
        df=df,
        warnings=warnings,
        overridden_types=overridden_types,
        profile_data=profile_data,
        cleaning_log=cleaning_log
    )



def get_scatter_data(df: pd.DataFrame, col_x: str, col_y: str, max_points: int = 500) -> dict:
    """
    Trích xuất dữ liệu phân tán cho cặp cột đã chọn (anchor).
    
    - Hỗ trợ bất kỳ cột số nào trong DataFrame.
    - Trả về 'letter_x', 'letter_y'.
    - Nếu cả 2 cột đều là dạng số rời rạc (is_discrete):
        trả về mode: "grid", x_levels, y_levels, grid, n (complete rows).
        Đồng thời giữ points để đảm bảo tương thích ngược với UI hiện tại.
    - Ngược lại: trả về mode: "points", points (tối đa max_points), count, total, n.
    """
    # Validate columns exist
    if col_x not in df.columns:
        raise DataMindException(
            code="ERR_VIZ_SCATTER_INVALID_COL",
            severity=ErrorSeverity.BLOCKING,
            user_message=f"Cột '{col_x}' không tồn tại trong dữ liệu.",
            technical_detail={
                "module": "visualize_service",
                "location": "get_scatter_data",
                "root_cause": f"col_x='{col_x}' không có trong df.columns"
            },
            suggested_action=None
        )
    if col_y not in df.columns:
        raise DataMindException(
            code="ERR_VIZ_SCATTER_INVALID_COL",
            severity=ErrorSeverity.BLOCKING,
            user_message=f"Cột '{col_y}' không tồn tại trong dữ liệu.",
            technical_detail={
                "module": "visualize_service",
                "location": "get_scatter_data",
                "root_cause": f"col_y='{col_y}' không có trong df.columns"
            },
            suggested_action=None
        )

    # Validate columns are numeric (hoặc có thể ép kiểu thành numeric)
    s_x_raw = df[col_x]
    s_y_raw = df[col_y]
    if not pd.api.types.is_numeric_dtype(s_x_raw):
        s_x_num = pd.to_numeric(s_x_raw, errors="coerce")
        if s_x_num.dropna().empty:
            raise DataMindException(
                code="ERR_VIZ_SCATTER_INVALID_COL",
                severity=ErrorSeverity.BLOCKING,
                user_message=f"Cột '{col_x}' không phải kiểu số.",
                technical_detail={
                    "module": "visualize_service",
                    "location": "get_scatter_data",
                    "root_cause": f"col_x='{col_x}' dtype={df[col_x].dtype}, không thể ép thành số"
                },
                suggested_action=None
            )
        s_x = s_x_num
    else:
        s_x = pd.to_numeric(s_x_raw, errors="coerce")

    if not pd.api.types.is_numeric_dtype(s_y_raw):
        s_y_num = pd.to_numeric(s_y_raw, errors="coerce")
        if s_y_num.dropna().empty:
            raise DataMindException(
                code="ERR_VIZ_SCATTER_INVALID_COL",
                severity=ErrorSeverity.BLOCKING,
                user_message=f"Cột '{col_y}' không phải kiểu số.",
                technical_detail={
                    "module": "visualize_service",
                    "location": "get_scatter_data",
                    "root_cause": f"col_y='{col_y}' dtype={df[col_y].dtype}, không thể ép thành số"
                },
                suggested_action=None
            )
        s_y = s_y_num
    else:
        s_y = pd.to_numeric(s_y_raw, errors="coerce")

    # Drop rows where either column is NaN
    valid_mask = s_x.notna() & s_y.notna()
    valid_df = pd.DataFrame({"x": s_x[valid_mask], "y": s_y[valid_mask]})
    total = len(valid_df)

    letter_x = _get_column_letter(df, col_x)
    letter_y = _get_column_letter(df, col_y)

    if total == 0:
        return {
            "mode": "points",
            "col_x": col_x,
            "col_y": col_y,
            "letter_x": letter_x,
            "letter_y": letter_y,
            "points": [],
            "count": 0,
            "total": 0,
            "n": 0,
        }

    # Downsample via seeded random sampling if necessary
    if total > max_points:
        random.seed(42)
        indices = sorted(random.sample(range(total), max_points))
        sampled = valid_df.iloc[indices]
    else:
        sampled = valid_df

    points = [
        {"x": float(row["x"]), "y": float(row["y"])}
        for _, row in sampled.iterrows()
    ]

    # Kiểm tra nếu cả 2 cột đều là dạng rời rạc (is_discrete)
    info_x = _inspect_discrete(df[col_x])
    info_y = _inspect_discrete(df[col_y])

    if info_x["is_discrete"] and info_y["is_discrete"]:
        x_levels = info_x["levels"]
        y_levels = info_y["levels"]

        s_x_grid = valid_df["x"]
        s_y_grid = valid_df["y"]
        if info_x["is_scale"] or cleaner_service.is_integer_numeric(s_x_grid):
            s_x_grid = s_x_grid.round().astype(int)
        if info_y["is_scale"] or cleaner_service.is_integer_numeric(s_y_grid):
            s_y_grid = s_y_grid.round().astype(int)

        pair_counts = pd.DataFrame({"x": s_x_grid, "y": s_y_grid}).groupby(["x", "y"]).size().to_dict()

        grid = []
        for x in x_levels:
            for y in y_levels:
                grid.append({
                    "x": x,
                    "y": y,
                    "count": int(pair_counts.get((x, y), 0))
                })

        return {
            "mode": "grid",
            "col_x": col_x,
            "col_y": col_y,
            "letter_x": letter_x,
            "letter_y": letter_y,
            "points": points,
            "count": len(points),
            "total": total,
            "x_levels": x_levels,
            "y_levels": y_levels,
            "grid": grid,
            "n": total,
        }

    return {
        "mode": "points",
        "col_x": col_x,
        "col_y": col_y,
        "letter_x": letter_x,
        "letter_y": letter_y,
        "points": points,
        "count": len(points),
        "total": total,
        "n": total,
    }

