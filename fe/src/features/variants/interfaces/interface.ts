export interface ProductVariant {
  _id: string;
  productId: string;
  name: string;
  sku: string;
  color?: string;
  size?: string;
  material?: string;
  images: Array<{
    url: string;
    path: string;
    altText: string;
  }>;
  stockQuantity: number;
  priceAdjustment: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type Variant = ProductVariant;
export interface VariantFormData {
  name: string;
  sku: string;
  color?: string;
  size?: string;
  material?: string;
  stockQuantity: number;
  priceAdjustment: number;
  isActive: boolean;
  images?: File[];
  removeImages?: string[];
}