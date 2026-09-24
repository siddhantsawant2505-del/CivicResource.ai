import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Create Centralized Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Token if stored
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('CivicResource_token') || localStorage.getItem('CivicFlow_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle 401s (Token expiration) globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('CivicResource_token');
      localStorage.removeItem('CivicFlow_token');
      // Only redirect if we're not on the login/signup screens
      if (!window.location.pathname.match(/\/(login|signup)$/)) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
