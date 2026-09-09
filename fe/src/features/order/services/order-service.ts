import { api } from "../../../config/api_cli.config";
import type {
  AdminOrderParams,
  Order,
  OrderPayload,
  OrdersResponse,
  VoucherResult,
} from "../interface/interface";

export const normalizeOrder = (raw: any): Order => ({
  ...raw,
  items: raw.orderItems ?? raw.items ?? [],
  item: raw.orderItems ?? raw.items ?? [],
  paymentStatus:
    raw.status === "refunded" ? "refunded" : raw.isPaid ? "paid" : "unpaid",
});

const orderService = {
  async getMyOrders(limit = 50): Promise<Order[]> {
    const res = await api.get("/orders", { params: { limit } });
    const d = res.data.data ?? res.data;
    return (d.orders ?? []).map(normalizeOrder);
  },

  async getOrders(params: AdminOrderParams): Promise<OrdersResponse> {
    const res = await api.get("/orders", {
      params: { ...params, scope: "admin" },
    });
    const d = res.data.data ?? res.data;
    return {
      orders: (d.orders ?? []).map(normalizeOrder),
      pagination: d.pagination ?? {
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        limit: 10,
      },
    };
  },

  async getOrder(id: string): Promise<Order> {
    const res = await api.get(`/orders/${id}`);
    return normalizeOrder(res.data.data.order);
  },

  async createOrder(
    payload: OrderPayload,
    idempotencyKey: string = crypto.randomUUID()
  ): Promise<{ _id: string; orderNumber: string }> {
    const res = await api.post("/orders", payload, {
      headers: { "Idempotency-Key": idempotencyKey },
    });
    const d = res.data.data ?? res.data;
    return d.order ?? d;
  },

  async cancelOrder(orderId: string): Promise<void> {
    await api.put(`/orders/${orderId}/cancel`);
  },

  async updateOrderStatus(
    orderId: string,
    status: Order["status"]
  ): Promise<void> {
    await api.put(`/orders/${orderId}/status`, { status });
  },

  // GET /orders/stats (admin) → { overall, daily, byStatus, topProducts }
  async getOrderStats(
    params: { startDate?: string; endDate?: string } = {}
  ): Promise<{
    overall: {
      totalOrders: number;
      totalSales: number;
      averageOrderValue: number;
    };
    daily: Array<{ _id: string; totalOrders: number; totalSales: number }>;
    byStatus: Array<{ _id: string; count: number; totalAmount: number }>;
  }> {
    const res = await api.get("/orders/stats", { params });
    const d = res.data.data ?? res.data;
    return {
      overall: d.overall ?? {
        totalOrders: 0,
        totalSales: 0,
        averageOrderValue: 0,
      },
      daily: d.daily ?? [],
      byStatus: d.byStatus ?? [],
    };
  },

  async applyVoucher(code: string): Promise<VoucherResult> {
    const res = await api.post("/vouchers/apply", { code });
    const d = res.data.data ?? res.data;
    const voucher = d.voucher ?? {};
    return {
      voucherId: voucher._id,
      discountAmount: voucher.discountAmount ?? 0,
      voucherCode: voucher.code ?? code,
    };
  },
};

export default orderService;
