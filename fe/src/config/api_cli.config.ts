import axios from 'axios';
import { toast } from 'react-hot-toast';
import type { AxiosInstance, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const API_VERSION = import.meta.env.VITE_API_VERSION || 'v1';
const STORAGE_TYPE = import.meta.env.VITE_STORAGE_TYPE || 'local';
const AWS_BUCKET = import.meta.env.VITE_AWS_BUCKET || '';
const AWS_REGION = import.meta.env.VITE_AWS_REGION || '';

const API_ENDPOINT = `${API_BASE_URL}/api`;

export const api: AxiosInstance = axios.create({
  baseURL: API_ENDPOINT,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (import.meta.env.DEV) {
      console.log('API Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        params: config.params,
      });
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => {
    if (import.meta.env.DEV) {
      console.log('API Response:', { status: response.status, url: response.config.url });
    }
    return response;
  },
  (error: AxiosError) => {
    const status = error.response?.status ?? null;

    if (status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      setTimeout(() => {
        window.location.href = '/auth';
      }, 1000);
    } else if (status === 500) {
      toast.error('Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.');
    } else if (!status) {
      toast.error('Lỗi mạng. Vui lòng kiểm tra kết nối internet.');
    }

    return Promise.reject(error);
  }
);

export const urlUtils = {
  getFullImageUrl(imagePath: string | null | undefined): string | null {
    if (!imagePath) return null;

    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }

    const cleanPath = imagePath.replace(/^\/+/, '');

    if (STORAGE_TYPE === 's3') {
      if (!AWS_BUCKET || !AWS_REGION) return null;
      return `https://${AWS_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${cleanPath}`;
    }

    const pathWithPrefix = cleanPath.startsWith('uploads/')
      ? cleanPath
      : `uploads/${cleanPath}`;
    return `${API_BASE_URL}/${pathWithPrefix}`;
  },

  getFallbackImageUrl(): string {
    return `${API_BASE_URL}/uploads/fallback/no-image.png`;
  },

  preloadImage(imageUrl: string): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = imageUrl;
    });
  },
};

export const uploadUtils = {
  validateFile(
    file: File,
    options: { maxSize?: number; allowedTypes?: string[] } = {}
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const maxSize = options.maxSize ?? 10 * 1024 * 1024;
    const allowedTypes = options.allowedTypes ?? [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
    ];

    if (file.size > maxSize) {
      errors.push(`Kích thước tệp quá lớn. Tối đa: ${maxSize / (1024 * 1024)}MB`);
    }
    if (!allowedTypes.includes(file.type)) {
      errors.push(`Loại tệp không hợp lệ. Chấp nhận: ${allowedTypes.join(', ')}`);
    }

    return { isValid: errors.length === 0, errors };
  },

  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  },

  createFormData(
    data: Record<string, unknown>,
    files?: File | File[],
    fileFieldName = 'images'
  ): FormData {
    const formData = new FormData();

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, typeof value === 'boolean' ? value.toString() : String(value));
      }
    });

    if (files) {
      const fileList = Array.isArray(files) ? files : [files];
      fileList.forEach((file) => formData.append(fileFieldName, file));
    }

    return formData;
  },
};

export const endpoints = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    profile: '/auth/profile',
  },

  categories: {
    base: '/categories',
    featured: '/categories/featured',
    byId: (id: string) => `/categories/${id}`,
    products: (id: string) => `/categories/${id}/products`,
    restore: (id: string) => `/categories/${id}/restore`,
    reorder: '/categories/reorder',
  },

  products: {
    base: '/products',
    featured: '/products/featured',
    bestSelling: '/products/best-selling',
    search: '/products/search',
    byId: (id: string) => `/products/${id}`,
    restore: (id: string) => `/products/${id}/restore`,
    variants: (productId: string) => `/products/${productId}/variants`,
    variantById: (productId: string, variantId: string) =>
      `/products/${productId}/variants/${variantId}`,
    restoreVariant: (productId: string, variantId: string) =>
      `/products/${productId}/variants/${variantId}/restore`,
    reviews: (productId: string) => `/products/${productId}/reviews`,
    reviewById: (productId: string, reviewId: string) =>
      `/products/${productId}/reviews/${reviewId}`,
  },

  users: {
    base: '/users',
    byId: (id: string) => `/users/${id}`,
    profile: '/users/profile',
  },

  bundles: {
    base: '/bundles',
    featured: '/bundles/featured',
    active: '/bundles/active',
    byId: (id: string) => `/bundles/${id}`,
    restore: (id: string) => `/bundles/${id}/restore`,
    items: (bundleId: string) => `/bundles/${bundleId}/items`,
  },

  notifications: {
    base: '/notifications',
    byId: (id: string) => `/notifications/${id}`,
    read: (id: string) => `/notifications/${id}/read`,
    dismiss: (id: string) => `/notifications/${id}/dismiss`,
    bulk: '/notifications/bulk',
  },

  ai: {
    chat: '/ai/chat',
    chatHistory: '/ai/chat/history',
    frequentQueries: '/ai/chat/frequent-queries',
    intentDistribution: '/ai/analytics/intent-distribution',
    feedbackStats: '/ai/analytics/feedback-stats',
    personalized: '/ai/recommendations/personalized',
    similar: (productId: string) => `/ai/recommendations/similar/${productId}`,
    recipes: (productId: string) => `/ai/recipes/${productId}`,
    feedback: (logId: string) => `/ai/feedback/${logId}`,
  },
};

export const config = {
  API_BASE_URL,
  API_ENDPOINT,
  API_VERSION,
  STORAGE_TYPE,
  AWS_BUCKET,
  AWS_REGION,
};

export default api;
