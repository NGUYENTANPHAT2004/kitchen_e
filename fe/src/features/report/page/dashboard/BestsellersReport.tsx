import React, { useState } from 'react';
import {
  BarChart2, Package, Search, Download, Printer, Star, TrendingUp, Info
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { useBestSellingProducts } from '../../../products/hooks/useProducts';
import { urlUtils } from '../../../../config/api_cli.config';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const BestsellersReport: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  const { data: products = [], isLoading, isError } = useBestSellingProducts(15);

  // Filter by search term
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Top 5 by popularity for the chart
  const top5Products = [...filteredProducts]
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 5)
    .map((p) => ({ name: p.name, popularity: p.popularity ?? 0 }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <BarChart2 className="mr-2" size={24} />
          Báo cáo sản phẩm bán chạy
        </h1>
        <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
          <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            <Download size={16} className="mr-1" />
            Xuất Excel
          </button>
          <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            <Printer size={16} className="mr-1" />
            In báo cáo
          </button>
        </div>
      </div>

      {/* Backend limitation notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          Danh sách dưới đây xếp hạng theo độ phổ biến (popularity) và đánh giá trung bình từ API
          <span className="font-medium"> /products/best-selling</span>. Số lượng bán, doanh thu theo sản phẩm,
          phân bố theo danh mục và các thẻ tổng hợp cần thêm endpoint thống kê (tổng hợp từ đơn hàng) ở backend.
        </div>
      </div>

      {/* Search and view mode */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Tìm kiếm theo tên sản phẩm..."
              className="pl-10 w-full py-2 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                viewMode === 'table'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Bảng
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                viewMode === 'chart'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Biểu đồ
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="bg-white shadow-sm rounded-lg p-8 text-center text-sm text-gray-500">
          Đang tải dữ liệu...
        </div>
      ) : isError ? (
        <div className="bg-white shadow-sm rounded-lg p-8 text-center text-sm text-red-500">
          Không thể tải danh sách sản phẩm bán chạy. Vui lòng thử lại.
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thứ hạng
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sản phẩm
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Giá
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Đánh giá
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Độ phổ biến
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                      Không có sản phẩm nào.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product, index) => {
                    const imageUrl = urlUtils.getFullImageUrl(product.images?.[0]);
                    return (
                      <tr key={product._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium ${index < 3 ? 'text-indigo-600' : 'text-gray-900'}`}>
                            #{index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0">
                              <div className="h-10 w-10 rounded-md bg-gray-200 flex items-center justify-center overflow-hidden">
                                {imageUrl ? (
                                  <img src={imageUrl} alt={product.name} className="h-10 w-10 object-cover" />
                                ) : (
                                  <Package className="h-6 w-6 text-gray-400" />
                                )}
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{product.name}</div>
                              {product.slug && <div className="text-xs text-gray-500">{product.slug}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {product.basePrice != null ? formatCurrency(product.basePrice) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <span className="inline-flex items-center justify-end">
                            <Star className="h-4 w-4 text-yellow-400 mr-1" />
                            {(product.averageRating ?? 0).toFixed(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <span className="inline-flex items-center justify-end">
                            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                            {product.popularity ?? 0}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">Top 5 sản phẩm theo độ phổ biến</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top5Products}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={100}
                  tickFormatter={(value) => (value.length > 15 ? `${value.substring(0, 15)}...` : value)}
                />
                <Tooltip formatter={(value) => [`${value}`, 'Độ phổ biến']} />
                <Bar dataKey="popularity" name="Độ phổ biến" fill="#4F46E5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default BestsellersReport;
