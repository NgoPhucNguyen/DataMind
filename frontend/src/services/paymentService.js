import api from "./axiosClient";

// === Wallet / Credits ===
export const getWallet = async () => {
    const response = await api.get("/credits/wallet");
    return response.data;
};

export const getCreditHistory = async () => {
    const response = await api.get("/credits/history");
    return response.data;
};

// === Packages ===
export const getPackages = async () => {
    const response = await api.get("/packages");
    return response.data;
};

export const purchasePackage = async (packageId) => {
    const response = await api.post(`/packages/purchase?package_id=${packageId}`);
    return response.data;
};

export const getMySubscription = async () => {
    const response = await api.get("/packages/my-subscription");
    return response.data;
};

// === Sepay ===
export const createOrder = async () => {
    const response = await api.post("/payments/create-order");
    return response.data;
};

export const getOrderStatus = async (orderRef) => {
    const response = await api.get(`/payments/order-status?order_ref=${orderRef}`);
    return response.data;
};
