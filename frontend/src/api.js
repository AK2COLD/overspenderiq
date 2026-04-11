import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

export const getUsers                = ()         => api.get("/users").then(r => r.data);
export const getUserProfile          = (id)       => api.get(`/users/${id}/profile`).then(r => r.data);
export const getUserRecommendations  = (id)       => api.get(`/users/${id}/recommendations`).then(r => r.data);
export const getFeatureImportances   = ()         => api.get("/model/feature-importances").then(r => r.data);
export const getCohortBenchmarks     = ()         => api.get("/cohorts/benchmarks").then(r => r.data);
