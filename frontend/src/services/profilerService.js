import api from "./axiosClient";
import { track } from "../lib/analytics";          // (1) thêm dòng import này

/**
 * Upload file CSV/Excel để profile.
 * ... (giữ nguyên chú thích cũ)
 */
export const profileFile = async (file, forceRefresh = false) => {   // (2) thêm chữ async
  const formData = new FormData();
  formData.append("file", file);

  const res = await api.post(`/files/profile${forceRefresh ? '?force_refresh=true' : ''}`, formData, {   // (3) "return" đổi thành "const res ="
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  // Bắn 1 lần duy nhất cho mỗi tài khoản, dù upload từ trang nào
  if (res.data?.is_first_upload) {
    const dot = file.name.lastIndexOf(".");
    track("first_file_upload", { file_type: dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "unknown" });
  }
  return res;
};

/**
 * Gọi Gemini AI để phân tích ngữ cảnh dataset (on-demand) kèm theo ngôn ngữ và chỉnh sửa.
 * @param {string} fileHash - Hash của file đã profile
 * @param {string} lang - Ngôn ngữ ("vi" hoặc "en")
 * @param {string|null} description - Mô tả bổ sung từ user nếu re-analyze
 * @param {boolean} isReanalyze - True nếu là phân tích lại theo chỉnh sửa
 * @returns {Promise}
 */
export const requestAIContext = (fileHash, lang = "vi", description = null, isReanalyze = false) => {
  return api.post("/files/ai-context", {
    file_hash: fileHash,
    lang,
    description,
    is_reanalyze: isReanalyze,
  });
};

/**
 * Lấy trạng thái Profiler đã persist từ server (không gọi AI).
 */
export const getProfilerState = (fileHash) => {
  return api.get(`/files/profiler-state?file_hash=${encodeURIComponent(fileHash)}`);
};

/**
 * Lưu mô tả và trạng thái sửa đổi của Profiler mà không tốn quota AI.
 */
export const saveProfilerState = (fileHash, description, descriptionSource) => {
  return api.post("/files/profiler-state", {
    file_hash: fileHash,
    description,
    description_source: descriptionSource,
  });
};

/**
 * Lấy hạn mức và thống kê sử dụng AI dùng chung.
 */
export const getAIUsage = () => {
  return api.get("/files/ai-usage");
};
