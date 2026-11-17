// src/services/authService.js
import axiosClient from "./axiosClient"; // Tên mới giúp không bị nhầm lẫn
import { getStoredUtm } from "../utils/utm";

export const register = async (data) => {
    // Tự động nối vào VITE_API_URL thành: /api/v1/auth/register
    const utm = getStoredUtm();
    const response = await axiosClient.post("/auth/register", { ...utm, ...data });
    return response.data;
};

export const login = async (data) => {
    const response = await axiosClient.post("/auth/login", data);
    return response.data;
};

export const loginWithGoogle = async (credential) => {
    const utm = getStoredUtm();
    const response = await axiosClient.post("/auth/google", { credential, ...utm });
    return response.data;
};

export const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
};

export const getUser = () => {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch {
        return null;
    }
};

export const getMySubscription = async () => {
    const response = await axiosClient.get("/auth/me/subscription");
    return response.data;
};