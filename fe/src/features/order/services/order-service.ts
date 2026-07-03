import { api } from '../../../config/api_cli.config';
import type { AdminOrderParams, Order, OrderPayload, OrdersResponse, VoucherResult } from '../interface/interface';

const orderService = {
  async getMyOrders(limit = 50): Promise<Order[]> {
    const res = await api.get('/orders', { params: { limit } });
    const d = res.data.data ?? res.data;
    return d.orders ?? d ?? [];
  },

  async getOrders(params: AdminOrderParams): Promise<OrdersResponse> {
    const res = await api.get('/orders', { params });
    const d = res.data.data ?? res.data;
    return {
      orders: d.orders ?? [],
      pagination: d.pagination ?? { currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 },
    };
  },

  async createOrder(payload: OrderPayload): Promise<{ _id: string; orderNumber: string }> {
    const res = await api.post('/orders', payload);
    const d = res.data.data ?? res.data;
    return d.order ?? d;
  },

  async cancelOrder(orderId: string): Promise<void> {
    await api.put(`/orders/${orderId}/cancel`);
  },

  async updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
    await api.put(`/orders/${orderId}/status`, { status });
  },

  // GET /orders/stats (admin) → { overall, daily, byStatus, topProducts }
  async getOrderStats(params: { startDate?: string; endDate?: string } = {}): Promise<{
    overall: { totalOrders: number; totalSales: number; averageOrderValue: number };
    daily: Array<{ _id: string; totalOrders: number; totalSales: number }>;
    byStatus: Array<{ _id: string; count: number; totalAmount: number }>;
  }> {
    const res = await api.get('/orders/stats', { params });
    const d = res.data.data ?? res.data;
    return {
      overall: d.overall ?? { totalOrders: 0, totalSales: 0, averageOrderValue: 0 },
      daily: d.daily ?? [],
      byStatus: d.byStatus ?? [],
    };
  },

  async applyVoucher(code: string, orderAmount: number): Promise<VoucherResult> {
    const res = await api.post('/vouchers/apply', { code, orderAmount });
    const d = res.data.data ?? res.data;
    return { discountAmount: d.discountAmount ?? 0, voucherCode: code };
  },
};

export default orderService;
