export interface FlashSaleItem {
  _id: string;
  flashSaleId: string;
  productId: { _id: string; name: string; basePrice: number; images?: Array<{ url: string }> };
  productName: string;
  productImage?: string;
  variantId?: string;
  variantName?: string;
  discountPercent: number;
  discountedPrice: number;
  quantity: number;
  maxPerCustomer?: number;
  originalPrice: number;
  sale_itemId: string;
}
export interface FlashSale {
  _id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  status: 'scheduled' | 'active' | 'ended' | 'cancelled';
  bannerImage?: string;
  isActive: boolean;
  priority: number;
  isDeleted: boolean;
  items?: FlashSaleItem[];
  isCurrentlyActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FlashSaleFormData {
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  bannerImage?: string;
  priority?: number;
}

export interface FlashSaleItemFormData {
  productId: string;
  variantId?: string;
  discountPercent: number;
  quantity: number;
  maxPerCustomer?: number;
}

export interface FlashSalePagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  limit: number;
}