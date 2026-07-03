import React from 'react';
import { Image } from 'lucide-react';

interface Props {
  title: string;
  description: string;
  category: string;
  prepTime: string;
  cookTime: string;
  servings: string;
  difficulty: string;
  thumbnailUrl: string;
  videoUrl: string;
  featured: boolean;
  onChange: (field: string, value: string | boolean) => void;
}

const RecipeBasicForm: React.FC<Props> = ({
  title, description, category, prepTime, cookTime, servings,
  difficulty, thumbnailUrl, videoUrl, featured, onChange,
}) => {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
        <div className="sm:col-span-4">
          <label htmlFor="recipe-title" className="block text-sm font-medium text-gray-700">
            Tên công thức <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <input
              type="text"
              id="recipe-title"
              value={title}
              onChange={(e) => onChange('title', e.target.value)}
              required
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              placeholder="Ví dụ: Cơm chiên dương châu"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="recipe-category" className="block text-sm font-medium text-gray-700">
            Danh mục <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <select
              id="recipe-category"
              value={category}
              onChange={(e) => onChange('category', e.target.value)}
              required
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            >
              <option value="">Chọn danh mục</option>
              <option value="appetizer">Khai vị</option>
              <option value="main-course">Món chính</option>
              <option value="soup">Súp</option>
              <option value="salad">Salad</option>
              <option value="dessert">Tráng miệng</option>
              <option value="drink">Đồ uống</option>
              <option value="breakfast">Bữa sáng</option>
              <option value="snack">Ăn vặt</option>
            </select>
          </div>
        </div>

        <div className="sm:col-span-6">
          <label htmlFor="recipe-description" className="block text-sm font-medium text-gray-700">
            Mô tả <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <textarea
              id="recipe-description"
              rows={3}
              value={description}
              onChange={(e) => onChange('description', e.target.value)}
              required
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              placeholder="Mô tả ngắn về công thức nấu ăn này"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="prep-time" className="block text-sm font-medium text-gray-700">
            Thời gian chuẩn bị (phút) <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <input
              type="number"
              id="prep-time"
              value={prepTime}
              onChange={(e) => onChange('prepTime', e.target.value)}
              min="0"
              required
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="cook-time" className="block text-sm font-medium text-gray-700">
            Thời gian nấu (phút) <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <input
              type="number"
              id="cook-time"
              value={cookTime}
              onChange={(e) => onChange('cookTime', e.target.value)}
              min="0"
              required
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="servings" className="block text-sm font-medium text-gray-700">
            Khẩu phần (người) <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <input
              type="number"
              id="servings"
              value={servings}
              onChange={(e) => onChange('servings', e.target.value)}
              min="1"
              required
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700">
            Độ khó
          </label>
          <div className="mt-1">
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => onChange('difficulty', e.target.value)}
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            >
              <option value="easy">Dễ</option>
              <option value="medium">Trung bình</option>
              <option value="hard">Khó</option>
            </select>
          </div>
        </div>

        <div className="sm:col-span-3">
          <div className="flex items-start pt-5">
            <div className="flex items-center h-5">
              <input
                id="featured"
                type="checkbox"
                checked={featured}
                onChange={(e) => onChange('featured', e.target.checked)}
                className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="featured" className="font-medium text-gray-700">
                Đánh dấu là công thức nổi bật
              </label>
              <p className="text-gray-500">Công thức nổi bật sẽ được hiển thị trên trang chủ</p>
            </div>
          </div>
        </div>

        <div className="sm:col-span-6">
          <label htmlFor="thumbnail" className="block text-sm font-medium text-gray-700">
            Ảnh đại diện công thức <span className="text-red-500">*</span>
          </label>
          <div className="mt-1 flex items-center">
            <div className="flex-shrink-0 h-24 w-24 border-2 border-gray-300 border-dashed rounded-md flex items-center justify-center">
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt="Thumbnail preview" className="h-full w-full object-cover rounded-md" />
              ) : (
                <Image className="h-10 w-10 text-gray-400" />
              )}
            </div>
            <div className="ml-4">
              <input
                type="text"
                id="thumbnail"
                value={thumbnailUrl}
                onChange={(e) => onChange('thumbnailUrl', e.target.value)}
                placeholder="Nhập URL ảnh"
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
              <p className="mt-1 text-xs text-gray-500">PNG, JPG, GIF tối đa 5MB</p>
            </div>
          </div>
        </div>

        <div className="sm:col-span-6">
          <label htmlFor="video-url" className="block text-sm font-medium text-gray-700">
            URL Video hướng dẫn (tùy chọn)
          </label>
          <div className="mt-1">
            <input
              type="text"
              id="video-url"
              value={videoUrl}
              onChange={(e) => onChange('videoUrl', e.target.value)}
              placeholder="Ví dụ: https://www.youtube.com/watch?v=..."
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">Hỗ trợ YouTube, Vimeo và các trang video phổ biến khác</p>
        </div>
      </div>
    </div>
  );
};

export default RecipeBasicForm;
