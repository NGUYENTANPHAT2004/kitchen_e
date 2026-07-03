import { api } from '../../../config/api_cli.config';
import type { Voucher, VoucherFormData, VoucherPagination, VoucherStats } from '../interface/interface';
const voucherService = {
  async getVouchers(params: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
    discountType?: string;
  } = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.isActive !== undefined) query.set('isActive', String(params.isActive));
    if (params.discountType) query.set('discountType', params.discountType);
    const response = await api.get(`/vouchers?${query.toString()}`);
    return response.data.data as { vouchers: Voucher[]; pagination: VoucherPagination; stats: VoucherStats };
  },

  async getVoucher(id: string) {
    const response = await api.get(`/vouchers/${id}`);
    return response.data.data as { voucher: Voucher };
  },

  async createVoucher(data: VoucherFormData) {
    const response = await api.post('/vouchers', data);
    return response.data.data as { voucher: Voucher };
  },

  async updateVoucher(id: string, data: Partial<VoucherFormData>) {
    const response = await api.put(`/vouchers/${id}`, data);
    return response.data.data as { voucher: Voucher };
  },

  async deleteVoucher(id: string) {
    const response = await api.delete(`/vouchers/${id}`);
    return response.data;
  },

  async assignToUser(id: string, userId: string) {
    const response = await api.post(`/vouchers/${id}/assign`, { userId });
    return response.data;
  },

  async assignBulk(id: string, userIds: string[]) {
    const response = await api.post(`/vouchers/${id}/assign-bulk`, { userIds });
    return response.data;
  },
};

export default voucherService;
