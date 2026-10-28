import axiosClient from "./axiosClient";
import { getCurrentLang } from "../i18n";

export const explainChart = async (data) => {
    const lang = data.lang || getCurrentLang();
    const response = await axiosClient.post("/visualize/explain", { ...data, lang });
    return response.data;
};

export const saveExplanation = async (data) => {
    const lang = data.lang || getCurrentLang();
    const response = await axiosClient.post("/visualize/explain/save", { ...data, lang });
    return response.data;
};

