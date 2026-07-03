import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { customizationService } from '../service/customizationService';
import type { CustomizationFormData } from '../interface/interface';
export const useProductCustomizations = (productId: string) => {
  return useQuery({
    queryKey: ['product-customizations', productId],
    queryFn: () => customizationService.getProductCustomizations(productId),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000
  });
};

export const useProductCustomization = (productId: string, customizationId: string) => {
  return useQuery({
    queryKey: ['product-customization', productId, customizationId],
    queryFn: () => customizationService.getProductCustomization(productId, customizationId),
    enabled: !!productId && !!customizationId,
    staleTime: 5 * 60 * 1000
  });
};

export const useCreateCustomization = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ productId, data }: { productId: string; data: CustomizationFormData }) =>
      customizationService.createProductCustomization(productId, data),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['product-customizations', productId] });
      message.success('Customization created successfully');
    },
    onError: (error: any) => {
      message.error(error.message || 'Failed to create customization');
    }
  });
};

export const useUpdateCustomization = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ productId, customizationId, data }: { 
      productId: string; 
      customizationId: string; 
      data: CustomizationFormData 
    }) => customizationService.updateProductCustomization(productId, customizationId, data),
    onSuccess: (_, { productId, customizationId }) => {
      queryClient.invalidateQueries({ queryKey: ['product-customizations', productId] });
      queryClient.invalidateQueries({ queryKey: ['product-customization', productId, customizationId] });
      message.success('Customization updated successfully');
    },
    onError: (error: any) => {
      message.error(error.message || 'Failed to update customization');
    }
  });
};

export const useDeleteCustomization = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ productId, customizationId }: { productId: string; customizationId: string }) =>
      customizationService.deleteProductCustomization(productId, customizationId),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['product-customizations', productId] });
      message.success('Customization deleted successfully');
    },
    onError: (error: any) => {
      message.error(error.message || 'Failed to delete customization');
    }
  });
};