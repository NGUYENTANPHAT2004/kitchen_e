import { useQuery } from '@tanstack/react-query';
import { categoryService } from '../service/categoryService';
import type { Category } from '../interface/interface';

export const useCategoriesForProducts = () => {
  return useQuery({
    queryKey: ['categories', 'for-products'],
    queryFn: () => categoryService.getCategoriesForProducts(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2
  });
};

export const useCategory = (id: string) => {
  return useQuery({
    queryKey: ['category', id],
    queryFn: () => categoryService.getCategory(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000
  });
};

// Category tree utilities
export const categoryUtils = {
  // Build tree structure for TreeSelect component
  buildTreeSelectData(categories: Category[], excludeId?: string): any[] {
    const buildNodes = (cats: any[]): any[] => {
      return cats
        .filter(cat => cat?._id && cat.name && cat.isActive && !cat.isDeleted && cat._id !== excludeId)
        .map(cat => {
          const children = cat.children || cat.subcategories || [];
          const node: any = { title: cat.name, value: cat._id };
          const childNodes = buildNodes(children);
          if (childNodes.length > 0) node.children = childNodes;
          return node;
        });
    };
    return buildNodes(categories);
  },

  // Build flat list for Select component
  buildFlatSelectData(categories: Category[]): Array<{ value: string; label: string; disabled?: boolean }> {
    try {
      if (!Array.isArray(categories)) {
        return [];
      }

      const flattenCategories = (cats: Category[], level = 0): Array<{ value: string; label: string; level: number }> => {
        let result: Array<{ value: string; label: string; level: number }> = [];
        
        const sortedCats = [...cats].sort((a, b) => {
          if (!a || !b) return 0;
          const orderA = a.displayOrder || 0;
          const orderB = b.displayOrder || 0;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          return (a.name || '').localeCompare(b.name || '');
        });
        
        sortedCats.forEach(cat => {
          if (cat?._id && cat.isActive && !cat.isDeleted) {
            const prefix = level > 0 ? '└─ '.repeat(level) : '';
            result.push({
              value: cat._id,
              label: `${prefix}${cat.name}`,
              level
            });
            
        const children = (cat as any).children || cat.subcategories;
            if (children && Array.isArray(children)) {
              result = result.concat(flattenCategories(children, level + 1));
            }
          }
        });
        
        return result;
      };

      // Build tree structure first
      const treeCategories = this.buildCategoryTree(categories);
      const flatCategories = flattenCategories(treeCategories);
      
      return flatCategories.map(cat => ({
        value: cat.value,
        label: cat.label,
        disabled: false
      }));
    } catch (error) {
      console.error('Error building flat select data:', error);
      return [];
    }
  },

  // Build category tree structure
  buildCategoryTree(categories: Category[]): Category[] {
    try {
      if (!Array.isArray(categories)) {
        console.log('buildCategoryTree: categories is not an array');
        return [];
      }
      
      // If categories already have children/subcategories populated, return as is
      if (categories.length > 0 && ((categories[0] as any).children !== undefined || categories[0]?.subcategories !== undefined)) {
        return categories;
      }

      const map = new Map<string, Category & { subcategories: Category[] }>();
      const roots: (Category & { subcategories: Category[] })[] = [];

      // Initialize map with all categories
      categories.forEach(cat => {
        if (cat?._id) {
          map.set(cat._id, { ...cat, subcategories: [] });
        }
      });

      // Build parent-child relationships
      map.forEach(cat => {
        if (cat.parentId && map.has(cat.parentId)) {
          const parent = map.get(cat.parentId)!;
          if (!parent.subcategories.find(sub => sub._id === cat._id)) {
            parent.subcategories.push(cat);
          }
        } else {
          roots.push(cat);
        }
      });

      console.log(`buildCategoryTree: Built tree with ${roots.length} root categories`);
      return roots;
    } catch (error) {
      console.error('Error building category tree:', error);
      return [];
    }
  }
};