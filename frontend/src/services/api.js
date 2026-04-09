import axios from 'axios';

export const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_URL || `https://${window.location.hostname}:3001`;

export const api = axios.create({
  baseURL: new URL('/api', BACKEND_ORIGIN).toString(),
  headers: {
    'Content-Type': 'application/json'
  }
});

export const getBackendAssetUrl = (assetPath) => {
  if (!assetPath) return '';
  if (/^https?:\/\//i.test(assetPath)) return assetPath;
  return new URL(assetPath, BACKEND_ORIGIN).toString();
};

// Attach token automatically from sessionStorage for every request
api.interceptors.request.use((config) => {
  try {
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // ignore
  }
  return config;
});

// Global response handler: on 401 remove stored user and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      try {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        window.dispatchEvent(new Event('auth-changed'));
      } catch (e) {}
      // navigate to login only if not already on login/register/forgot-password pages
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (!currentPath.includes('/login') && !currentPath.includes('/register') && !currentPath.includes('/forgot-password')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);