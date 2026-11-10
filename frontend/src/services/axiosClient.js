import axios from "axios";
import { handleSessionExpired } from "../utils/sessionManager";

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
        const status = error.response?.status;
        const url = error.config?.url || "";

        // Do NOT intercept 401 from login / register / auth credential endpoints
        // (those are user-input credential errors and must be handled by the form)
        const isAuthCredentialEndpoint =
            url.includes("/auth/login") ||
            url.includes("/auth/register") ||
            url.includes("/auth/google");

        if (status === 401 && !isAuthCredentialEndpoint) {
            // Any authenticated call that fails with 401 triggers central session expiry
            handleSessionExpired();
        }
        return Promise.reject(error);
    }
);

export default api;