import { api } from '../../../config/api_cli.config';

import type { FlashSale, FlashSaleFormData, FlashSaleItemFormData, FlashSalePagination } from '../interface/interface';

const flashSaleService = {
  async getFlashSales(params: { page?: number; limit?: number; status?: string; search?: string } = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    const response = await api.get(`/flash-sales?${query.toString()}`);
    return response.data.data as { flashSales: FlashSale[]; pagination: FlashSalePagination };
  },

  async getFlashSale(id: string) {
    const response = await api.get(`/flash-sales/${id}`);
    return response.data.data as { flashSale: FlashSale };
  },

  async createFlashSale(data: FlashSaleFormData) {
    const response = await api.post('/flash-sales', data);
    return response.data.data as { flashSale: FlashSale };
  },

  async updateFlashSale(id: string, data: Partial<FlashSaleFormData>) {
    const response = await api.put(`/flash-sales/${id}`, data);
    return response.data.data as { flashSale: FlashSale };
  },

  async deleteFlashSale(id: string) {
    const response = await api.delete(`/flash-sales/${id}`);
    return response.data;
  },

  async updateStatus(id: string, status: FlashSale['status']) {
    const response = await api.put(`/flash-sales/${id}/status`, { status });
    return response.data.data as { flashSale: FlashSale };
  },

  async addItem(flashSaleId: string, item: FlashSaleItemFormData) {
    const response = await api.post(`/flash-sales/${flashSaleId}/items`, item);
    return response.data.data;
  },

  async removeItem(itemId: string) {
    const response = await api.delete(`/flash-sales/items/${itemId}`);
    return response.data;
  },

  async updateItem(itemId: string, data: Partial<FlashSaleItemFormData>) {
    const response = await api.put(`/flash-sales/items/${itemId}`, data);
    return response.data.data;
  },
};

export default flashSaleService;
