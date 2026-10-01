import pandas as pd
import sys
import os

sys.path.insert(0, r"d:\datamind_prod\backend")
from app.services.cleaner_service import apply_manual_actions
from pydantic import BaseModel
import io

class ActionRecipe(BaseModel):
    action_type: str
    column: str
    params: dict = {}

# Mock data
data = """Tên công ty,Tên sản phẩm,Ngày nhập
cty1,sp1,2023-01-01
cty2,sp2,2023-01-02"""
df = pd.read_csv(io.StringIO(data))
print("Original DF:")
print(df)

action = ActionRecipe(
    action_type="BATCH_EDIT_CELLS",
    column="all",
    params={"edits": [{"row_id": 1, "column": "Tên công ty", "new_value": "company2"}]}
)

actions = [action]

cleaned, log = apply_manual_actions(df, actions)
print("\nCleaned DF:")
print(cleaned)

print("\nLog:")
print(log)
