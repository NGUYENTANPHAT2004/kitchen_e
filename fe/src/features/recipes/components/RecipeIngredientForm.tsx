import React from 'react';
import { Plus, Trash2, MessageSquare } from 'lucide-react';
import type { RecipeIngredient } from '../interface/interface';

interface Props {
  ingredients: RecipeIngredient[];
  onAdd: () => void;
  onUpdate: (id: string, field: keyof RecipeIngredient, value: string) => void;
  onRemove: (id: string) => void;
}

const RecipeIngredientForm: React.FC<Props> = ({ ingredients, onAdd, onUpdate, onRemove }) => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900">Nguyên liệu</h2>
        <p className="mt-1 text-sm text-gray-500">
          Thêm tất cả nguyên liệu cần thiết cho công thức này
        </p>
      </div>

      <div className="space-y-4">
        {ingredients.map((ingredient) => (
          <div key={ingredient.id} className="flex items-center gap-2">
            <div className="w-full sm:w-1/2">
              <input
                type="text"
                value={ingredient.name}
                onChange={(e) => onUpdate(ingredient.id, 'name', e.target.value)}
                placeholder="Tên nguyên liệu"
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
            <div className="w-1/5">
              <input
                type="text"
                value={ingredient.quantity}
                onChange={(e) => onUpdate(ingredient.id, 'quantity', e.target.value)}
                placeholder="Số lượng"
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
            <div className="w-1/5">
              <input
                type="text"
                value={ingredient.unit}
                onChange={(e) => onUpdate(ingredient.id, 'unit', e.target.value)}
                placeholder="Đơn vị"
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
            <button
              type="button"
              onClick={() => onRemove(ingredient.id)}
              className="flex-shrink-0 text-red-500 hover:text-red-700"
              disabled={ingredients.length <= 1}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus className="mr-2 h-4 w-4" />
          Thêm nguyên liệu
        </button>
      </div>

      <div className="mt-8">
        <div className="bg-yellow-50 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <MessageSquare className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Mẹo hay</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Sắp xếp các nguyên liệu theo thứ tự sử dụng trong công thức để giúp người đọc dễ theo dõi.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipeIngredientForm;
