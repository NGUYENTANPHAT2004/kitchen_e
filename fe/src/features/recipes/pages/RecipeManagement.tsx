import React, { useState } from 'react';
import {
  Book, Search, Filter, Trash2, Eye, Edit,
  ArrowUpDown, ChevronLeft, ChevronRight, PlusCircle,
  CheckCircle, Star, Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useRecipes,
  useDeleteRecipe,
  useToggleFeatureRecipe,
  useVerifyRecipe,
} from '../hooks/useRecipes';
import type { Recipe } from '../interface/interface';

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Dễ',
  medium: 'Trung bình',
  hard: 'Khó',
};

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Bữa sáng',
  lunch: 'Bữa trưa',
  dinner: 'Bữa tối',
  dessert: 'Tráng miệng',
  snack: 'Đồ ăn nhẹ',
  appetizer: 'Khai vị',
  drink: 'Đồ uống',
  other: 'Khác',
};

const DifficultyBadge: React.FC<{ difficulty: string }> = ({ difficulty }) => {
  const map: Record<string, string> = {
    easy: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    hard: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[difficulty] ?? 'bg-gray-100 text-gray-800'}`}>
      {DIFFICULTY_LABELS[difficulty] ?? difficulty}
    </span>
  );
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const RecipeManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterMealType, setFilterMealType] = useState('');
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data, isLoading, page, setPage } = useRecipes({
    search: searchTerm || undefined,
    difficulty: filterDifficulty || undefined,
    mealType: filterMealType || undefined,
  });

  const deleteMutation = useDeleteRecipe();
  const featureMutation = useToggleFeatureRecipe();
  const verifyMutation = useVerifyRecipe();

  const recipes: Recipe[] = data?.recipes ?? [];
  const pagination = data?.pagination;

  const sorted = [...recipes].sort((a: any, b: any) => {
    if (a[sortField] < b[sortField]) return sortDir === 'asc' ? -1 : 1;
    if (a[sortField] > b[sortField]) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: string) => {
    if (field === sortField) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Xóa công thức này?')) deleteMutation.mutate(id);
  };

  const handleBulkDelete = () => {
    if (!window.confirm(`Xóa ${selectedIds.length} công thức?`)) return;
    selectedIds.forEach(id => deleteMutation.mutate(id));
    setSelectedIds([]);
  };

  const SortHeader: React.FC<{ field: string; label: string }> = ({ field, label }) => (
    <div className="flex items-center cursor-pointer" onClick={() => handleSort(field)}>
      {label}
      {sortField === field && (
        <ArrowUpDown className={`ml-1 h-4 w-4 text-indigo-600 ${sortDir === 'desc' ? 'rotate-180' : ''}`} />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <Book className="mr-2" size={24} />
          Quản lý công thức nấu ăn
        </h1>
        <Link
          to="/recipes/add"
          className="mt-3 sm:mt-0 inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
        >
          <PlusCircle size={16} className="mr-1" /> Thêm công thức
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white shadow-sm rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm công thức..."
              className="pl-10 w-full py-2 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>
          <div className="relative">
            <select
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[140px]"
              value={filterDifficulty}
              onChange={e => { setFilterDifficulty(e.target.value); setPage(1); }}
            >
              <option value="">Tất cả độ khó</option>
              <option value="easy">Dễ</option>
              <option value="medium">Trung bình</option>
              <option value="hard">Khó</option>
            </select>
            <Filter className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[140px]"
              value={filterMealType}
              onChange={e => { setFilterMealType(e.target.value); setPage(1); }}
            >
              <option value="">Tất cả loại</option>
              {Object.entries(MEAL_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <Filter className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          <button onClick={() => { setSearchTerm(''); setFilterDifficulty(''); setFilterMealType(''); }}
            className="px-4 py-2 text-sm text-gray-600 hover:text-indigo-600">
            Xóa bộ lọc
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-50 p-4 rounded-md flex items-center justify-between">
          <span className="text-indigo-700 font-medium">{selectedIds.length} đã chọn</span>
          <button onClick={handleBulkDelete} className="px-3 py-1 bg-white text-red-600 border border-red-200 rounded-md hover:bg-red-50 flex items-center gap-1">
            <Trash2 className="h-4 w-4" /> Xóa đã chọn
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto bg-white shadow-sm rounded-lg">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Đang tải...</div>
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Không có công thức nào</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left">
                  <input type="checkbox" className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    onChange={e => setSelectedIds(e.target.checked ? sorted.map(r => r._id) : [])}
                    checked={selectedIds.length === sorted.length && sorted.length > 0} />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortHeader field="title" label="Công thức" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortHeader field="difficulty" label="Độ khó" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loại</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortHeader field="rating" label="Đánh giá" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortHeader field="viewCount" label="Lượt xem" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortHeader field="createdAt" label="Ngày tạo" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Hành động</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sorted.map(recipe => (
                <tr key={recipe._id} className="hover:bg-gray-50">
                  <td className="px-3 py-4">
                    <input type="checkbox" className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                      checked={selectedIds.includes(recipe._id)}
                      onChange={() => setSelectedIds(ids =>
                        ids.includes(recipe._id) ? ids.filter(i => i !== recipe._id) : [...ids, recipe._id]
                      )} />
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-3">
                      {recipe.coverImage ? (
                        <img src={recipe.coverImage} alt={recipe.title} className="h-10 w-10 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Book className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{recipe.title}</div>
                        {recipe.preparationTime && (
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {(recipe.preparationTime ?? 0) + (recipe.cookingTime ?? 0)} phút
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4"><DifficultyBadge difficulty={recipe.difficulty} /></td>
                  <td className="px-3 py-4 text-sm text-gray-700">{MEAL_TYPE_LABELS[recipe.mealType] ?? recipe.mealType}</td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-1 text-sm text-yellow-500">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="text-gray-700">{recipe.rating?.toFixed(1) ?? '—'}</span>
                      <span className="text-xs text-gray-400">({recipe.ratingCount})</span>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-700">{recipe.viewCount.toLocaleString()}</td>
                  <td className="px-3 py-4 text-sm text-gray-700 whitespace-nowrap">{formatDate(recipe.createdAt)}</td>
                  <td className="px-3 py-4">
                    <div className="flex flex-col gap-1">
                      {recipe.isPublished && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" /> Đã xuất bản
                        </span>
                      )}
                      {recipe.isFeatured && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          <Star className="h-3 w-3 mr-1" /> Nổi bật
                        </span>
                      )}
                      {recipe.isVerified && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <CheckCircle className="h-3 w-3 mr-1" /> Đã xác minh
                        </span>
                      )}
                      {!recipe.isPublished && !recipe.isFeatured && !recipe.isVerified && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Nháp
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Link to={`/recipes/${recipe._id}`} className="text-indigo-600 hover:text-indigo-900" title="Xem">
                        <Eye className="h-5 w-5" />
                      </Link>
                      <Link to={`/recipes/${recipe._id}/edit`} className="text-blue-600 hover:text-blue-900" title="Sửa">
                        <Edit className="h-5 w-5" />
                      </Link>
                      <button
                        onClick={() => featureMutation.mutate(recipe._id)}
                        disabled={featureMutation.isLoading}
                        className={`hover:text-yellow-600 disabled:opacity-50 ${recipe.isFeatured ? 'text-yellow-500' : 'text-gray-400'}`}
                        title={recipe.isFeatured ? 'Bỏ nổi bật' : 'Đặt nổi bật'}
                      >
                        <Star className="h-5 w-5" />
                      </button>
                      {!recipe.isVerified && (
                        <button
                          onClick={() => verifyMutation.mutate(recipe._id)}
                          disabled={verifyMutation.isLoading}
                          className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                          title="Xác minh"
                        >
                          <CheckCircle className="h-5 w-5" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(recipe._id)} disabled={deleteMutation.isLoading}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50" title="Xóa">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Trang <span className="font-medium">{page}</span> / <span className="font-medium">{pagination.totalPages}</span>
            {' '}— tổng <span className="font-medium">{pagination.totalItems}</span> công thức
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-2 border rounded-md text-sm disabled:opacity-50">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let n: number;
              if (pagination.totalPages <= 5) n = i + 1;
              else if (page <= 3) n = i + 1;
              else if (page >= pagination.totalPages - 2) n = pagination.totalPages - 4 + i;
              else n = page - 2 + i;
              return (
                <button key={n} onClick={() => setPage(n)}
                  className={`px-3 py-2 border rounded-md text-sm ${page === n ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
                  {n}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
              className="px-3 py-2 border rounded-md text-sm disabled:opacity-50">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipeManagement;
