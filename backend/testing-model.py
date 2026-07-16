import os
from dotenv import load_dotenv
from google import genai

load_dotenv() 

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

print("🔍 Đang liệt kê tất cả các model khả dụng...")

# Duyệt danh sách và in ra tên (name) để bạn biết chính xác cần dùng gì
try:
    models = client.models.list()
    for m in models:
        # In tên model ra để bạn biết chính xác cái nào đang khả dụng
        print(f"✅ Model Name: {m.name} | Description: {m.description}")
except Exception as e:
    print(f"❌ Lỗi: {e}")