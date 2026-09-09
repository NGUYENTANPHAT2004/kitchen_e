import React, { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
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
import RequestState from '../../../components/shared/RequestState';
import { urlUtils } from '../../../config/api_cli.config';

type TabType = 'all' | 'pending' | 'reported';

const StarRating: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex" role="img" aria-label={`${rating} trên 5 sao`}>
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

const formatDate = (d: string) => {
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

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
  const [actionError, setActionError] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const allQuery = useReviews({
    search: searchTerm || undefined,
    rating: filterRating || undefined,
    sort: `${sortDir === 'desc' ? '-' : ''}${sortField}`,
  }, tab === 'all');
  const pendingQuery = usePendingReviews({}, tab === 'pending');
  const reportedQuery = useReportedReviews({}, tab === 'reported');

  const activeQuery = tab === 'pending' ? pendingQuery : tab === 'reported' ? reportedQuery : allQuery;
  const { data, isLoading, isError, isFetching, page, setPage, refetch } = activeQuery;

  const reviews: Review[] = data?.reviews ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages;

  useEffect(() => {
    if (!isFetching && !isError && totalPages !== undefined && page > Math.max(1, totalPages)) {
      setPage(Math.max(1, totalPages));
      setSelectedIds([]);
    }
  }, [isFetching, isError, totalPages, page, setPage]);

  const approveMutation = useApproveReview();
  const rejectMutation = useRejectReview();
  const respondMutation = useRespondToReview();
  const deleteMutation = useDeleteReview();
  const isMutating = bulkBusy || approveMutation.isLoading || rejectMutation.isLoading || respondMutation.isLoading || deleteMutation.isLoading;

  const showActionError = (error: unknown) => {
    const message = isAxiosError(error) ? error.response?.data?.message || error.response?.data?.error?.message : null;
    setActionError(message || 'Không thể lưu thay đổi. Vui lòng thử lại.');
  };

  const resetFiltersPage = () => {
    allQuery.setPage(1);
    setSelectedIds([]);
  };

  const changePage = (nextPage: number) => {
    setPage(nextPage);
    setSelectedIds([]);
  };

  const handleSort = (field: string) => {
    if (field === sortField) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    resetFiltersPage();
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedIds(e.target.checked ? reviews.map(r => r._id) : []);
  };

  const handleOpenModal = (review: Review) => {
    setModalReview(review);
    setResponseText(review.adminResponse?.comment ?? '');
    setRejectReason('');
    setActionError(null);
  };

  const handleApprove = (id: string) => {
    setActionError(null);
    approveMutation.mutate(id, { onError: showActionError });
  };
  const handleReject = (id: string, reason?: string, closeOnSuccess = false) => {
    setActionError(null);
    rejectMutation.mutate({ id, reason }, {
      onError: showActionError,
      onSuccess: () => { if (closeOnSuccess) setModalReview(null); },
    });
  };
  const handleDelete = (id: string) => {
    if (window.confirm('Xóa đánh giá này?')) {
      setActionError(null);
      deleteMutation.mutate(id, { onError: showActionError });
    }
  };

  const handleSubmitResponse = () => {
    if (!modalReview) return;
    setActionError(null);
    if (responseText.trim()) {
      respondMutation.mutate({ id: modalReview._id, comment: responseText.trim(), approve: !modalReview.isApproved && !modalReview.isRejected }, {
        onSuccess: () => setModalReview(null),
        onError: showActionError,
      });
    } else {
      approveMutation.mutate(modalReview._id, { onSuccess: () => setModalReview(null), onError: showActionError });
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject' | 'delete') => {
    const selected = reviews.filter(review => selectedIds.includes(review._id)
      && (action !== 'approve' || !review.isApproved)
      && (action !== 'reject' || !review.isRejected));
    if (action === 'delete' && !window.confirm(`Xóa ${selected.length} đánh giá?`)) return;
    setBulkBusy(true);
    setActionError(null);
    const results = await Promise.allSettled(selected.map(review => {
      if (action === 'approve') return approveMutation.mutateAsync(review._id);
      if (action === 'reject') return rejectMutation.mutateAsync({ id: review._id });
      return deleteMutation.mutateAsync(review._id);
    }));
    const failedIds = selected.filter((_, index) => results[index].status === 'rejected').map(review => review._id);
    setSelectedIds(failedIds);
    if (failedIds.length) setActionError(`Không thể xử lý ${failedIds.length} đánh giá. Các mục lỗi vẫn được chọn để bạn thử lại.`);
    setBulkBusy(false);
  };

  const SortHeader: React.FC<{ field: string; label: string }> = ({ field, label }) => (
    <button type="button" className="flex items-center text-left" onClick={() => handleSort(field)} disabled={tab !== 'all' || isMutating} aria-label={`Sắp xếp theo ${label.toLowerCase()}`}>
      {label}
      {sortField === field && tab === 'all' && (
        <ArrowUpDown className={`ml-1 h-4 w-4 text-indigo-600 ${sortDir === 'desc' ? 'transform rotate-180' : ''}`} />
      )}
    </button>
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
        <nav className="-mb-px flex space-x-6" aria-label="Nhóm đánh giá">
          {([['all', 'Tất cả'], ['pending', 'Chờ duyệt'], ['reported', 'Báo cáo']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setSelectedIds([]); setActionError(null); }}
              aria-current={tab === key ? 'page' : undefined}
              disabled={isMutating}
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
                aria-label="Tìm đánh giá"
                disabled={isMutating}
                placeholder="Tìm kiếm theo sản phẩm, nội dung..."
                className="pl-10 w-full py-2 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); resetFiltersPage(); }}
              />
            </div>
            <div className="relative">
              <select
                aria-label="Số sao đánh giá"
                disabled={isMutating}
                style={{ minWidth: 160, paddingRight: 40 }}
                className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[140px]"
                value={filterRating}
                onChange={e => { setFilterRating(e.target.value === '' ? '' : Number(e.target.value)); resetFiltersPage(); }}
              >
                <option value="">Tất cả sao</option>
                {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} sao</option>)}
              </select>
              <Filter className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
            <button disabled={isMutating} onClick={() => { setSearchTerm(''); setFilterRating(''); resetFiltersPage(); }} className="px-4 py-2 text-sm text-gray-600 hover:text-indigo-600">
              Xóa bộ lọc
            </button>
          </div>
        </div>
      )}

      {actionError && !modalReview && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{actionError}</div>}

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-50 p-4 rounded-md flex flex-wrap gap-3 items-center justify-between">
          <span className="text-indigo-700 font-medium">{selectedIds.length} đã chọn</span>
          <div className="flex gap-2">
            <button disabled={isMutating || isFetching} onClick={() => handleBulkAction('approve')} className="px-3 py-1 bg-white text-green-600 border border-green-200 rounded-md hover:bg-green-50 flex items-center gap-1 disabled:opacity-50">
              <CheckCircle className="h-4 w-4" /> Duyệt
            </button>
            <button disabled={isMutating || isFetching} onClick={() => handleBulkAction('reject')} className="px-3 py-1 bg-white text-red-600 border border-red-200 rounded-md hover:bg-red-50 flex items-center gap-1 disabled:opacity-50">
              <XCircle className="h-4 w-4" /> Từ chối
            </button>
            <button aria-label="Xóa các đánh giá đã chọn" disabled={isMutating || isFetching} onClick={() => handleBulkAction('delete')} className="px-3 py-1 bg-white text-red-600 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto bg-white shadow-sm rounded-lg">
        {isLoading || isError || reviews.length === 0 ? (
          <RequestState loading={isLoading} error={isError} retry={() => refetch()} empty="Không có đánh giá nào" />
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left">
                  <input type="checkbox" className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    aria-label="Chọn tất cả đánh giá trên trang"
                    disabled={isMutating || isFetching}
                    onChange={handleSelectAll}
                    checked={reviews.length > 0 && reviews.every(review => selectedIds.includes(review._id))} />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Sản phẩm
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
                      aria-label={`Chọn đánh giá của ${review.userId.name}`}
                      disabled={isMutating || isFetching}
                      checked={selectedIds.includes(review._id)}
                      onChange={() => setSelectedIds(ids =>
                        ids.includes(review._id) ? ids.filter(i => i !== review._id) : [...ids, review._id]
                      )} />
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center">
                      <Package className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                        {review.productId.name}
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
                          {review.userId.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {review.userId.name}
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
                      <button disabled={isMutating || isFetching} className="text-indigo-600 hover:text-indigo-900" title="Xem" aria-label="Xem chi tiết đánh giá" onClick={() => handleOpenModal(review)}>
                        <Eye className="h-5 w-5" />
                      </button>
                      {!review.isApproved && !review.isRejected && (
                        <>
                          <button disabled={isMutating || isFetching} className="text-green-600 hover:text-green-900" title="Duyệt" aria-label="Duyệt đánh giá" onClick={() => handleApprove(review._id)}>
                            <CheckCircle className="h-5 w-5" />
                          </button>
                          <button disabled={isMutating || isFetching} className="text-red-600 hover:text-red-900" title="Từ chối" aria-label="Từ chối đánh giá" onClick={() => handleReject(review._id)}>
                            <XCircle className="h-5 w-5" />
                          </button>
                        </>
                      )}
                      <button disabled={isMutating || isFetching} className="text-red-600 hover:text-red-900" title="Xóa" aria-label="Xóa đánh giá" onClick={() => handleDelete(review._id)}>
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
      {!isError && pagination && pagination.totalItems > 0 && (
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="text-sm text-gray-700">
            Trang <span className="font-medium">{page}</span> / <span className="font-medium">{pagination.totalPages}</span>
            {' '}— <span className="font-medium">{pagination.totalItems}</span> đánh giá
          </div>
          <div className="flex items-center space-x-2">
            <button aria-label="Trang trước" onClick={() => changePage(Math.max(1, page - 1))} disabled={page === 1 || isFetching || isMutating}
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
                <button key={n} onClick={() => changePage(n)} disabled={isFetching || isMutating} aria-label={`Trang ${n}`} aria-current={page === n ? 'page' : undefined}
                  className={`px-3 py-2 border rounded-md text-sm ${page === n ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
                  {n}
                </button>
              );
            })}
            <button aria-label="Trang sau" onClick={() => changePage(Math.min(pagination.totalPages, page + 1))} disabled={page >= pagination.totalPages || isFetching || isMutating}
              className="px-3 py-2 border rounded-md text-sm disabled:opacity-50">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {modalReview && (
        <div className="fixed z-50 inset-0 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="review-detail-title" onKeyDown={event => { if (event.key === 'Escape' && !isMutating) setModalReview(null); }}>
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => { if (!isMutating) setModalReview(null); }} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 id="review-detail-title" className="text-lg font-medium text-gray-900">Chi tiết đánh giá</h3>
                <StatusBadge review={modalReview} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-500">
                      {modalReview.userId.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium">{modalReview.userId.name}</div>
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
                      <img key={i} src={urlUtils.getFullImageUrl(img) || urlUtils.getFallbackImageUrl()} alt={`Ảnh đánh giá ${i + 1}`} className="h-20 w-20 object-cover rounded-md bg-gray-100" />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Package className="h-4 w-4 text-gray-400" />
                <span>{modalReview.productId.name}</span>
              </div>

              {modalReview.adminResponse && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm font-medium text-gray-700">Phản hồi cũ ({formatDate(modalReview.adminResponse.respondedAt)}):</p>
                  <p className="text-sm text-gray-600 mt-1">{modalReview.adminResponse.comment}</p>
                </div>
              )}

              {modalReview.isRejected && modalReview.rejectionReason && (
                <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">Lý do từ chối: {modalReview.rejectionReason}</p>
              )}

              {!modalReview.isApproved && !modalReview.isRejected && (
                <div>
                  <label htmlFor="review-reject-reason" className="block text-sm font-medium text-gray-700 mb-1">Lý do từ chối (nếu từ chối)</label>
                  <input
                    id="review-reject-reason"
                    disabled={isMutating}
                    type="text"
                    className="w-full border border-gray-300 rounded-md p-2 text-sm mb-2"
                    placeholder="Lý do (tuỳ chọn)"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                  />
                </div>
              )}

              {!modalReview.isRejected && <div>
                <label htmlFor="review-response" className="block text-sm font-medium text-gray-700 mb-1">Phản hồi của cửa hàng</label>
                <textarea
                  id="review-response"
                  disabled={isMutating}
                  rows={3}
                  maxLength={1000}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                  placeholder="Nhập phản hồi..."
                  value={responseText}
                  onChange={e => setResponseText(e.target.value)}
                />
              </div>}

              {actionError && <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{actionError}</div>}

              <div className="flex gap-2 justify-end flex-wrap">
                <button autoFocus disabled={isMutating} onClick={() => setModalReview(null)} className="px-4 py-2 border rounded-md text-sm text-gray-700 hover:bg-gray-50">
                  Đóng
                </button>
                {!modalReview.isApproved && !modalReview.isRejected && (
                  <>
                    <button
                      onClick={() => handleReject(modalReview._id, rejectReason.trim() || undefined, true)}
                      disabled={isMutating}
                      className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
                    >
                      Từ chối
                    </button>
                    <button
                      onClick={handleSubmitResponse}
                      disabled={isMutating}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {responseText.trim() ? 'Duyệt & phản hồi' : 'Chỉ duyệt'}
                    </button>
                  </>
                )}
                {modalReview.isApproved && responseText.trim() && (
                  <button
                    onClick={handleSubmitResponse}
                    disabled={isMutating}
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
