export interface CustomizationOption {
    _id?: string;
    name: string;
    value: string;
    priceAdjustment: number;
    image?: string;
    imagePath?: string;
    isDefault: boolean;
  }
  
  export interface Customization {
    _id: string;
    productId: string;
    name: string;
    customizationType: 'color' | 'engraving' | 'size' | 'material' | 'packaging' | 'other';
    description?: string;
    options: CustomizationOption[];
    isRequired: boolean;
    displayOrder: number;
    isActive: boolean;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
  }
  
  export interface CustomizationFormData {
    name: string;
    customizationType: string;
    description?: string;
    options: Array<{
      name: string;
      value: string;
      priceAdjustment: number;
      isDefault: boolean;
      image?: File;
    }>;
    isRequired: boolean;
    displayOrder: number;
    isActive: boolean;
    removeOptionImages?: string[];
  }
