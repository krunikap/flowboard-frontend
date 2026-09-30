import axios, { AxiosError } from "axios";

/** Shared API client. Keep credentials and tokens out of logs. */
export const api = axios.create({
  headers: { Accept: "application/json", "Content-Type": "application/json" },
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  config.headers.set("Accept", "application/json");
  if (config.data !== undefined) {
    config.headers.set("Content-Type", "application/json");
  }
  const token = process.env.API_BEARER_TOKEN;
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const responseData = error.response?.data;
      let message: unknown;
      if (typeof responseData === "string") {
        const trimmed = responseData.trim();
        // Avoid surfacing a full proxy/Next.js HTML error document as the API message.
        if (!/^<!doctype\s+html|^<html[\s>]/i.test(trimmed)) message = trimmed;
      }
      else if (responseData && typeof responseData === "object") {
        const body = responseData as Record<string, unknown>;
        message = body.message ?? body.error;
      }
      if (typeof message === "string" && message.trim()) {
        return Promise.reject(new Error(message));
      }
      if (error.response) {
        const statusText = error.response.statusText ? ` ${error.response.statusText}` : "";
        return Promise.reject(new Error(`API request failed (${error.response.status}${statusText}).`));
      }
      if (error.code === "ECONNABORTED") {
        return Promise.reject(new Error("The API request timed out."));
      }
      if (error instanceof AxiosError && !error.response) {
        return Promise.reject(new Error("Could not reach the API server."));
      }
    }
    return Promise.reject(error);
  },
);
