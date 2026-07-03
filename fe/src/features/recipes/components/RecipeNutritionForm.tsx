import React from 'react';
import { X, Search } from 'lucide-react';
import type { RecipeNutrition } from '../interface/interface';

interface Props {
  nutrition: RecipeNutrition;
  tags: string[];
  tagInput: string;
  relatedProducts: string[];
  productInput: string;
  onNutritionChange: (field: keyof RecipeNutrition, value: string) => void;
  onTagInputChange: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  onProductInputChange: (value: string) => void;
  onAddProduct: () => void;
  onRemoveProduct: (product: string) => void;
}

const RecipeNutritionForm: React.FC<Props> = ({
  nutrition, tags, tagInput, relatedProducts, productInput,
  onNutritionChange, onTagInputChange, onAddTag, onRemoveTag,
  onProductInputChange, onAddProduct, onRemoveProduct,
}) => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900">Thông tin dinh dưỡng</h2>
        <p className="mt-1 text-sm text-gray-500">
          Cung cấp thông tin dinh dưỡng cho mỗi khẩu phần (không bắt buộc)
        </p>

        <div className="mt-4 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-5">
          {([
            { key: 'calories', label: 'Calories', step: '1' },
            { key: 'protein', label: 'Protein (g)', step: '0.1' },
            { key: 'carbs', label: 'Carbs (g)', step: '0.1' },
            { key: 'fat', label: 'Fat (g)', step: '0.1' },
            { key: 'fiber', label: 'Fiber (g)', step: '0.1' },
          ] as { key: keyof RecipeNutrition; label: string; step: string }[]).map(({ key, label, step }) => (
            <div key={key}>
              <label htmlFor={key} className="block text-sm font-medium text-gray-700">
                {label}
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  id={key}
                  value={nutrition[key] || ''}
                  onChange={(e) => onNutritionChange(key, e.target.value)}
                  min="0"
                  step={step}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-lg font-medium text-gray-900">Thẻ (Tags)</h2>
        <p className="mt-1 text-sm text-gray-500">
          Thêm các thẻ để giúp người dùng tìm kiếm công thức dễ dàng hơn
        </p>

        <div className="mt-4">
          <div className="flex rounded-md shadow-sm">
            <div className="relative flex-grow focus-within:z-10">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => onTagInputChange(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); onAddTag(); }
                }}
                placeholder="Nhập thẻ và nhấn Enter"
                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300"
              />
            </div>
            <button
              type="button"
              onClick={onAddTag}
              className="-ml-px relative inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 text-sm font-medium rounded-r-md text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            >
              Thêm
            </button>
          </div>

          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex rounded-full items-center py-0.5 pl-2.5 pr-1 text-sm font-medium bg-indigo-100 text-indigo-700"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => onRemoveTag(tag)}
                    className="flex-shrink-0 ml-0.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-indigo-400 hover:bg-indigo-200 hover:text-indigo-500 focus:outline-none focus:bg-indigo-500 focus:text-white"
                  >
                    <span className="sr-only">Remove tag {tag}</span>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-lg font-medium text-gray-900">Sản phẩm gợi ý</h2>
        <p className="mt-1 text-sm text-gray-500">
          Liên kết các sản phẩm liên quan đến công thức này
        </p>

        <div className="mt-4">
          <div className="flex rounded-md shadow-sm">
            <div className="relative flex-grow focus-within:z-10">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={productInput}
                onChange={(e) => onProductInputChange(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); onAddProduct(); }
                }}
                placeholder="Nhập ID hoặc tên sản phẩm"
                className="pl-10 focus:ring-indigo-500 focus:border-indigo-500 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300"
              />
            </div>
            <button
              type="button"
              onClick={onAddProduct}
              className="-ml-px relative inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 text-sm font-medium rounded-r-md text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            >
              Thêm
            </button>
          </div>

          {relatedProducts.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700">Sản phẩm đã thêm:</h3>
              <ul className="mt-2 border border-gray-200 rounded-md divide-y divide-gray-200">
                {relatedProducts.map(product => (
                  <li key={product} className="pl-3 pr-4 py-3 flex items-center justify-between text-sm">
                    <span className="ml-2 flex-1 w-0 truncate">{product}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveProduct(product)}
                      className="ml-4 font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      Xóa
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecipeNutritionForm;
