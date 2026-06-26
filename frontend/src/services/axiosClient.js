import axios from "axios";

// 1. Khởi tạo cây cầu
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1",
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true,
});

// 2. Request interceptor — đính kèm Bearer token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 3. Response interceptor — xử lý 401 tự động logout
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem("token");
            // Chuyển hướng về login, tránh loop nếu đang ở trang login
            if (!window.location.pathname.startsWith("/login")) {
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);

export default api;