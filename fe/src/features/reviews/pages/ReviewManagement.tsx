import React, { useState } from 'react';
import {
  MessageSquare, Search, Filter, Trash2, Eye,
  ArrowUpDown, ChevronLeft, ChevronRight, CheckCircle,
  XCircle, AlertTriangle, MessageCircle, Package
} from 'lucide-react';
import {
  useReviews,
  usePendingReviews,
  useReportedReviews,
  useApproveReview,
  useRejectReview,
  useRespondToReview,
  useDeleteReview,
} from '../hooks/useReviews';
import type { Review } from '../interface/interface';

type TabType = 'all' | 'pending' | 'reported';

const StarRating: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex">
    {[...Array(5)].map((_, i) => (
      <svg key={i} className={`h-4 w-4 ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
  </div>
);

const StatusBadge: React.FC<{ review: Review }> = ({ review }) => {
  if (review.isRejected) return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
      <XCircle size={14} className="mr-1" /> Từ chối
    </span>
  );
  if (review.reportCount > 0) return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
      <AlertTriangle size={14} className="mr-1" /> Báo cáo ({review.reportCount})
    </span>
  );
  if (review.isApproved) return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
      <CheckCircle size={14} className="mr-1" /> Đã duyệt
    </span>
  );
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
      <AlertTriangle size={14} className="mr-1" /> Chờ duyệt
    </span>
  );
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

const ReviewManagement: React.FC = () => {
  const [tab, setTab] = useState<TabType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRating, setFilterRating] = useState<number | ''>('');
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [modalReview, setModalReview] = useState<Review | null>(null);
  const [responseText, setResponseText] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const allQuery = useReviews({
    search: searchTerm || undefined,
    rating: filterRating || undefined,
    sort: `${sortDir === 'desc' ? '-' : ''}${sortField}`,
  });
  const pendingQuery = usePendingReviews();
  const reportedQuery = useReportedReviews();

  const activeQuery = tab === 'pending' ? pendingQuery : tab === 'reported' ? reportedQuery : allQuery;
  const { data, isLoading, page, setPage } = activeQuery as typeof allQuery;

  const reviews: Review[] = data?.reviews ?? [];
  const pagination = data?.pagination;

  const approveMutation = useApproveReview();
  const rejectMutation = useRejectReview();
  const respondMutation = useRespondToReview();
  const deleteMutation = useDeleteReview();

  const handleSort = (field: string) => {
    if (field === sortField) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedIds(e.target.checked ? reviews.map(r => r._id) : []);
  };

  const handleOpenModal = (review: Review) => {
    setModalReview(review);
    setResponseText(review.adminResponse?.comment ?? '');
    setRejectReason('');
  };

  const handleApprove = (id: string) => approveMutation.mutate(id);
  const handleReject = (id: string, reason?: string) => rejectMutation.mutate({ id, reason });
  const handleDelete = (id: string) => {
    if (window.confirm('Xóa đánh giá này?')) deleteMutation.mutate(id);
  };

  const handleSubmitResponse = () => {
    if (!modalReview) return;
    if (responseText.trim()) {
      respondMutation.mutate({ id: modalReview._id, comment: responseText }, {
        onSuccess: () => setModalReview(null),
      });
    } else {
      approveMutation.mutate(modalReview._id, { onSuccess: () => setModalReview(null) });
    }
  };

  const handleBulkDelete = () => {
    if (!window.confirm(`Xóa ${selectedIds.length} đánh giá?`)) return;
    selectedIds.forEach(id => deleteMutation.mutate(id));
    setSelectedIds([]);
  };

  const handleBulkApprove = () => {
    selectedIds.forEach(id => approveMutation.mutate(id));
    setSelectedIds([]);
  };

  const handleBulkReject = () => {
    selectedIds.forEach(id => rejectMutation.mutate({ id }));
    setSelectedIds([]);
  };

  const SortHeader: React.FC<{ field: string; label: string }> = ({ field, label }) => (
    <div className="flex items-center cursor-pointer" onClick={() => handleSort(field)}>
      {label}
      {sortField === field && tab === 'all' && (
        <ArrowUpDown className={`ml-1 h-4 w-4 text-indigo-600 ${sortDir === 'desc' ? 'transform rotate-180' : ''}`} />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <MessageSquare className="mr-2" size={24} />
          Quản lý đánh giá sản phẩm
        </h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6">
          {([['all', 'Tất cả'], ['pending', 'Chờ duyệt'], ['reported', 'Báo cáo']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setSelectedIds([]); }}
              className={`pb-2 text-sm font-medium border-b-2 ${tab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters (all tab only) */}
      {tab === 'all' && (
        <div className="bg-white shadow-sm rounded-lg p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm theo sản phẩm, nội dung..."
                className="pl-10 w-full py-2 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative">
              <select
                className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[140px]"
                value={filterRating}
                onChange={e => setFilterRating(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">Tất cả sao</option>
                {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} sao</option>)}
              </select>
              <Filter className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
            <button onClick={() => { setSearchTerm(''); setFilterRating(''); }} className="px-4 py-2 text-sm text-gray-600 hover:text-indigo-600">
              Xóa bộ lọc
            </button>
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-50 p-4 rounded-md flex items-center justify-between">
          <span className="text-indigo-700 font-medium">{selectedIds.length} đã chọn</span>
          <div className="flex gap-2">
            <button onClick={handleBulkApprove} className="px-3 py-1 bg-white text-green-600 border border-green-200 rounded-md hover:bg-green-50 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" /> Duyệt
            </button>
            <button onClick={handleBulkReject} className="px-3 py-1 bg-white text-red-600 border border-red-200 rounded-md hover:bg-red-50 flex items-center gap-1">
              <XCircle className="h-4 w-4" /> Từ chối
            </button>
            <button onClick={handleBulkDelete} className="px-3 py-1 bg-white text-red-600 border border-red-200 rounded-md hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto bg-white shadow-sm rounded-lg">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Đang tải...</div>
        ) : reviews.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Không có đánh giá nào</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left">
                  <input type="checkbox" className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    onChange={handleSelectAll}
                    checked={selectedIds.length > 0 && selectedIds.length === reviews.length} />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortHeader field="productId" label="Sản phẩm" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortHeader field="rating" label="Đánh giá" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nội dung</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Người dùng</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortHeader field="createdAt" label="Ngày đăng" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Hành động</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reviews.map(review => (
                <tr key={review._id} className="hover:bg-gray-50">
                  <td className="px-3 py-4">
                    <input type="checkbox" className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                      checked={selectedIds.includes(review._id)}
                      onChange={() => setSelectedIds(ids =>
                        ids.includes(review._id) ? ids.filter(i => i !== review._id) : [...ids, review._id]
                      )} />
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center">
                      <Package className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                        {typeof review.productId === 'object' ? review.productId.name : review.productId}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-4"><StarRating rating={review.rating} /></td>
                  <td className="px-3 py-4">
                    {review.title && <div className="text-sm font-medium text-gray-900">{review.title}</div>}
                    <div className="text-sm text-gray-500 truncate max-w-[220px]">{review.comment}</div>
                    {review.images?.length > 0 && (
                      <div className="text-xs text-indigo-600 mt-1">{review.images.length} ảnh</div>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-2 flex-shrink-0">
                        <span className="text-xs font-medium text-gray-500">
                          {typeof review.userId === 'object' ? review.userId.name.charAt(0) : '?'}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {typeof review.userId === 'object' ? review.userId.name : review.userId}
                        </div>
                        {review.isVerifiedPurchase && (
                          <div className="text-xs text-green-600">Đã xác thực</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-900 whitespace-nowrap">{formatDate(review.createdAt)}</td>
                  <td className="px-3 py-4">
                    <StatusBadge review={review} />
                    {review.adminResponse && (
                      <div className="mt-1 text-xs text-gray-600 flex items-center">
                        <MessageCircle className="h-3 w-3 mr-1" /> Đã phản hồi
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <button className="text-indigo-600 hover:text-indigo-900" title="Xem" onClick={() => handleOpenModal(review)}>
                        <Eye className="h-5 w-5" />
                      </button>
                      {!review.isApproved && !review.isRejected && (
                        <>
                          <button className="text-green-600 hover:text-green-900" title="Duyệt" onClick={() => handleApprove(review._id)}>
                            <CheckCircle className="h-5 w-5" />
                          </button>
                          <button className="text-red-600 hover:text-red-900" title="Từ chối" onClick={() => handleReject(review._id)}>
                            <XCircle className="h-5 w-5" />
                          </button>
                        </>
                      )}
                      <button className="text-red-600 hover:text-red-900" title="Xóa" onClick={() => handleDelete(review._id)}>
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
            {' '}— <span className="font-medium">{pagination.totalItems}</span> đánh giá
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setPage((p: number) => Math.max(1, p - 1))} disabled={page === 1}
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
            <button onClick={() => setPage((p: number) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
              className="px-3 py-2 border rounded-md text-sm disabled:opacity-50">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {modalReview && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setModalReview(null)} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Chi tiết đánh giá</h3>
                <StatusBadge review={modalReview} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-500">
                      {typeof modalReview.userId === 'object' ? modalReview.userId.name.charAt(0) : '?'}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium">{typeof modalReview.userId === 'object' ? modalReview.userId.name : modalReview.userId}</div>
                    {modalReview.isVerifiedPurchase && <div className="text-xs text-green-600">Mua hàng đã xác thực</div>}
                  </div>
                </div>
                <div className="text-sm text-gray-500">{formatDate(modalReview.createdAt)}</div>
              </div>

              <div>
                <StarRating rating={modalReview.rating} />
                {modalReview.title && <h4 className="font-medium mt-1">{modalReview.title}</h4>}
                <p className="text-sm text-gray-700 mt-1">{modalReview.comment}</p>
                {modalReview.images?.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {modalReview.images.map((img, i) => (
                      <img key={i} src={img} alt="" className="h-20 w-20 object-cover rounded-md bg-gray-100" />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Package className="h-4 w-4 text-gray-400" />
                <span>{typeof modalReview.productId === 'object' ? modalReview.productId.name : modalReview.productId}</span>
              </div>

              {modalReview.adminResponse && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm font-medium text-gray-700">Phản hồi cũ ({formatDate(modalReview.adminResponse.respondedAt)}):</p>
                  <p className="text-sm text-gray-600 mt-1">{modalReview.adminResponse.comment}</p>
                </div>
              )}

              {!modalReview.isApproved && !modalReview.isRejected && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lý do từ chối (nếu từ chối)</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-md p-2 text-sm mb-2"
                    placeholder="Lý do (tuỳ chọn)"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phản hồi của cửa hàng</label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                  placeholder="Nhập phản hồi..."
                  value={responseText}
                  onChange={e => setResponseText(e.target.value)}
                />
              </div>

              <div className="flex gap-2 justify-end flex-wrap">
                <button onClick={() => setModalReview(null)} className="px-4 py-2 border rounded-md text-sm text-gray-700 hover:bg-gray-50">
                  Đóng
                </button>
                {!modalReview.isApproved && !modalReview.isRejected && (
                  <>
                    <button
                      onClick={() => { handleReject(modalReview._id, rejectReason || undefined); setModalReview(null); }}
                      disabled={rejectMutation.isLoading}
                      className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
                    >
                      Từ chối
                    </button>
                    <button
                      onClick={handleSubmitResponse}
                      disabled={respondMutation.isLoading || approveMutation.isLoading}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {responseText.trim() ? 'Duyệt & phản hồi' : 'Chỉ duyệt'}
                    </button>
                  </>
                )}
                {modalReview.isApproved && responseText.trim() && (
                  <button
                    onClick={handleSubmitResponse}
                    disabled={respondMutation.isLoading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Cập nhật phản hồi
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewManagement;
