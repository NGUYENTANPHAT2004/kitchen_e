export type NotificationType =
  | 'order_status'
  | 'payment_status'
  | 'account_update'
  | 'product_restock'
  | 'price_drop'
  | 'review_response'
  | 'flash_sale'
  | 'voucher'
  | 'maintenance_reminder'
  | 'wishlist_price_change'
  | 'wishlist_back_in_stock'
  | 'system';

export type NotificationPriority = 'low' | 'medium' | 'high';

export interface AppNotification {
  _id: string;
  userId?: string;
  type: NotificationType;
  title: string;
  message: string;
  image?: string;
  isRead: boolean;
  isActionRequired?: boolean;
  isDismissed?: boolean;
  action?: { type: 'link' | 'button' | 'none'; text?: string; url?: string };
  priority: NotificationPriority;
  expiresAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface NotificationPagination {
  total: number;
  totalPages: number;
  currentPage: number;
  perPage: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface NotificationListParams {
  page?: number;
  limit?: number;
  isRead?: boolean;
  isDismissed?: boolean;
  type?: NotificationType;
}
