// src/services/authService.js
import axiosClient from "./axiosClient"; // Tên mới giúp không bị nhầm lẫn

export const register = async (data) => {
    // Tự động nối vào VITE_API_URL thành: /api/v1/auth/register
    const response = await axiosClient.post("/auth/register", data);
    return response.data;
};

export const login = async (data) => {
    const response = await axiosClient.post("/auth/login", data);
    return response.data;
};