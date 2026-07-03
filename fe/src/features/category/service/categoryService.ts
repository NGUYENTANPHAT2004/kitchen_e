import { api, endpoints } from '../../../config/api_cli.config';

export const categoryService = {
  async getCategories() {
    const params = new URLSearchParams({
      flat: 'false',
      includeProducts: 'true'
    });
    const response = await api.get(`${endpoints.categories.base}?${params}`);
    const data = response.data?.data || response.data;
    const cats = data?.categories || data || [];
    if (!Array.isArray(cats)) throw new Error('Invalid categories response');
    return cats;
  },

  async getCategoriesForProducts() {
    const params = new URLSearchParams({
      flat: 'false',
      includeProducts: 'false',
      activeOnly: 'true'
    });
    const response = await api.get(`${endpoints.categories.base}?${params}`);
    const data = response.data?.data || response.data;
    const categories = data?.categories || data || [];
    if (!Array.isArray(categories)) return [];
    return categories.filter((cat: any) => cat && cat.isActive && !cat.isDeleted);
  },

  async getCategory(id: string) {
    const response = await api.get(endpoints.categories.byId(id));
    return response.data?.data?.category ?? response.data?.data ?? response.data;
  },

  async createCategory(formData: FormData) {
    return api.post(endpoints.categories.base, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000
    });
  },

  async updateCategory(id: string, formData: FormData) {
    return api.put(endpoints.categories.byId(id), formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000
    });
  },

  async deleteCategory(id: string) {
    return api.delete(endpoints.categories.byId(id));
  },

  async restoreCategory(id: string) {
    return api.put(endpoints.categories.restore(id));
  }
};
