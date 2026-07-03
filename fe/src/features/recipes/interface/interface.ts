export interface RecipeIngredient {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  notes?: string;
}

export type IngredientInput = Omit<RecipeIngredient, 'id'>;
export interface RecipeInstruction {
  step: number;
  description: string;
  image?: string;
  timers?: Array<{ duration: number; description: string }>;
}

export interface RecipeNutrition {
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
}

export interface Recipe {
  _id: string;
  title: string;
  slug: string;
  description: string;
  coverImage?: string;
  images: string[];
  preparationTime?: number;
  cookingTime?: number;
  servings?: number;
  difficulty: 'easy' | 'medium' | 'hard';
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
  nutritionInfo?: RecipeNutrition;
  cuisineType?: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'dessert' | 'snack' | 'appetizer' | 'drink' | 'other';
  tags: string[];
  authorId: { _id: string; name: string };
  authorName?: string;
  isPublished: boolean;
  isVerified: boolean;
  isFeatured: boolean;
  isDeleted: boolean;
  viewCount: number;
  likes: number;
  rating: number;
  ratingCount: number;
  videoDemonstration?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeFormData {
  title: string;
  description: string;
  preparationTime?: number;
  cookingTime?: number;
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  ingredients?: IngredientInput[];
  instructions?: RecipeInstruction[];
  nutritionInfo?: RecipeNutrition;
  cuisineType?: string;
  mealType?: string;
  tags?: string[];
  isPublished?: boolean;
  isFeatured?: boolean;
  videoDemonstration?: string;
  coverImage?: File | string;
}

export interface RecipePagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  limit: number;
}
export interface RecipeStep {
  id: string;
  content: string;
  imageUrl?: string;
}