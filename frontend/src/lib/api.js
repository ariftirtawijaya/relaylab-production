import axios from "axios";

const normalizeBasePath = (value) => (value || "").replace(/\/+$/, "");
const BACKEND_URL = normalizeBasePath(
  process.env.REACT_APP_BACKEND_URL || process.env.PUBLIC_URL || "",
);
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});
