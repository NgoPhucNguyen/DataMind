import api from "./axiosClient";

// === Đơn hàng / Thanh toán (SePay) ===
export const createOrder = async () => {
    const response = await api.post("/payments/create-order");
    return response.data;
};

export const getOrderStatus = async (orderRef) => {
    const response = await api.get(`/payments/order-status?order_ref=${orderRef}`);
    return response.data;
};
