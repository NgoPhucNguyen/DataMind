"""
rules.py
--------
Single Source of Truth (SSOT) cho toàn bộ hằng số, ngưỡng (thresholds) phân tích dữ liệu,
quy tắc làm sạch, thời gian lưu cache (TTL) và định mức sử dụng của hệ thống DataMind.

Tài liệu tham chiếu các hằng số này:
  - frontend/src/docs/vi/profiler/overview.md
  - frontend/src/docs/vi/profiler/data-types.md
  - frontend/src/docs/vi/profiler/column-stats.md
  - frontend/src/docs/vi/profiler/attention.md
  - frontend/src/docs/vi/profiler/override.md
  - frontend/src/docs/vi/profiler/ai-context.md
  - frontend/src/docs/vi/profiler/session.md
  - docs/guide/profiler.md
"""

from typing import Any
from app.core.config import AI_FREE_DAILY_LIMIT, AI_PRO_DAILY_LIMIT

# ==============================================================================
# 1. PROFILER RULES & THRESHOLDS
# ==============================================================================

# Ngưỡng phân loại Categorical: tối đa số giá trị duy nhất
CATEGORICAL_UNIQUE_THRESHOLD = 15
CATEGORICAL_UNIQUE_THRESHOLD_DESC = "Số lượng giá trị duy nhất tối đa để xếp vào nhóm danh mục"

# Ngưỡng phân loại Datetime dạng chuỗi
DATETIME_PARSE_THRESHOLD = 0.8
DATETIME_PARSE_THRESHOLD_DESC = "Tỷ lệ parse thành công tối thiểu để một cột chuỗi được coi là ngày tháng (80%)"

DATETIME_SAMPLE_LIMIT = 100
DATETIME_SAMPLE_LIMIT_DESC = "Số lượng dòng tối đa dùng để test parse datetime trong hàm _try_datetime"

# Ngưỡng Multiple Choice
COMMA_ROW_RATIO_THRESHOLD = 0.2
COMMA_ROW_RATIO_THRESHOLD_DESC = "Tỷ lệ số dòng có dấu phẩy tối thiểu để kiểm tra dạng Nhiều lựa chọn (20%)"

MULTIPLE_CHOICE_TOKEN_MAX = 25
MULTIPLE_CHOICE_TOKEN_MAX_DESC = "Tổng số lượng tag duy nhất tối đa sau khi bóc tách dấu phẩy"

# Ngưỡng Văn bản tự do (Text)
TEXT_AVG_LENGTH_THRESHOLD = 30.0
TEXT_AVG_LENGTH_THRESHOLD_DESC = "Độ dài ký tự trung bình tối thiểu để coi một cột chuỗi là văn bản tự do (> 30 ký tự)"

# Ngưỡng Số bị ẩn / ngụy trang (Disguised Numeric)
DISGUISED_NUMERIC_THRESHOLD = 0.6
DISGUISED_NUMERIC_THRESHOLD_DESC = "Tỷ lệ chuyển đổi thành công tối thiểu để phát hiện số bị ngụy trang dạng chữ (60%)"

# Ngưỡng Số có phân cách hàng nghìn (Thousands separator vs Multiple Choice)
THOUSANDS_NUMERIC_THRESHOLD = 0.6
THOUSANDS_NUMERIC_THRESHOLD_DESC = "Tỷ lệ khớp số phân cách hàng nghìn để bỏ qua kiểm tra Multiple Choice (60%)"

# Cảnh báo ô trống & Ngưỡng thiếu dữ liệu cao
HIGH_MISSING_PCT = 60
HIGH_MISSING_PCT_DESC = "Ngưỡng tỷ lệ ô trống tối thiểu để xác định cột thiếu dữ liệu nghiêm trọng (>= 60%)"
NULL_WARNING_PCT_THRESHOLD = HIGH_MISSING_PCT
NULL_WARNING_PCT_THRESHOLD_DESC = HIGH_MISSING_PCT_DESC

# Ngưỡng biểu đồ số rời rạc và thang đo Visualize
VIZ_DISCRETE_MAX_UNIQUE = 10      # numeric with <= this many unique values -> discrete
VIZ_DISCRETE_MAX_UNIQUE_DESC = "Số lượng giá trị duy nhất tối đa để coi cột số là rời rạc (<= 10)"

VIZ_DISCRETE_MAX_RANGE = 10       # integer columns with (max - min) <= this get gap-filled levels
VIZ_DISCRETE_MAX_RANGE_DESC = "Khoảng giá trị tối đa (max - min) để điền khoảng trống các bậc số nguyên (<= 10)"

VIZ_SCALE_MAX_VALUES = (5, 7, 10) # max value that looks like a rating scale
VIZ_SCALE_MAX_VALUES_DESC = "Các giá trị cực đại điển hình của thang đo đánh giá (5, 7, 10 điểm)"

# Số lượng mẫu hiển thị
SAMPLE_VALUE_LIMIT = 5
SAMPLE_VALUE_LIMIT_DESC = "Số lượng giá trị mẫu đại diện tối đa trả về cho mỗi cột"

# Kích thước file tối đa
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
MAX_FILE_SIZE_BYTES_DESC = "Giới hạn dung lượng tệp tin tải lên tối đa (10MB)"


# ==============================================================================
# 2. CLEANER RULES & THRESHOLDS
# ==============================================================================

CLEANER_DROP_COLUMN_NULL_PCT = 90.0
CLEANER_DROP_COLUMN_NULL_PCT_DESC = "Tỷ lệ ô trống tối thiểu để tự động xóa cột trong Auto-Clean (>= 90%)"

CLEANER_FILL_NUMERIC = "median"
CLEANER_FILL_NUMERIC_DESC = "Quy tắc điền khuyết cho cột số: số trung vị (median)"

CLEANER_FILL_CATEGORICAL = "Không xác định"
CLEANER_FILL_CATEGORICAL_DESC = "Quy tắc điền khuyết cho cột danh mục: 'Không xác định'"

CLEANER_FILL_MULTIPLE_CHOICE = "Không xác định"
CLEANER_FILL_MULTIPLE_CHOICE_DESC = "Quy tắc điền khuyết cho cột nhiều lựa chọn: 'Không xác định'"

CLEANER_FILL_DATETIME = "preserve"
CLEANER_FILL_DATETIME_DESC = "Quy tắc điền khuyết cho cột thời gian: giữ nguyên ô trống (không điền)"

CLEANER_FILL_TEXT = "skip"
CLEANER_FILL_TEXT_DESC = "Quy tắc điền khuyết cho cột văn bản tự do: bỏ qua xử lý chuẩn hóa và điền khuyết"

CLEANER_PREVIEW_ROWS = 150
CLEANER_PREVIEW_ROWS_DESC = "Số lượng dòng mẫu xem trước chuẩn trong module Cleaner (150 dòng)"

CLEANER_NEAR_EMPTY_ROW_THRESHOLD = 0.80
CLEANER_NEAR_EMPTY_ROW_THRESHOLD_DESC = "Tỷ lệ ô trống tối thiểu để xác định một dòng gần như trống (>= 80% số cột)"

CLEANER_DUPLICATE_WARNING_PCT = 20.0
CLEANER_DUPLICATE_WARNING_PCT_DESC = "Ngưỡng tỷ lệ phần trăm dòng trùng lặp và gần trống kích hoạt cảnh báo (> 20%)"


# ==============================================================================
# 3. SESSION & CACHE TTLs
# ==============================================================================

CACHE_DEFAULT_TTL = 86400
CACHE_DEFAULT_TTL_DESC = "Thời gian lưu trữ kết quả phân tích profile, ngữ cảnh AI và báo cáo (24 giờ)"

FILE_BYTES_TTL = 18000
FILE_BYTES_TTL_DESC = "Thời gian lưu trữ file nhị phân (bytes) trong Redis phục vụ làm sạch (5 giờ)"

RULES_VERSION = "2026.11-v1"


# ==============================================================================
# 4. DICTIONARY EXPORT HELPER FOR META API
# ==============================================================================

def get_all_rules_metadata() -> dict[str, Any]:
    """Trả về cấu trúc gom nhóm toàn bộ luật và ngưỡng định lượng của hệ thống."""
    return {
        "version": RULES_VERSION,
        "profiler": {
            "categorical_unique_threshold": {
                "value": CATEGORICAL_UNIQUE_THRESHOLD,
                "unit": "values",
                "description": CATEGORICAL_UNIQUE_THRESHOLD_DESC
            },
            "datetime_parse_threshold": {
                "value": DATETIME_PARSE_THRESHOLD,
                "unit": "ratio",
                "description": DATETIME_PARSE_THRESHOLD_DESC
            },
            "datetime_sample_limit": {
                "value": DATETIME_SAMPLE_LIMIT,
                "unit": "rows",
                "description": DATETIME_SAMPLE_LIMIT_DESC
            },
            "comma_row_ratio_threshold": {
                "value": COMMA_ROW_RATIO_THRESHOLD,
                "unit": "ratio",
                "description": COMMA_ROW_RATIO_THRESHOLD_DESC
            },
            "multiple_choice_token_max": {
                "value": MULTIPLE_CHOICE_TOKEN_MAX,
                "unit": "tokens",
                "description": MULTIPLE_CHOICE_TOKEN_MAX_DESC
            },
            "text_avg_length_threshold": {
                "value": TEXT_AVG_LENGTH_THRESHOLD,
                "unit": "characters",
                "description": TEXT_AVG_LENGTH_THRESHOLD_DESC
            },
            "disguised_numeric_threshold": {
                "value": DISGUISED_NUMERIC_THRESHOLD,
                "unit": "ratio",
                "description": DISGUISED_NUMERIC_THRESHOLD_DESC
            },
            "thousands_numeric_threshold": {
                "value": THOUSANDS_NUMERIC_THRESHOLD,
                "unit": "ratio",
                "description": THOUSANDS_NUMERIC_THRESHOLD_DESC
            },
            "null_warning_pct_threshold": {
                "value": NULL_WARNING_PCT_THRESHOLD,
                "unit": "percent",
                "description": f"Ngưỡng tỷ lệ ô trống để cảnh báo cột thiếu nhiều dữ liệu (>= {HIGH_MISSING_PCT}%)"
            },
            "high_missing_pct": {
                "value": HIGH_MISSING_PCT,
                "unit": "percent",
                "description": "Ngưỡng tỷ lệ ô trống thống nhất cho cảnh báo và bỏ qua biểu đồ"
            },
            "sample_value_limit": {
                "value": SAMPLE_VALUE_LIMIT,
                "unit": "items",
                "description": SAMPLE_VALUE_LIMIT_DESC
            },
            "max_file_size_bytes": {
                "value": MAX_FILE_SIZE_BYTES,
                "unit": "bytes",
                "description": MAX_FILE_SIZE_BYTES_DESC
            }
        },
        "cleaner": {
            "drop_column_null_pct": {
                "value": CLEANER_DROP_COLUMN_NULL_PCT,
                "unit": "percent",
                "description": CLEANER_DROP_COLUMN_NULL_PCT_DESC
            },
            "preview_rows": {
                "value": CLEANER_PREVIEW_ROWS,
                "unit": "rows",
                "description": CLEANER_PREVIEW_ROWS_DESC
            },
            "near_empty_row_threshold": {
                "value": CLEANER_NEAR_EMPTY_ROW_THRESHOLD,
                "unit": "ratio",
                "description": CLEANER_NEAR_EMPTY_ROW_THRESHOLD_DESC
            },
            "duplicate_warning_pct": {
                "value": CLEANER_DUPLICATE_WARNING_PCT,
                "unit": "percent",
                "description": CLEANER_DUPLICATE_WARNING_PCT_DESC
            },
            "fill_rules": {
                "numeric": {"strategy": CLEANER_FILL_NUMERIC, "description": CLEANER_FILL_NUMERIC_DESC},
                "categorical": {"strategy": CLEANER_FILL_CATEGORICAL, "description": CLEANER_FILL_CATEGORICAL_DESC},
                "multiple_choice": {"strategy": CLEANER_FILL_MULTIPLE_CHOICE, "description": CLEANER_FILL_MULTIPLE_CHOICE_DESC},
                "datetime": {"strategy": CLEANER_FILL_DATETIME, "description": CLEANER_FILL_DATETIME_DESC},
                "text": {"strategy": CLEANER_FILL_TEXT, "description": CLEANER_FILL_TEXT_DESC}
            }
        },
        "session": {
            "cache_default_ttl": {
                "value": CACHE_DEFAULT_TTL,
                "unit": "seconds",
                "description": CACHE_DEFAULT_TTL_DESC
            },
            "cache_default_ttl_hours": {
                "value": CACHE_DEFAULT_TTL // 3600,
                "unit": "hours",
                "description": "Thời gian lưu trữ kết quả phân tích theo giờ (24 giờ)"
            },
            "file_bytes_ttl": {
                "value": FILE_BYTES_TTL,
                "unit": "seconds",
                "description": FILE_BYTES_TTL_DESC
            },
            "file_bytes_ttl_hours": {
                "value": FILE_BYTES_TTL // 3600,
                "unit": "hours",
                "description": "Thời gian lưu trữ file nhị phân theo giờ (5 giờ)"
            },
            "file_bytes_ttl_minutes": {
                "value": FILE_BYTES_TTL // 60,
                "unit": "minutes",
                "description": "Thời gian lưu trữ file nhị phân theo phút (300 phút)"
            }
        },
        "ai": {
            "free_daily_limit": {
                "value": AI_FREE_DAILY_LIMIT,
                "unit": "runs/day",
                "description": "Số lượt sử dụng AI dùng chung miễn phí mỗi ngày"
            },
            "pro_daily_limit": {
                "value": AI_PRO_DAILY_LIMIT,
                "unit": "runs/day",
                "description": "Số lượt sử dụng AI cho gói Pro mỗi ngày"
            }
        },
        "visualize": {
            "discrete_max_unique": {
                "value": VIZ_DISCRETE_MAX_UNIQUE,
                "unit": "values",
                "description": "Số giá trị phân biệt tối đa để xem cột số là dạng rời rạc / thang đo"
            },
            "discrete_max_range": {
                "value": VIZ_DISCRETE_MAX_RANGE,
                "unit": "values",
                "description": "Khoảng giá trị tối đa (max - min) để nhận diện cột số rời rạc"
            },
            "scale_max_values": {
                "value": list(VIZ_SCALE_MAX_VALUES),
                "unit": "list",
                "description": "Các mốc tối đa phổ biến của thang đo rating (1-5, 1-7, 1-10)"
            },
            "high_missing_pct": {
                "value": HIGH_MISSING_PCT,
                "unit": "percent",
                "description": "Tỷ lệ ô trống tối đa để hiển thị biểu đồ trực quan hóa"
            }
        }
    }

