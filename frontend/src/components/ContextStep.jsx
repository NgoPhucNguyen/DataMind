import { useState } from "react";
import { useFileSession } from "../contexts/FileSessionContext";
import api from "../services/axiosClient";
import { useToast } from "../contexts/ToastContext";

export default function ContextStep({ onComplete }) {
  const { fileSession, updateFileSession } = useFileSession();
  const { showToast } = useToast();
  
  const [description, setDescription] = useState(fileSession.userContext?.description || "");
  const [purpose, setPurpose] = useState(fileSession.userContext?.purpose || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (description || purpose) {
        await api.post("/files/session/context", {
          session_id: fileSession.sessionId || fileSession.fileHash, // Use fileHash if sessionId not generated yet
          description,
          purpose
        });
      }
      
      updateFileSession({ userContext: { description, purpose } });
      onComplete();
    } catch (err) {
      showToast("Không thể lưu thông tin ngữ cảnh. Vui lòng thử lại.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-border p-8 rounded-2xl shadow-sm max-w-2xl mx-auto text-ink">
      <h2 className="text-2xl font-serif mb-6 text-ink">Thông tin Dataset (Tùy chọn)</h2>
      
      <div className="mb-6">
        <label className="block text-sm font-semibold mb-2">Mô tả dataset của bạn</label>
        <textarea
          className="w-full border border-border rounded-lg p-3 text-sm min-h-[100px] outline-none focus:ring-1 focus:ring-forest focus:border-forest transition-all"
          placeholder='Ví dụ: "Khảo sát 500 sinh viên năm 3, đánh giá chất lượng giảng dạy"'
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      <div className="mb-8">
        <label className="block text-sm font-semibold mb-3">Mục đích phân tích</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {["Tìm xu hướng chung", "So sánh các nhóm", "Phát hiện vấn đề", "Báo cáo định kỳ"].map(opt => (
            <label 
              key={opt} 
              className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all ${purpose === opt ? "border-forest bg-sage/20 text-forest font-medium" : "border-border hover:border-forest/50 text-muted"}`}
            >
              <input 
                type="radio" 
                value={opt}
                checked={purpose === opt}
                onChange={() => setPurpose(opt)} 
                className="accent-forest"
              />
              {opt}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button 
          onClick={() => onComplete()}
          className="px-6 py-2.5 rounded-lg font-medium text-muted hover:text-ink hover:bg-sage/20 transition-all border border-transparent hover:border-border"
          disabled={isSubmitting}
        >
          Bỏ qua
        </button>
        <button 
          onClick={handleSubmit}
          className="px-6 py-2.5 rounded-lg font-medium text-white bg-forest hover:bg-[#1B4324] transition-all flex items-center gap-2"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Đang lưu..." : "Xác nhận và tiếp tục"}
        </button>
      </div>
    </div>
  );
}
