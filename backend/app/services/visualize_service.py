import pandas as pd
import numpy as np
from app.services import cleaner_service

def compute_statistics(df: pd.DataFrame, warnings: list = None) -> dict:
    if warnings is None:
        warnings = []
        
    report_header = cleaner_service.build_report_header(warnings, len(df))
    
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
        elif pd.api.types.is_object_dtype(series) or pd.api.types.is_categorical_dtype(series) or pd.api.types.is_bool_dtype(series):
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

            elif dtype == "datetime" and len(valid_series) > 0:
                col_summary["min_date"] = valid_series.min().isoformat()
                col_summary["max_date"] = valid_series.max().isoformat()
                col_summary["range_days"] = int((valid_series.max() - valid_series.min()).days)
                
                # Trend data (aggregate by month)
                try:
                    trend = valid_series.dt.to_period("M").value_counts().sort_index()
                    col_summary["trend_data"] = [
                        {"period": str(period), "count": int(count)}
                        for period, count in trend.items()
                    ]
                except Exception:
                    pass

        summary["columns"][col] = col_summary

    # Correlation
    if len(numeric_cols) >= 2:
        # Limit to top 20 numeric cols
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
