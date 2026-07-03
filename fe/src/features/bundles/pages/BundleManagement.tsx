import React, { useState } from 'react';
import {
  Package, Search, PlusCircle, Edit, Trash2, Eye,
  ChevronLeft, ChevronRight, Filter,
  Download, Tag, DollarSign
} from 'lucide-react';
import { useBundles, useDeleteBundle } from '../hooks/useBundles';
import { urlUtils } from '../../../config/api_cli.config';
import type { Bundle } from '../interface/interface';

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('vi-VN');
};

const BundleManagement: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const { data, isLoading, isError, page, setPage, limit } = useBundles({
    search: searchTerm || undefined,
    active: filterStatus === 'active' ? true : undefined,
  });

  const deleteMutation = useDeleteBundle();

  const bundles: Bundle[] = data?.bundles ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 0;
  const totalItems = pagination?.totalItems ?? 0;

  // Backend filters by active=true; inactive is filtered client-side on the current page
  const visibleBundles = bundles.filter((bundle) => {
    if (filterStatus === 'inactive') return !bundle.isActive;
    return true;
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(searchInput.trim());
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchTerm('');
    setFilterStatus('all');
    setPage(1);
  };

  const handleDeleteBundle = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa gói combo này?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <Package className="mr-2" size={24} />
          Quản lý combo sản phẩm
        </h1>
        <div className="mt-4 md:mt-0 flex flex-wrap gap-2">
          <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            <Download size={16} className="mr-1" />
            Xuất Excel
          </button>
          <a
            href="/bundles/add"
            className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <PlusCircle size={16} className="mr-1" />
            Thêm combo mới
          </a>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white shadow-sm rounded-lg p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <form className="relative flex-1" onSubmit={handleSearch}>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, mô tả... (nhấn Enter)"
              className="pl-10 w-full py-2 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </form>

          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <select
                className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[150px]"
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value as 'all' | 'active' | 'inactive');
                  setPage(1);
                }}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Không hoạt động</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <Filter className="h-4 w-4 text-gray-400" />
              </div>
            </div>
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600"
            >
              Xóa bộ lọc
            </button>
          </div>
        </div>
      </div>

      {/* Bundles Table */}
      <div className="overflow-x-auto bg-white shadow-sm rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Tên combo
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Sản phẩm
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Giảm giá
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Bắt đầu
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Kết thúc
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Trạng thái
              </th>
              <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-red-500">
                  Không thể tải danh sách combo. Vui lòng thử lại.
                </td>
              </tr>
            ) : visibleBundles.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                  Chưa có combo nào.
                </td>
              </tr>
            ) : (
              visibleBundles.map((bundle) => {
                const imageUrl = urlUtils.getFullImageUrl(bundle.image);
                const totalProducts = bundle.items?.length ?? 0;
                return (
                  <tr key={bundle._id} className="hover:bg-gray-50">
                    <td className="px-3 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 mr-3">
                          <div className="h-10 w-10 rounded-md bg-gray-200 flex items-center justify-center">
                            {imageUrl ? (
                              <img src={imageUrl} alt={bundle.name} className="h-10 w-10 rounded-md object-cover" />
                            ) : (
                              <Package className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{bundle.name}</div>
                          <div className="text-xs text-gray-500">{bundle.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Tag className="h-4 w-4 text-gray-500 mr-1" />
                        <span className="text-sm text-gray-900">{totalProducts} sản phẩm</span>
                      </div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium">
                        {bundle.discountType === 'percentage' ? (
                          <span className="text-green-600">{bundle.discountValue}%</span>
                        ) : (
                          <span className="flex items-center text-green-600">
                            <DollarSign className="h-4 w-4 mr-1" />
                            {new Intl.NumberFormat('vi-VN').format(bundle.discountValue)} VNĐ
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(bundle.startDate)}</div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(bundle.endDate)}</div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        bundle.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {bundle.isActive ? 'Đang hoạt động' : 'Không hoạt động'}
                      </span>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex justify-center space-x-2">
                        <a
                          href={`/bundles/${bundle._id}`}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Xem chi tiết"
                        >
                          <Eye className="h-5 w-5" />
                        </a>
                        <a
                          href={`/bundles/${bundle._id}/edit`}
                          className="text-blue-600 hover:text-blue-900"
                          title="Sửa"
                        >
                          <Edit className="h-5 w-5" />
                        </a>
                        <button
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                          title="Xóa"
                          disabled={deleteMutation.isLoading}
                          onClick={() => handleDeleteBundle(bundle._id)}
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Trang <span className="font-medium">{page}</span> / <span className="font-medium">{totalPages}</span>
            {' '}— tổng <span className="font-medium">{totalItems}</span> combo
            {' '}(hiển thị {limit}/trang)
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-2 border rounded-md text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-3 py-2 border rounded-md text-sm font-medium ${
                    page === pageNum
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-2 border rounded-md text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BundleManagement;
