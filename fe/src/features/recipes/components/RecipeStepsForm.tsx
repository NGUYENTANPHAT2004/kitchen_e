import React from 'react';
import { Plus, Trash2, Image } from 'lucide-react';
import type { RecipeStep } from '../interface/interface';

interface Props {
  steps: RecipeStep[];
  onAdd: () => void;
  onUpdate: (id: string, content: string) => void;
  onUpdateImage: (id: string, imageUrl: string) => void;
  onRemove: (id: string) => void;
}

const RecipeStepsForm: React.FC<Props> = ({ steps, onAdd, onUpdate, onUpdateImage, onRemove }) => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900">Các bước thực hiện</h2>
        <p className="mt-1 text-sm text-gray-500">Chi tiết từng bước thực hiện công thức</p>
      </div>

      <div className="space-y-6">
        {steps.map((step, index) => (
          <div key={step.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-md font-medium text-gray-900">Bước {index + 1}</h3>
              <button
                type="button"
                onClick={() => onRemove(step.id)}
                className="text-red-500 hover:text-red-700"
                disabled={steps.length <= 1}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>

            <div>
              <textarea
                rows={3}
                value={step.content}
                onChange={(e) => onUpdate(step.id, e.target.value)}
                placeholder={`Mô tả chi tiết bước ${index + 1}`}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Hình ảnh minh họa (tùy chọn)
              </label>
              <div className="mt-1 flex items-center">
                <div className="flex-shrink-0 h-16 w-16 border border-gray-300 rounded-md flex items-center justify-center">
                  {step.imageUrl ? (
                    <img
                      src={step.imageUrl}
                      alt={`Step ${index + 1}`}
                      className="h-full w-full object-cover rounded-md"
                    />
                  ) : (
                    <Image className="h-6 w-6 text-gray-400" />
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <input
                    type="text"
                    value={step.imageUrl || ''}
                    onChange={(e) => onUpdateImage(step.id, e.target.value)}
                    placeholder="URL hình ảnh"
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus className="mr-2 h-4 w-4" />
          Thêm bước
        </button>
      </div>
    </div>
  );
};

export default RecipeStepsForm;
