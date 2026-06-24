import axios from "axios";

// 1. Khởi tạo cây cầu
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1",
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true, 
});

// 2. Thêm "Bảo vệ gác cổng" trước khi gửi Request đi
api.interceptors.request.use(
    (config) => {
        // Lục ví (localStorage) xem có thẻ (token) không
        const token = localStorage.getItem("token");
        
        // Nếu có thẻ, kẹp thẻ vào phần Headers của chuyến xe
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;