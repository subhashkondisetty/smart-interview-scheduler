import axios from 'axios';

export const SESSION_EXPIRED_EVENT = 'auth:session-expired';

// Determine base API URL: strictly environment-driven in production, localhost fallback only in dev
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  if (import.meta.env.PROD) {
    console.error(
      '[API Config] Critical: VITE_API_BASE_URL is not set in production. Localhost fallback is disabled in production builds.'
    );
    return '';
  }
  return 'http://localhost:5000/api';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Bearer token if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Bridge 401 to AuthContext via deduplicated custom event
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Deduplication guard: Only dispatch if token was present in storage
      const token = localStorage.getItem('token');
      if (token) {
        localStorage.removeItem('token');
        const sessionMessage =
          error.response.data?.message || 'Your session has expired. Please log in again.';
        window.dispatchEvent(
          new CustomEvent(SESSION_EXPIRED_EVENT, {
            detail: { message: sessionMessage },
          })
        );
      }
    }
    return Promise.reject(error);
  }
);

export default api;
