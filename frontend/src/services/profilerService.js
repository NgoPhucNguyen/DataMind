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
 * Gọi Gemini AI để phân tích ngữ cảnh dataset (on-demand).
 * @param {string} fileHash - Hash của file đã profile
 * @returns {Promise} { semantic_context, column_semantics }
 */
export const requestAIContext = (fileHash) => {
  return api.post("/files/ai-context", { file_hash: fileHash });
};
