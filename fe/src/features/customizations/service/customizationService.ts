import { api, endpoints, uploadUtils } from '../../../config/api_cli.config';
import type { Customization, CustomizationFormData } from '../interface/interface';

export const customizationService = {
  // Get customizations for a product
  async getProductCustomizations(productId: string) {
    try {
      const response = await api.get(`/products/${productId}/customizations`);
      return response.data?.data?.customizations  || [];
    } catch (error: any) {
      console.error('Failed to fetch customizations:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch customizations');
    }
  },

  // Get single customization
  async getProductCustomization(productId: string, customizationId: string) {
    try {
      const response = await api.get(`/products/${productId}/customizations/${customizationId}`);
      return response.data?.data?.customization;
    } catch (error: any) {
      console.error('Failed to fetch customization:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch customization');
    }
  },

  // Create customization
  async createProductCustomization(productId: string, data: CustomizationFormData) {
    try {
      const formData = new FormData();
      
      // Add basic fields
      Object.entries(data).forEach(([key, value]) => {
        if (key !== 'options' && key !== 'removeOptionImages') {
          if (value !== undefined && value !== null) {
            if (typeof value === 'boolean') {
              formData.append(key, value.toString());
            } else {
              formData.append(key, String(value));
            }
          }
        }
      });

      // Process options - separate images from data
      const optionsData = data.options.map(option => ({
        name: option.name,
        value: option.value,
        priceAdjustment: option.priceAdjustment,
        isDefault: option.isDefault
      }));
      
      formData.append('options', JSON.stringify(optionsData));

      // 🔧 FIX: Change field name from 'images' to 'optionImages' to match backend expectation
      const optionIndices: string[] = [];
      data.options.forEach((option, index) => {
        if (option.image) {
          formData.append('optionImages', option.image); // Changed from 'images' to 'optionImages'
          optionIndices.push(index.toString());
        }
      });
      
      if (optionIndices.length > 0) {
        optionIndices.forEach(index => {
          formData.append('optionIndices', index);
        });
      }
      const response = await api.post(`/products/${productId}/customizations`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000
      });
      return response.data;
    } catch (error: any) {
      console.error('Failed to create customization:', error);
      throw new Error(error.response?.data?.message || 'Failed to create customization');
    }
  },

  // Update customization
  async updateProductCustomization(productId: string, customizationId: string, data: CustomizationFormData) {
    try {
      const formData = new FormData();
      
      // Add basic fields
      Object.entries(data).forEach(([key, value]) => {
        if (key !== 'options' && key !== 'removeOptionImages') {
          if (value !== undefined && value !== null) {
            if (typeof value === 'boolean') {
              formData.append(key, value.toString());
            } else {
              formData.append(key, String(value));
            }
          }
        }
      });

      // Process options
      const optionsData = data.options.map(option => ({
        name: option.name,
        value: option.value,
        priceAdjustment: option.priceAdjustment,
        isDefault: option.isDefault
      }));
      
      formData.append('options', JSON.stringify(optionsData));

      // 🔧 FIX: Change field name from 'images' to 'optionImages' to match backend expectation
      const optionIndices: string[] = [];
      data.options.forEach((option, index) => {
        if (option.image) {
          formData.append('optionImages', option.image); // Changed from 'images' to 'optionImages'
          optionIndices.push(index.toString());
        }
      });
      
      if (optionIndices.length > 0) {
        optionIndices.forEach(index => {
          formData.append('optionIndices', index);
        });
      }

      // Add removed images
      if (data.removeOptionImages && data.removeOptionImages.length > 0) {
        formData.append('removeOptionImages', JSON.stringify(data.removeOptionImages));
      }
      const response = await api.put(`/products/${productId}/customizations/${customizationId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000
      });
      return response.data;
    } catch (error: any) {
      console.error('Failed to update customization:', error);
      throw new Error(error.response?.data?.message || 'Failed to update customization');
    }
  },

  // Delete customization
  async deleteProductCustomization(productId: string, customizationId: string) {
    try {
      const response = await api.delete(`/products/${productId}/customizations/${customizationId}`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to delete customization:', error);
      throw new Error(error.response?.data?.message || 'Failed to delete customization');
    }
  }
};