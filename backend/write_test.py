import pandas as pd
import io

data = """Tên công ty,Tên sản phẩm,Ngày nhập
cty1,sp1,2023-01-01
cty2,sp2,2023-01-02"""
df = pd.read_csv(io.StringIO(data))

# Simulate the manual action
cleaned = df.copy()
r_id = 1
c_name = "Tên công ty"
n_val = "company2"

output = ""
output += f"Original r_id type: {type(r_id)}\n"
output += f"Index type: {type(cleaned.index)}\n"
output += f"r_id in index: {r_id in cleaned.index}\n"

cleaned.at[r_id, c_name] = n_val

output += f"Cleaned value: {cleaned.at[r_id, c_name]}\n"
output += f"Cleaned DF:\n{cleaned}\n"

with open(r"d:\datamind_prod\backend\test_output.txt", "w", encoding="utf-8") as f:
    f.write(output)
