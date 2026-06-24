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

api.interceptors.request.use((config) => {
  try {
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    return config;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      try {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        window.dispatchEvent(new Event('auth-changed'));
      } catch {
        // Continuam redirectul chiar daca sessionStorage nu este disponibil.
      }
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
