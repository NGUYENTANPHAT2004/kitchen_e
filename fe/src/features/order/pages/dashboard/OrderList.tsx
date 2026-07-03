import React from 'react';
import {
  ShoppingCart, Search, Filter, Calendar,
  Eye, Truck, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, Download, Printer
} from 'lucide-react';
import { useAdminOrders } from '../../hooks/useAdminOrders';
import type { Order } from '../../interface/interface';

const STATUS_LABELS: Record<Order['status'], string> = {
  pending: 'Chờ xử lý',
  processing: 'Đang xử lý',
  shipped: 'Đang giao hàng',
  delivered: 'Đã giao hàng',
  cancelled: 'Đã hủy',
};

const STATUS_COLORS: Record<Order['status'], string> = {
  pending: 'bg-blue-100 text-blue-800',
  processing: 'bg-yellow-100 text-yellow-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const PAYMENT_LABELS: Record<Order['paymentStatus'], string> = {
  paid: 'Đã thanh toán',
  unpaid: 'Chưa thanh toán',
  refunded: 'Đã hoàn tiền',
};

const PAYMENT_COLORS: Record<Order['paymentStatus'], string> = {
  paid: 'bg-green-100 text-green-800',
  unpaid: 'bg-yellow-100 text-yellow-800',
  refunded: 'bg-red-100 text-red-800',
};

const OrderManagement: React.FC = () => {
  const {
    orders,
    pagination,
    isLoading,
    filters,
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    handleFilterChange,
    clearFilters,
    updateStatus,
    cancelOrder,
    isUpdatingStatus,
    isCancelling,
  } = useAdminOrders();

  const getCustomerName = (order: Order) => {
    if (!order.userId) return 'Khách vãng lai';
    const { firstName, lastName, username } = order.userId;
    return [firstName, lastName].filter(Boolean).join(' ') || username || '—';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <ShoppingCart className="mr-2" size={24} />
          Quản lý đơn hàng
          {pagination.totalItems > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({pagination.totalItems.toLocaleString()} đơn)
            </span>
          )}
        </h1>
        <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
          <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            <Download size={16} className="mr-1" />
            Xuất Excel
          </button>
          <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            <Printer size={16} className="mr-1" />
            In
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow-sm rounded-lg p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Tìm theo mã đơn, tên khách hàng..."
              className="pl-10 w-full py-2 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <select
                className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[140px]"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value as Order['status'] | '')}
              >
                <option value="">Tất cả trạng thái</option>
                {(Object.keys(STATUS_LABELS) as Order['status'][]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <Filter className="h-4 w-4 text-gray-400" />
              </div>
            </div>
            <div className="relative">
              <select
                className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[160px]"
                value={filters.paymentStatus}
                onChange={(e) => handleFilterChange('paymentStatus', e.target.value as Order['paymentStatus'] | '')}
              >
                <option value="">Tất cả TT thanh toán</option>
                {(Object.keys(PAYMENT_LABELS) as Order['paymentStatus'][]).map((s) => (
                  <option key={s} value={s}>{PAYMENT_LABELS[s]}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <Filter className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="date"
                className="pl-10 py-2 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={filters.dateRange.start}
                onChange={(e) => handleFilterChange('dateRange', { ...filters.dateRange, start: e.target.value })}
              />
            </div>
            <span className="text-gray-500">đến</span>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="date"
                className="pl-10 py-2 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={filters.dateRange.end}
                onChange={(e) => handleFilterChange('dateRange', { ...filters.dateRange, end: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={clearFilters} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600">
              Xóa bộ lọc
            </button>
            <select
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
            >
              <option value={10}>10 mục</option>
              <option value={25}>25 mục</option>
              <option value={50}>50 mục</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white shadow-sm rounded-lg">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500" />
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Mã đơn hàng', 'Khách hàng', 'Ngày đặt', 'Tổng tiền', 'Trạng thái', 'Thanh toán', 'PT thanh toán', 'Hành động'].map((h) => (
                  <th key={h} scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    Không có đơn hàng nào.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order._id} className="hover:bg-gray-50">
                    <td className="px-3 py-4 whitespace-nowrap">
                      <div className="font-medium text-indigo-600">{order.orderNumber}</div>
                      <div className="text-xs text-gray-500">{order.items.length} sản phẩm</div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{getCustomerName(order)}</div>
                      <div className="text-xs text-gray-500">{order.userId?.phoneNumber ?? order.userId?.email ?? ''}</div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {order.totalAmount.toLocaleString()} VNĐ
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${PAYMENT_COLORS[order.paymentStatus]}`}>
                        {PAYMENT_LABELS[order.paymentStatus]}
                      </span>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.paymentMethod}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex justify-center gap-2">
                        <button className="text-indigo-600 hover:text-indigo-900" title="Xem chi tiết">
                          <Eye className="h-5 w-5" />
                        </button>
                        {(order.status === 'pending' || order.status === 'processing') && (
                          <button
                            onClick={() => updateStatus({ id: order._id, status: 'shipped' })}
                            disabled={isUpdatingStatus}
                            className="text-purple-600 hover:text-purple-900 disabled:opacity-50"
                            title="Đánh dấu đang giao"
                          >
                            <Truck className="h-5 w-5" />
                          </button>
                        )}
                        {order.status === 'shipped' && (
                          <button
                            onClick={() => updateStatus({ id: order._id, status: 'delivered' })}
                            disabled={isUpdatingStatus}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            title="Đánh dấu hoàn thành"
                          >
                            <CheckCircle className="h-5 w-5" />
                          </button>
                        )}
                        {(order.status === 'pending' || order.status === 'processing') && (
                          <button
                            onClick={() => {
                              if (confirm('Bạn có chắc muốn hủy đơn hàng này?')) {
                                cancelOrder(order._id);
                              }
                            }}
                            disabled={isCancelling}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            title="Hủy đơn hàng"
                          >
                            <XCircle className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Hiển thị{' '}
            <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> đến{' '}
            <span className="font-medium">{Math.min(currentPage * itemsPerPage, pagination.totalItems)}</span> của{' '}
            <span className="font-medium">{pagination.totalItems.toLocaleString()}</span> đơn hàng
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 border rounded-md text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let pageNum: number;
              if (pagination.totalPages <= 5) pageNum = i + 1;
              else if (currentPage <= 3) pageNum = i + 1;
              else if (currentPage >= pagination.totalPages - 2) pageNum = pagination.totalPages - 4 + i;
              else pageNum = currentPage - 2 + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-2 border rounded-md text-sm font-medium ${
                    currentPage === pageNum ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === pagination.totalPages}
              className="px-3 py-2 border rounded-md text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;
