import pandas as pd
import numpy as np
import random
import io
import json
from app.services import cleaner_service
from app.services import chart_insights
from app.core.errors import DataMindException, ErrorSeverity
from app.core import cache

def compute_statistics(user_id: int, session_id: str, warnings: list = None) -> dict:
    if warnings is None:
        warnings = []

    # Lưu ý: Bỏ short-circuit chặn hoàn toàn /compute tại đây, vì Frontend vẫn
    # cần đọc các thông số thống kê của các cột chữ, thời gian (ngay cả khi
    # dataset không có đủ cột số). Thay vào đó, ta sẽ check ở dưới và trả về
    # thuộc tính `correlation_error` thay vì raise 422.

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

    report_header = cleaner_service.build_report_header(warnings, len(df))
    
    # Get cleaning provenance
    session_meta = cache.get_session_metadata(user_id, session_id) or {}
    file_hash = session_meta.get("file_hash")
    cleaning_log = cache.get_cleaning_log(user_id, file_hash) if file_hash else []
    
    summary = {
        "shape": [len(df), len(df.columns)],
        "computed_at": pd.Timestamp.utcnow().isoformat(),
        "columns": {},
        "correlation_matrix": {},
        "top_correlations": [],
        "report_header": report_header,
    }
    
    numeric_cols = []
    categorical_cols = []
    datetime_cols = []

    for col in df.columns:
        series = df[col]
        missing_pct = round(series.isna().mean() * 100, 2)
        unique_count = series.nunique()
        
        # Determine logical type
        if pd.api.types.is_numeric_dtype(series):
            dtype = "numeric"
            numeric_cols.append(col)
        elif pd.api.types.is_datetime64_any_dtype(series):
            dtype = "datetime"
            datetime_cols.append(col)
        elif pd.api.types.is_object_dtype(series) or pd.api.types.is_categorical_dtype(series) or pd.api.types.is_string_dtype(series) or pd.api.types.is_bool_dtype(series):
            # Cố gắng parse lại datetime vì đọc từ CSV có thể mất định dạng
            is_datetime = False
            if pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series):
                try:
                    dt_series = pd.to_datetime(series, errors='coerce', format='mixed')
                    # Nếu trên 50% là datetime hợp lệ
                    if dt_series.notna().sum() > len(series) * 0.5:
                        dtype = "datetime"
                        df[col] = dt_series
                        series = dt_series
                        datetime_cols.append(col)
                        is_datetime = True
                except:
                    pass

            if not is_datetime:
                if unique_count <= 20 or pd.api.types.is_bool_dtype(series):
                    dtype = "categorical"
                    categorical_cols.append(col)
                else:
                    dtype = "text"
        else:
            dtype = "text"
            
        col_summary = {
            "dtype": dtype,
            "missing_pct": missing_pct,
            "unique_count": int(unique_count),
        }
        
        # Reference provenance from cleaning_log
        if cleaning_log:
            prov = [log for log in cleaning_log if log.get("column") in (str(col), "all")]
            if prov:
                col_summary["cleaning_provenance"] = prov

        # Check ignore conditions
        if missing_pct > 60:
            col_summary["low_confidence"] = True
            
        if unique_count <= 1:
            col_summary["skip_chart"] = True
            col_summary["skip_reason"] = "Không đủ variance (unique_count ≤ 1)"
            
        if dtype == "text":
            col_summary["skip_chart"] = True
            col_summary["skip_reason"] = "free_text"
            
        if not col_summary.get("skip_chart"):
            valid_series = series.dropna()
            
            if dtype == "numeric" and len(valid_series) > 0:
                col_summary.update({
                    "min": float(valid_series.min()),
                    "max": float(valid_series.max()),
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
                
                # Distribution bins
                if unique_count > 10:
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
                value_counts = valid_series.value_counts()
                top_10 = value_counts.head(10)
                total = len(valid_series)
                col_summary["mode"] = str(top_10.index[0])
                col_summary["top_values"] = [
                    {"value": str(val), "count": int(count), "pct": round(count/total*100, 2)}
                    for val, count in top_10.items()
                ]

            elif dtype == "multiple_choice" and len(valid_series) > 0:
                all_tokens = valid_series.astype(str).str.split(',').explode().str.strip()
                # Loại bỏ token rỗng
                all_tokens = all_tokens[all_tokens != ""]
                value_counts = all_tokens.value_counts()
                top_15 = value_counts.head(15)
                total_respondents = len(valid_series)
                col_summary["mode"] = str(top_15.index[0]) if len(top_15) > 0 else ""
                col_summary["top_values"] = [
                    {"value": str(val), "count": int(count), "pct": round(count/total_respondents*100, 2)}
                    for val, count in top_15.items()
                ]

            elif dtype == "datetime" and len(valid_series) > 0:
                col_summary["min_date"] = valid_series.min().isoformat()
                col_summary["max_date"] = valid_series.max().isoformat()
                time_range = valid_series.max() - valid_series.min()
                col_summary["range_days"] = int(time_range.days)
                
                # Xác định khoảng chia (freq) dựa trên time_range
                # Nếu < 2 ngày -> theo giờ (H)
                # Nếu < 60 ngày -> theo ngày (D)
                # Nếu < 730 ngày (2 năm) -> theo tháng (M)
                # Lớn hơn -> theo năm (Y)
                if time_range.total_seconds() <= 48 * 3600:
                    freq = "h"  # 'h' for hour in newer pandas, 'H' was deprecated
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

        col_summary["auto_insights"] = chart_insights.generate_insights(col_summary)
        summary["columns"][col] = col_summary

    # Correlation
    if len(numeric_cols) < 2:
        summary["correlation_error"] = "Dữ liệu không đủ cột dạng số để vẽ biểu đồ tương quan (cần tối thiểu 2 cột)."
        return summary

    # Limit to top 20 numeric cols (len(numeric_cols) >= 2 is guaranteed here)
    corr_cols = numeric_cols[:20]
    corr_df = df[corr_cols].corr()
    
    corr_matrix = {}
    top_correlations = []
    for i, col_a in enumerate(corr_cols):
        corr_matrix[col_a] = {}
        for j, col_b in enumerate(corr_cols):
            val = corr_df.loc[col_a, col_b]
            if pd.isna(val):
                val = 0.0
            val = float(val)
            corr_matrix[col_a][col_b] = val
            
            # Add to top correlations if |r| > 0.5 and i < j
            if i < j and abs(val) > 0.5:
                top_correlations.append({"col_a": col_a, "col_b": col_b, "r": round(val, 4)})
                
    summary["correlation_matrix"] = corr_matrix
    summary["top_correlations"] = sorted(top_correlations, key=lambda x: abs(x["r"]), reverse=True)

    return summary


def get_scatter_data(df: pd.DataFrame, col_x: str, col_y: str, max_points: int = 500) -> dict:
    """
    Trích xuất dữ liệu điểm phân tán cho cặp cột đã chọn (anchor).
    
    - Validate cột tồn tại và là numeric
    - Drop NaN ở cả hai cột
    - Downsample bằng seeded random (seed=42) nếu vượt max_points
    - Không tính lại r — frontend đọc từ correlation_matrix có sẵn
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
    
    # Validate columns are numeric
    if not pd.api.types.is_numeric_dtype(df[col_x]):
        raise DataMindException(
            code="ERR_VIZ_SCATTER_INVALID_COL",
            severity=ErrorSeverity.BLOCKING,
            user_message=f"Cột '{col_x}' không phải kiểu số.",
            technical_detail={
                "module": "visualize_service",
                "location": "get_scatter_data",
                "root_cause": f"col_x='{col_x}' dtype={df[col_x].dtype}, expected numeric"
            },
            suggested_action=None
        )
    if not pd.api.types.is_numeric_dtype(df[col_y]):
        raise DataMindException(
            code="ERR_VIZ_SCATTER_INVALID_COL",
            severity=ErrorSeverity.BLOCKING,
            user_message=f"Cột '{col_y}' không phải kiểu số.",
            technical_detail={
                "module": "visualize_service",
                "location": "get_scatter_data",
                "root_cause": f"col_y='{col_y}' dtype={df[col_y].dtype}, expected numeric"
            },
            suggested_action=None
        )
    
    # Drop rows where either column is NaN
    valid_df = df[[col_x, col_y]].dropna()
    total = len(valid_df)
    
    if total == 0:
        return {
            "col_x": col_x,
            "col_y": col_y,
            "points": [],
            "count": 0,
            "total": 0,
        }
    
    # Downsample via seeded random sampling if necessary
    if total > max_points:
        random.seed(42)
        indices = sorted(random.sample(range(total), max_points))
        sampled = valid_df.iloc[indices]
    else:
        sampled = valid_df
    
    points = [
        {"x": float(row[col_x]), "y": float(row[col_y])}
        for _, row in sampled.iterrows()
    ]
    
    return {
        "col_x": col_x,
        "col_y": col_y,
        "points": points,
        "count": len(points),
        "total": total,
    }

