import py_compile
try:
    py_compile.compile(r"d:\datamind_prod\backend\app\routers\files.py", doraise=True)
    with open(r"d:\datamind_prod\backend\syntax_check.txt", "w") as f:
        f.write("OK")
except Exception as e:
    with open(r"d:\datamind_prod\backend\syntax_check.txt", "w") as f:
        f.write(str(e))
