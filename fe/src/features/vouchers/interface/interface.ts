export interface Voucher {
  _id: string;
  code: string;
name: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderValue: number;
  usageLimit?: number;
  usageCount?: number;
  maxUsage: number;
  currentUsage: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isPrivate: boolean;
  categoryIds: string[];
  productIds: string[];
  isDeleted: boolean;
  isExpired?: boolean;
  isCurrentlyActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VoucherFormData {
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderValue?: number;
  maxUsage?: number;
  startDate: string;
  endDate: string;
  isActive?: boolean;
  isPrivate?: boolean;
  categoryIds?: string[];
  productIds?: string[];
}

export interface VoucherPagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  limit: number;
}

export interface VoucherStats {
  total: number;
  active: number;
  expired: number;
  inactive: number;
}
export type TabType = 'all' | 'valid' | 'expired';