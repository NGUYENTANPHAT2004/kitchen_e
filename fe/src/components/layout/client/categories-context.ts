import { createContext, useContext } from 'react';
import type { Category } from '../../../features/category/interface/interface';

export const CategoriesContext = createContext<Category[]>([]);
export const useCategories = () => useContext(CategoriesContext);
