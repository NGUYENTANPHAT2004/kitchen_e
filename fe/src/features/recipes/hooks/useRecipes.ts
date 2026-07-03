import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import recipeService from '../services/recipeService';
import type { RecipeFormData } from '../interface/interface';
export const useRecipes = (params: {
  search?: string;
  difficulty?: string;
  mealType?: string;
  isPublished?: boolean;
  isFeatured?: boolean;
} = {}) => {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const query = useQuery(
    ['recipes', { ...params, page, limit }],
    () => recipeService.getRecipes({ ...params, page, limit }),
    { keepPreviousData: true }
  );

  return { ...query, page, setPage, limit };
};

export const useRecipe = (id: string) =>
  useQuery(['recipes', id], () => recipeService.getRecipe(id), { enabled: !!id });

export const useCreateRecipe = () => {
  const qc = useQueryClient();
  return useMutation((data: RecipeFormData) => recipeService.createRecipe(data), {
    onSuccess: () => qc.invalidateQueries(['recipes']),
  });
};

export const useUpdateRecipe = () => {
  const qc = useQueryClient();
  return useMutation(
    ({ id, data }: { id: string; data: Partial<RecipeFormData> }) =>
      recipeService.updateRecipe(id, data),
    { onSuccess: () => qc.invalidateQueries(['recipes']) }
  );
};

export const useDeleteRecipe = () => {
  const qc = useQueryClient();
  return useMutation((id: string) => recipeService.deleteRecipe(id), {
    onSuccess: () => qc.invalidateQueries(['recipes']),
  });
};

export const useToggleFeatureRecipe = () => {
  const qc = useQueryClient();
  return useMutation((id: string) => recipeService.toggleFeature(id), {
    onSuccess: () => qc.invalidateQueries(['recipes']),
  });
};

export const useVerifyRecipe = () => {
  const qc = useQueryClient();
  return useMutation((id: string) => recipeService.verifyRecipe(id), {
    onSuccess: () => qc.invalidateQueries(['recipes']),
  });
};

export const useRestoreRecipe = () => {
  const qc = useQueryClient();
  return useMutation((id: string) => recipeService.restoreRecipe(id), {
    onSuccess: () => qc.invalidateQueries(['recipes']),
  });
};
