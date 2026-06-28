import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { profileFile } from "../services/profilerService";
import { detectIssues, autoClean, confirmClean } from "../services/cleanerService";
import { useToast } from "../contexts/ToastContext";

export default function Pipeline() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const steps = [
    {
      title: "1. Tải lên dữ liệu",
      description: "Hỗ trợ các định dạng phổ biến như CSV, Excel (XLSX, XLS). Dữ liệu của bạn được bảo mật tuyệt đối.",
      icon: "📁"
    },
    {
      title: "2. Phân tích ngữ cảnh (AI)",
      description: "Hệ thống AI tự động đọc cấu trúc, nhận diện kiểu dữ liệu (số liệu, thời gian, danh mục, văn bản) và hiểu ý nghĩa từng cột.",
      icon: "🧠"
    },
    {
      title: "3. Phát hiện lỗi",
      description: "Quét toàn bộ dữ liệu để tìm ra các vấn đề: ô trống, sai định dạng, dữ liệu trùng lặp, lỗi ký tự (encoding).",
      icon: "🔍"
    },
    {
      title: "4. Làm sạch tự động",
      description: "Tự động loại bỏ hoặc điền dữ liệu khuyết theo các quy tắc chuẩn. Cột quá thiếu dữ liệu (>90%) sẽ tự động được xóa.",
      icon: "✨"
    },
    {
      title: "5. Tải file hoàn chỉnh",
      description: "Nhận lại file dữ liệu đã được làm sạch hoàn toàn, sẵn sàng để đưa vào bất kỳ hệ thống phân tích nào khác.",
      icon: "📥"
    }
  ];

  const handleFile = async (file) => {
    if (!file) return;
    const allowed = [".csv", ".xlsx", ".xls"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!allowed.includes(ext)) {
      showToast("Chỉ chấp nhận file .csv, .xlsx, .xls", "error");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);
    try {
      setLoadingStep("Đang phân tích cấu trúc...");
      const profileRes = await profileFile(file);
      const fileHash = profileRes.data.file_hash;
      
      setLoadingStep("Đang phát hiện lỗi...");
      await detectIssues(fileHash, {});
      
      setLoadingStep("Đang làm sạch tự động...");
      await autoClean(fileHash, {});
      
      setLoadingStep("Đang đóng gói kết quả...");
      const confirmRes = await confirmClean(fileHash, "auto", {});
      
      showToast("Xử lý hoàn tất!", "success");
      setResult(confirmRes.data);
      
    } catch (err) {
      const msg = err?.response?.data?.detail || "Có lỗi xảy ra trong quá trình xử lý.";
      setError(msg);
      showToast("Có lỗi xảy ra trong quá trình xử lý.", "error");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans">
      <header className="border-b border-border px-6 py-4 flex justify-between items-center bg-white sticky top-0 z-10">
        <span className="text-lg font-bold text-ink">Quy trình tự động (Full Pipeline)</span>
      </header>

      <div className="px-6 py-12 max-w-4xl mx-auto">
        {!result ? (
          <>
            <div className="text-center mb-12">
              <h1 className="text-3xl font-serif mb-4">Làm sạch dữ liệu chưa bao giờ dễ dàng đến thế</h1>
              <p className="text-muted text-lg max-w-2xl mx-auto">
                Hệ thống tự động thực hiện toàn bộ quy trình từ phân tích, nhận diện lỗi đến làm sạch dữ liệu chỉ với một cú click chuột.
              </p>
            </div>

        {/* Pipeline Visualization */}
        <div className="relative mb-16">
          <div className="absolute left-[28px] top-4 bottom-4 w-0.5 bg-border rounded-full hidden sm:block"></div>
          
          <div className="space-y-6">
            {steps.map((step, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row gap-4 sm:gap-6 relative">
                <div className="w-14 h-14 rounded-full bg-white border-2 border-[#1B4324] shadow-sm flex items-center justify-center text-2xl shrink-0 z-10 mx-auto sm:mx-0">
                  {step.icon}
                </div>
                <div className="bg-white border border-border p-5 rounded-xl shadow-sm flex-1 text-center sm:text-left">
                  <h3 className="font-semibold text-lg mb-1">{step.title}</h3>
                  <p className="text-muted text-sm leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-[#FDEBEC] border border-[#f5c6cb] rounded-xl text-[#9F2F2D] text-center">
            <span className="block font-bold mb-1">⚠️ Quá trình tự động gặp sự cố:</span>
            <span>{error}</span>
            <p className="mt-3 text-sm">
              Gợi ý: Hãy thử sử dụng <strong>Phân tích thủ công</strong> ở menu bên trái để xem chi tiết lỗi của file này và tự cấu hình cách xử lý.
            </p>
          </div>
        )}

        {/* Upload Button */}
        <div className="text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleInputChange}
          />
          <button
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            className={`
              px-8 py-4 rounded-xl font-bold text-lg text-white shadow-md transition-all mt-8
              ${loading ? "bg-forest/70 cursor-not-allowed" : "bg-forest hover:bg-[#15361c] hover:-translate-y-1"}
            `}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                </svg>
                {loadingStep}
              </span>
            ) : "🚀 Bắt đầu quy trình tự động"}
          </button>
          {!loading && <p className="text-xs text-muted mt-3">Hỗ trợ file CSV, XLSX tối đa 10MB</p>}
        </div>
          </>
        ) : (
          <div className="text-center bg-white border border-border p-8 rounded-2xl shadow-sm">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-ink mb-2">Quy trình hoàn tất!</h2>
            <p className="text-muted mb-8">Dữ liệu của bạn đã được làm sạch và sẵn sàng để sử dụng.</p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={result.download_url}
                target="_blank"
                rel="noreferrer"
                className="bg-forest hover:bg-[#1B4324] text-white px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2"
              >
                📥 Tải File Cleaned
              </a>
              <button
                onClick={() => setResult(null)}
                className="border border-border text-ink px-6 py-3 rounded-xl font-semibold hover:bg-sage/20 transition-all"
              >
                Làm sạch file khác
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
