import React, { useState } from 'react';
import {
  Bell, Search, Trash2, Eye, CheckCircle,
  ChevronLeft, ChevronRight, Calendar, Info
} from 'lucide-react';
import { useNotifications, useDeleteNotification, useMarkNotificationRead } from '../hooks/useNotifications';
import type { AppNotification, NotificationType, NotificationPriority } from '../interface/interface';

const TYPE_LABELS: Record<NotificationType, string> = {
  order_status: 'Đơn hàng',
  payment_status: 'Thanh toán',
  account_update: 'Tài khoản',
  product_restock: 'Hàng về',
  price_drop: 'Giảm giá',
  review_response: 'Phản hồi đánh giá',
  flash_sale: 'Flash sale',
  voucher: 'Voucher',
  maintenance_reminder: 'Bảo trì',
  wishlist_price_change: 'Wishlist - đổi giá',
  wishlist_back_in_stock: 'Wishlist - có hàng',
  system: 'Hệ thống',
};

const PriorityBadge: React.FC<{ priority: NotificationPriority }> = ({ priority }) => {
  const map: Record<NotificationPriority, { bg: string; text: string; label: string }> = {
    low: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Thấp' },
    medium: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Trung bình' },
    high: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cao' },
  };
  const s = map[priority] ?? map.medium;
  return (
    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
};

const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('vi-VN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
};

const NotificationManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<NotificationType | ''>('');
  const [filterRead, setFilterRead] = useState<'all' | 'read' | 'unread'>('all');
  const [currentNotification, setCurrentNotification] = useState<AppNotification | null>(null);

  const { data, isLoading, isError, page, setPage, limit } = useNotifications({
    type: filterType || undefined,
    isRead: filterRead === 'all' ? undefined : filterRead === 'read',
  });

  const deleteMutation = useDeleteNotification();
  const markReadMutation = useMarkNotificationRead();

  const notifications: AppNotification[] = data?.notifications ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 0;
  const totalItems = pagination?.total ?? 0;

  // Client-side search on the current page (backend has no text search for notifications)
  const visibleNotifications = notifications.filter((n) => {
    const q = searchTerm.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
  });

  const clearFilters = () => {
    setSearchTerm('');
    setFilterType('');
    setFilterRead('all');
    setPage(1);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa thông báo này?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleView = (notification: AppNotification) => {
    setCurrentNotification(notification);
    if (!notification.isRead) {
      markReadMutation.mutate(notification._id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <Bell className="mr-2" size={24} />
          Thông báo của tôi
        </h1>
      </div>

      {/* Backend limitation notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
        thông báo hiện chỉ trả về thông báo của người dùng đang đăng nhập
          (<span className="font-medium">GET /notifications</span>). Việc tạo chiến dịch gửi hàng loạt và
          các chỉ số như tỷ lệ mở/click cần thêm endpoint quản trị ở backend.
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white shadow-sm rounded-lg p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Tìm kiếm theo tiêu đề, nội dung..."
              className="pl-10 w-full py-2 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[150px]"
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value as NotificationType | ''); setPage(1); }}
            >
              <option value="">Tất cả loại</option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <select
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[150px]"
              value={filterRead}
              onChange={(e) => { setFilterRead(e.target.value as 'all' | 'read' | 'unread'); setPage(1); }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="unread">Chưa đọc</option>
              <option value="read">Đã đọc</option>
            </select>

            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600"
            >
              Xóa bộ lọc
            </button>
          </div>
        </div>
      </div>

      {/* Notifications Table */}
      <div className="overflow-x-auto bg-white shadow-sm rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tiêu đề</th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loại</th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mức độ</th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tạo lúc</th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
              <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Hành động</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">Đang tải dữ liệu...</td></tr>
            ) : isError ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-red-500">Không thể tải thông báo. Vui lòng thử lại.</td></tr>
            ) : visibleNotifications.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">Không có thông báo nào.</td></tr>
            ) : (
              visibleNotifications.map((notification) => (
                <tr key={notification._id} className={`hover:bg-gray-50 ${!notification.isRead ? 'bg-indigo-50/40' : ''}`}>
                  <td className="px-3 py-4">
                    <div className="text-sm font-medium text-gray-900">{notification.title}</div>
                    <div className="text-sm text-gray-500 truncate max-w-xs">{notification.message}</div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      {TYPE_LABELS[notification.type] ?? notification.type}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <PriorityBadge priority={notification.priority} />
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 text-gray-500 mr-1" />
                      <span className="text-sm text-gray-900">{formatDate(notification.createdAt)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      notification.isRead ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {notification.isRead ? 'Đã đọc' : 'Chưa đọc'}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex justify-center space-x-2">
                      <button
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Xem chi tiết"
                        onClick={() => handleView(notification)}
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                      {!notification.isRead && (
                        <button
                          className="text-green-600 hover:text-green-900 disabled:opacity-50"
                          title="Đánh dấu đã đọc"
                          disabled={markReadMutation.isLoading}
                          onClick={() => markReadMutation.mutate(notification._id)}
                        >
                          <CheckCircle className="h-5 w-5" />
                        </button>
                      )}
                      <button
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        title="Xóa"
                        disabled={deleteMutation.isLoading}
                        onClick={() => handleDelete(notification._id)}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Trang <span className="font-medium">{page}</span> / <span className="font-medium">{totalPages}</span>
            {' '}— tổng <span className="font-medium">{totalItems}</span> thông báo
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
                    page === pageNum ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'
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

      {/* Notification Detail Modal */}
      {currentNotification && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="w-full">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center gap-2">
                    Chi tiết thông báo
                    <PriorityBadge priority={currentNotification.priority} />
                  </h3>
                  <div className="mt-4 space-y-4">
                    <div className="flex justify-between">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        {TYPE_LABELS[currentNotification.type] ?? currentNotification.type}
                      </span>
                      <div className="text-sm text-gray-500">ID: {currentNotification._id}</div>
                    </div>
                    <h4 className="text-md font-medium text-gray-900">{currentNotification.title}</h4>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <div className="text-sm text-gray-500 font-medium mb-2">Nội dung:</div>
                      <p className="text-sm text-gray-900">{currentNotification.message}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-500 font-medium">Thời gian tạo:</div>
                        <div className="text-sm text-gray-900 mt-1">{formatDate(currentNotification.createdAt)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 font-medium">Trạng thái:</div>
                        <div className="text-sm text-gray-900 mt-1">{currentNotification.isRead ? 'Đã đọc' : 'Chưa đọc'}</div>
                      </div>
                      {currentNotification.expiresAt && (
                        <div>
                          <div className="text-sm text-gray-500 font-medium">Hết hạn:</div>
                          <div className="text-sm text-gray-900 mt-1">{formatDate(currentNotification.expiresAt)}</div>
                        </div>
                      )}
                    </div>
                    {currentNotification.action?.url && (
                      <a
                        href={currentNotification.action.url}
                        className="inline-block text-sm text-indigo-600 hover:text-indigo-800"
                      >
                        {currentNotification.action.text || 'Xem chi tiết'}
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setCurrentNotification(null)}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationManagement;
