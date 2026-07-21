import { api, endpoints } from '../../../config/api_cli.config';
import type { ProductFilters, ProductFormData } from '../interface/productCustomization';

export type { Product, ProductFilters, ProductFormData } from '../interface/productCustomization';


export const productService = {
  // Get products with filters and pagination
  async getProducts(filters: ProductFilters = {}) {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    const response = await api.get(`${endpoints.products.base}?${params}`);
    return response.data;
  },

  // Get single product
  async getProduct(id: string) {
    const response = await api.get(endpoints.products.byId(id));
    return response.data;
  },

  // Create product
  async createProduct(data: ProductFormData) {
    const formData = new FormData();
    
    // Add basic fields
    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'images' && key !== 'removeImages') {
        if (value !== undefined && value !== null) {
          if (key === 'tags') {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, String(value));
          }
        }
      }
    });

    // Add images
    if (data.images) {
      data.images.forEach(file => {
        formData.append('images', file);
      });
    }

    const response = await api.post(endpoints.products.base, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // Update product
  async updateProduct(id: string, data: ProductFormData) {
    const formData = new FormData();
    
    // Add basic fields
    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'images' && key !== 'removeImages') {
        if (value !== undefined && value !== null) {
          if (key === 'tags') {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, String(value));
          }
        }
      }
    });

    // Add new images
    if (data.images) {
      data.images.forEach(file => {
        formData.append('images', file);
      });
    }

    // Add removed images
    if (data.removeImages && data.removeImages.length > 0) {
      formData.append('removeImages', JSON.stringify(data.removeImages));
    }

    const response = await api.put(endpoints.products.byId(id), formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // Delete product
  async deleteProduct(id: string) {
    const response = await api.delete(endpoints.products.byId(id));
    return response.data;
  },

  // Restore product
  async restoreProduct(id: string) {
    const response = await api.put(endpoints.products.restore(id));
    return response.data;
  },

  // Search products
  async searchProducts(query: string, limit: number = 10) {
    const response = await api.get(`${endpoints.products.search}?query=${query}&limit=${limit}`);
    return response.data;
  },

  // Get featured products
  async getFeaturedProducts(limit: number = 8) {
    const response = await api.get(`${endpoints.products.featured}?limit=${limit}`);
    return response.data;
  },

  // Get best-selling products (sorted by popularity + rating on the backend)
  async getBestSellingProducts(limit: number = 15) {
    const response = await api.get(`${endpoints.products.bestSelling}?limit=${limit}`);
    const data = response.data?.data ?? response.data;
    return (data?.products ?? []) as Array<{
      _id: string;
      name: string;
      slug?: string;
      images?: string[];
      basePrice?: number;
      averageRating?: number;
      popularity?: number;
    }>;
  }
};

