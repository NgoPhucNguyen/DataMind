import pandas as pd

df = pd.DataFrame({'A': [1, 2, 3], 'B': ['x', 'y', 'z']})
r_id = None
c_name = 'B'
n_val = 'new_val'

print("Before:")
print(df)

if r_id in df.index:
    df.at[r_id, c_name] = n_val
else:
    print("None not in index")
    # let's try what happens if we force it
    try:
        df.at[r_id, c_name] = n_val
    except Exception as e:
        print(f"Error: {e}")

print("After:")
print(df)
