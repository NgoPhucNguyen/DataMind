import api from "./axiosClient";

/**
 * Upload file CSV/Excel để profile.
 * Dùng FormData vì multipart/form-data (không phải JSON).
 * Axios tự set Content-Type boundary khi nhận FormData.
 *
 * @param {File} file - File object từ input hoặc drag-drop
 * @returns {Promise} ProfileResponse từ backend
 */
export const profileFile = (file) => {
  const formData = new FormData();
  formData.append("file", file);

  return api.post("/files/profile", formData, {
    headers: {
      // Override Content-Type để Axios tự set multipart boundary
      "Content-Type": "multipart/form-data",
    },
  });
};
