import { api } from '../../../config/api_cli.config';
import type { Recipe, RecipeFormData, RecipePagination } from '../interface/interface';

const recipeService = {
  async getRecipes(params: {
    page?: number;
    limit?: number;
    search?: string;
    difficulty?: string;
    mealType?: string;
    isPublished?: boolean;
    isFeatured?: boolean;
    sort?: string;
  } = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.difficulty) query.set('difficulty', params.difficulty);
    if (params.mealType) query.set('mealType', params.mealType);
    if (params.isPublished !== undefined) query.set('isPublished', String(params.isPublished));
    if (params.isFeatured !== undefined) query.set('isFeatured', String(params.isFeatured));
    if (params.sort) query.set('sort', params.sort);
    const response = await api.get(`/recipes?${query.toString()}`);
    return response.data.data as { recipes: Recipe[]; pagination: RecipePagination };
  },

  async getRecipe(id: string) {
    const response = await api.get(`/recipes/${id}`);
    return response.data.data as { recipe: Recipe };
  },

  async createRecipe(data: RecipeFormData) {
    const formData = new FormData();
    const { coverImage, ingredients, instructions, nutritionInfo, tags, ...rest } = data;

    Object.entries(rest).forEach(([k, v]) => {
      if (v !== undefined) formData.append(k, String(v));
    });
    if (ingredients) formData.append('ingredients', JSON.stringify(ingredients));
    if (instructions) formData.append('instructions', JSON.stringify(instructions));
    if (nutritionInfo) formData.append('nutritionInfo', JSON.stringify(nutritionInfo));
    if (tags) formData.append('tags', JSON.stringify(tags));
    if (coverImage instanceof File) formData.append('coverImage', coverImage);

    const response = await api.post('/recipes', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data as { recipe: Recipe };
  },

  async updateRecipe(id: string, data: Partial<RecipeFormData>) {
    const formData = new FormData();
    const { coverImage, ingredients, instructions, nutritionInfo, tags, ...rest } = data;

    Object.entries(rest).forEach(([k, v]) => {
      if (v !== undefined) formData.append(k, String(v));
    });
    if (ingredients) formData.append('ingredients', JSON.stringify(ingredients));
    if (instructions) formData.append('instructions', JSON.stringify(instructions));
    if (nutritionInfo) formData.append('nutritionInfo', JSON.stringify(nutritionInfo));
    if (tags) formData.append('tags', JSON.stringify(tags));
    if (coverImage instanceof File) formData.append('coverImage', coverImage);

    const response = await api.put(`/recipes/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data as { recipe: Recipe };
  },

  async deleteRecipe(id: string) {
    const response = await api.delete(`/recipes/${id}`);
    return response.data;
  },

  async restoreRecipe(id: string) {
    const response = await api.put(`/recipes/${id}/restore`);
    return response.data.data as { recipe: Recipe };
  },

  async toggleFeature(id: string) {
    const response = await api.put(`/recipes/${id}/feature`);
    return response.data.data as { recipe: Recipe };
  },

  async verifyRecipe(id: string) {
    const response = await api.put(`/recipes/${id}/verify`);
    return response.data.data as { recipe: Recipe };
  },

  async manageProducts(id: string, productId: string, action: 'add' | 'remove') {
    const response = await api.post(`/recipes/${id}/products`, { productId, action });
    return response.data.data;
  },
};

export default recipeService;
