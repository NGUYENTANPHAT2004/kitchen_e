export interface CustomizationOption {
  name: string;
  value: string;
  priceAdjustment: number;
  image?: string | File; // Allow File type for new uploads
  isDefault: boolean;
}

export interface Customization {
  _id: string;
  name: string;
  customizationType: string;
  description: string;
  options: CustomizationOption[];
  isRequired: boolean;
  displayOrder: number;
  isActive: boolean;
}
export interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: {
    _id: string;
    name: string;
    slug: string;
  };
  basePrice: number;
  images: Array<{
    url: string;
    path: string;
    altText: string;
    isDefault: boolean;
  }>;
  sku: string;
  stockQuantity: number;
  isCustomizable: boolean;
  featured: boolean;
  tags: string[];
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  averageRating?: number;
  popularity?: number;
  variants?: Array<{
    _id: string;
    name: string;
    price: number;
    stockQuantity: number;
  }>;
}

export interface ProductFilters {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  featured?: boolean;
  sort?: string;
}

export interface ProductFormData {
  name: string;
  description: string;
  categoryId: string;
  basePrice: number;
  sku: string;
  stockQuantity: number;
  isCustomizable: boolean;
  featured: boolean;
  tags: string[];
  weight?: number;
  dimensions?: string;
  images?: File[];
  removeImages?: string[];
}