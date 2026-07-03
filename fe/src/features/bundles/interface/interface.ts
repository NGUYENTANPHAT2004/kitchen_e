export interface BundleItemProduct {
  _id: string;
  name: string;
  slug?: string;
  images?: string[];
  basePrice?: number;
}

export interface BundleItem {
  _id: string;
  productId: BundleItemProduct | string;
  variantId?: string;
  quantity?: number;
}

export interface Bundle {
  _id: string;
  name: string;
  slug: string;
  description: string;
  image?: string;
  imagePath?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  isCustomizable?: boolean;
  isActive: boolean;
  isFeatured?: boolean;
  isCurrent?: boolean;
  startDate: string;
  endDate?: string | null;
  minItems?: number;
  maxItems?: number | null;
  tags?: string[];
  items?: BundleItem[];
  totalPrice?: number;
  finalPrice?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BundlePagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  limit: number;
}

export interface BundleListParams {
  page?: number;
  limit?: number;
  sort?: string;
  active?: boolean;
  featured?: boolean;
  search?: string;
}
