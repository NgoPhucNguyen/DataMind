# test_core.py
import os
from dotenv import load_dotenv
load_dotenv()  # Nạp biến môi trường để Redis có thể kết nối!

# Chữa cháy cho việc chạy ngoài Docker (đổi host 'redis' thành 'localhost')
redis_url = os.getenv("REDIS_URL", "")
if "redis://redis:" in redis_url:
    os.environ["REDIS_URL"] = redis_url.replace("redis://redis:", "redis://localhost:")
    print("🔄 Đã tự động đổi REDIS_URL sang localhost để test ở máy host.")
from app.core import cache  # Import module cache của bạn
from app.core.errors import DataMindException
# Chú ý: import đúng đường dẫn visualize_service của bạn
from app.services import visualize_service 

def test_visualize_short_circuit():
    print("\n--- 🪤 TESTING VISUALIZE SHORT-CIRCUIT (BẪY DỮ LIỆU) ---")
    test_session = "trap_session_999"

    # 1. Giăng bẫy: Cố tình tạo metadata giả mạo không có cột số nào
    mock_summary = {
        "total_columns": 5,
        "numeric_columns": [], # Không có cột số!
        "categorical_columns": ["A", "B", "C", "D", "E"]
    }
    # Giả lập luồng /confirm-clean đã lưu metadata
    cache.set_session_metadata(test_session, mock_summary)
    print("✅ Đã đặt bẫy: Session có 0 cột số trên Redis.")

    # ❌ TUYỆT ĐỐI KHÔNG LƯU FILE BYTES CHO SESSION NÀY
    # cache.set_file_bytes(...) -> Bỏ qua dòng này!

    try:
        # 2. Thực thi: Kích hoạt Visualize Service
        # Hàm này trước đây sẽ cố gắng lôi file bytes ra đọc bằng Pandas
        visualize_service.compute_statistics(test_session)
        
        # Nếu code chạy đến đây, nghĩa là nó lọt qua được lưới lọc
        print("❌ THẤT BẠI: Hàm không bị chặn, nó cố gắng chạy tiếp!")
        
    except DataMindException as e:
        if e.code == "ERR_VIZ_HEATMAP_NONUMERIC":
            print("✅ THÀNH CÔNG XUẤT SẮC: Hệ thống đã chặn ngay từ vòng đọc Metadata!")
            print(f"Chi tiết thông báo cho user: '{e.user_message}'")
            print("👉 Server không tốn 1 byte RAM nào để load Pandas.")
        else:
            print(f"❌ Ném lỗi DataMindException nhưng sai mã code: {e.code}")
            
    except Exception as e:
        # Nếu rơi vào đây, nghĩa là nó CỐ TÌNH gọi hàm cache.get_file_bytes để lấy file,
        # nhưng vì ta không lưu file bytes, nó ném lỗi NoneType hoặc FileNotFound.
        print(f"❌ THẤT BẠI NẶNG: Code vẫn cố load data từ Redis và bị sập. Chi tiết: {e}")

if __name__ == "__main__":
    test_visualize_short_circuit()