export interface OrderItem {
  _id: string;
  productId:
    | { _id?: string; name: string; images?: { url: string }[] }
    | string
    | null;
  variantId?: {
    _id?: string;
    name?: string;
    attributes?: { name: string; value: string }[];
  } | null;
  productSnapshot?: { name?: string; image?: string };
  variantSnapshot?: { name?: string };
  quantity: number;
  price: number;
}

export interface Order {
  _id: string;
  userId: {
    firstName?: string;
    lastName?: string;
    username?: string;
    email: string;
    phoneNumber?: string;
  } | null;
  orderNumber: string;
  createdAt: string;
  status:
    | "pending"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "refunded";
  isPaid?: boolean;
  subtotal?: number;
  shippingCost?: number;
  discount?: number;
  trackingNumber?: string;
  payments?: Array<{ _id: string; status: string; paymentMethod: string }>;
  totalAmount: number;
  items: OrderItem[];
  shippingAddress?: {
    fullName: string;
    address: string;
    city: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phone: string;
  };
  paymentStatus: "paid" | "unpaid" | "refunded";
  item: { quantity: number }[];
  paymentMethod: string;
}
export interface OrdersResponse {
  orders: Order[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    limit: number;
  };
}
export interface ShippingForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  apartment: string;
  city: string;
  province: string;
  zipCode: string;
  country: string;
  saveInfo: boolean;
  shippingMethod: "standard" | "express";
  paymentMethod: "cod" | "bank_transfer";
  discountCode: string;
}

export interface VoucherResult {
  voucherId: string;
  discountAmount: number;
  voucherCode: string;
}
export interface OrderPayload {
  shippingAddress: {
    fullName: string;
    address: string;
    city: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phone: string;
  };
  paymentMethod: string;
  shippingMethod: string;
  voucherId?: string;
}

export interface AdminOrderParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: Order["status"] | "";
  paymentStatus?: Order["paymentStatus"] | "";
  startDate?: string;
  endDate?: string;
  sort?: string;
}
export interface AdminOrderFilters {
  search: string;
  status: Order["status"] | "";
  paymentStatus: Order["paymentStatus"] | "";
  dateRange: { start: string; end: string };
}
