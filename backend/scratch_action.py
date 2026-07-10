
# ─── apply_manual_actions ───────────────────────────────────────────────────

def apply_manual_actions(df: pd.DataFrame, actions: list) -> pd.DataFrame:
    """
    Áp dụng tuần tự các thao tác làm sạch thủ công (Manual Action Recipe) lên DataFrame.
    """
    cleaned = df.copy()
    
    for action in actions:
        try:
            # action có thể là Pydantic model (từ API) hoặc dict
            act_type = getattr(action, "action_type", None)
            if not act_type and isinstance(action, dict):
                act_type = action.get("action_type")
                
            col = getattr(action, "column", None)
            if not col and isinstance(action, dict):
                col = action.get("column")
                
            params = getattr(action, "params", {})
            if not params and isinstance(action, dict):
                params = action.get("params", {})
                
            if act_type == "DROP_COLUMN":
                if col in cleaned.columns:
                    cleaned = cleaned.drop(columns=[col])
                    
            elif act_type == "DROP_DUPLICATES":
                cleaned = cleaned.drop_duplicates(keep="first")
                
            elif act_type == "STRIP_BAD_CHARS":
                if col in cleaned.columns and pd.api.types.is_object_dtype(cleaned[col].dtype):
                    cleaned[col] = cleaned[col].apply(_strip_bad_chars)
                    
            elif act_type == "CONVERT_TO_NUMERIC":
                if col in cleaned.columns:
                    cleaned[col] = clean_to_numeric(cleaned[col])
                    
            elif act_type == "CONVERT_TO_DATETIME":
                if col in cleaned.columns:
                    cleaned[col] = pd.to_datetime(cleaned[col], errors='coerce')
                    
            elif act_type == "FILL_MISSING_MEDIAN":
                if col in cleaned.columns:
                    fill_val = cleaned[col].median()
                    cleaned[col] = cleaned[col].fillna(fill_val)
                    
            elif act_type == "FILL_MISSING_UNKNOWN":
                if col in cleaned.columns:
                    cleaned[col] = cleaned[col].fillna("Không xác định")
                    
            elif act_type == "FILL_MISSING_CUSTOM_VALUE":
                if col in cleaned.columns:
                    val = params.get("value")
                    cleaned[col] = cleaned[col].fillna(val)
                    
            elif act_type == "FILL_MISSING_MEAN":
                if col in cleaned.columns:
                    fill_val = cleaned[col].mean()
                    cleaned[col] = cleaned[col].fillna(fill_val)
                    
            elif act_type == "FILL_MISSING_MODE":
                if col in cleaned.columns:
                    mode_s = cleaned[col].mode()
                    # Nếu có mode thì lấy phần tử đầu, không thì dùng "Unknown" cho an toàn
                    fill_val = mode_s.iloc[0] if len(mode_s) > 0 else "Unknown"
                    cleaned[col] = cleaned[col].fillna(fill_val)
                    
            elif act_type == "RENAME_COLUMN":
                if col in cleaned.columns:
                    new_name = params.get("new_name")
                    if new_name:
                        cleaned = cleaned.rename(columns={col: str(new_name)})
                        
        except Exception as e:
            logger.warning("Lỗi khi áp dụng manual action %s trên cột %s: %s", act_type, col, e)
            
    return cleaned
