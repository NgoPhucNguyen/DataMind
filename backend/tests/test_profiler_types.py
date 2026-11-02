"""
test_profiler_types.py
----------------------
Unit tests for data type detection and edge cases in profiler_service.
Tests requirement list:
 - bool dtype -> categorical; ["true","false","true"] -> categorical
 - ["100,000 VND","250,000 VND","1,200,000 VND"] -> numeric (disguised)
 - ["(2,500)","3,000","4,500"] -> numeric
 - ["Đỏ, Xanh","Vàng","Đỏ, Vàng"] -> multiple_choice
 - ["1, 2","2, 3","1"] -> multiple_choice
 - ["Hà Nội","Đà Nẵng","Hà Nội"] -> categorical
 - 16 unique short strings in 16 rows -> text
"""

import pandas as pd
from app.services.profiler_service import profile_dataframe, is_disguised_numeric

def test_bool_dtype_is_categorical():
    df = pd.DataFrame({"active": [True, False, True, True, False]})
    res = profile_dataframe(df)
    assert len(res) == 1
    assert res[0]["detected_type"] == "categorical"
    assert res[0]["suggested_charts"] == ["pie", "bar"]

def test_string_bool_values_is_categorical():
    df = pd.DataFrame({"answer": ["true", "false", "true", "false", "true"]})
    res = profile_dataframe(df)
    assert len(res) == 1
    assert res[0]["detected_type"] == "categorical"
    assert res[0]["suggested_charts"] == ["pie", "bar"]

def test_vietnamese_bool_strings_is_categorical():
    df = pd.DataFrame({"agree": ["có", "không", "có", "không"]})
    res = profile_dataframe(df)
    assert len(res) == 1
    assert res[0]["detected_type"] == "categorical"
    assert res[0]["suggested_charts"] == ["pie", "bar"]

def test_thousands_separator_currency_is_numeric():
    df = pd.DataFrame({"price": ["100,000 VND", "250,000 VND", "1,200,000 VND"]})
    res = profile_dataframe(df)
    assert len(res) == 1
    assert res[0]["detected_type"] == "numeric"
    assert res[0]["suggested_charts"] == ["bar", "line", "histogram"]
    assert res[0]["disguised_numeric"] is not None
    assert res[0]["disguised_numeric"]["is_disguised"] is True

def test_thousands_separator_negative_is_numeric():
    df = pd.DataFrame({"balance": ["(2,500)", "3,000", "4,500"]})
    res = profile_dataframe(df)
    assert len(res) == 1
    assert res[0]["detected_type"] == "numeric"
    assert res[0]["suggested_charts"] == ["bar", "line", "histogram"]
    assert res[0]["disguised_numeric"] is not None
    assert res[0]["disguised_numeric"]["is_disguised"] is True

def test_multiple_choice_text():
    df = pd.DataFrame({"colors": ["Đỏ, Xanh", "Vàng", "Đỏ, Vàng"]})
    res = profile_dataframe(df)
    assert len(res) == 1
    assert res[0]["detected_type"] == "multiple_choice"
    assert res[0]["suggested_charts"] == ["bar", "pie"]

def test_multiple_choice_numbers_with_space():
    df = pd.DataFrame({"selected_options": ["1, 2", "2, 3", "1"]})
    res = profile_dataframe(df)
    assert len(res) == 1
    assert res[0]["detected_type"] == "multiple_choice"
    assert res[0]["suggested_charts"] == ["bar", "pie"]

def test_repeated_categories_is_categorical():
    df = pd.DataFrame({"city": ["Hà Nội", "Đà Nẵng", "Hà Nội"]})
    res = profile_dataframe(df)
    assert len(res) == 1
    assert res[0]["detected_type"] == "categorical"
    assert res[0]["suggested_charts"] == ["pie", "bar"]

def test_16_unique_short_strings_is_text():
    df = pd.DataFrame({"code": [f"item_{i}" for i in range(16)]})
    res = profile_dataframe(df)
    assert len(res) == 1
    assert res[0]["detected_type"] == "text"
    assert res[0]["suggested_charts"] == []

