import axiosClient from "./axiosClient";

export const explainChart = async (data) => {
    const response = await axiosClient.post("/visualize/explain", data);
    return response.data;
};

export const saveExplanation = async (data) => {
    const response = await axiosClient.post("/visualize/explain/save", data);
    return response.data;
};

