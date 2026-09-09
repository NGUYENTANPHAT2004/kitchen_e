import { api } from '../../../config/api_cli.config';
import type { Review, ReviewFilters, ReviewPagination, ReviewPayload } from '../interface/interface';

function normalizeReview(review: ReviewPayload): Review {
  const user = review.userId && typeof review.userId === 'object' ? review.userId : null;
  const product = review.productId && typeof review.productId === 'object' ? review.productId : null;
  const name = user?.name?.trim()
    || [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
    || user?.fullName?.trim()
    || user?.username?.trim()
    || 'Khách hàng';

  return {
    ...review,
    userId: { _id: user?._id ?? (typeof review.userId === 'string' ? review.userId : ''), name, avatar: user?.avatar },
    productId: {
      _id: product?._id ?? (typeof review.productId === 'string' ? review.productId : ''),
      name: product?.name?.trim() || 'Sản phẩm không còn khả dụng',
      images: product?.images,
    },
    images: (review.images ?? [])
      .map(image => typeof image === 'string' ? image : image?.url)
      .filter((url): url is string => typeof url === 'string' && url.trim().length > 0),
    adminResponse: review.adminResponse?.comment?.trim() ? {
      comment: review.adminResponse.comment,
      respondedAt: review.adminResponse.createdAt || review.adminResponse.respondedAt || '',
    } : undefined,
  };
}

function normalizeList(data: {
  reviews: ReviewPayload[];
  pagination: Partial<ReviewPagination> & { totalDocs?: number };
}) {
  return {
    reviews: data.reviews.map(normalizeReview),
    pagination: {
      currentPage: data.pagination.currentPage ?? 1,
      totalPages: data.pagination.totalPages ?? 1,
      totalItems: data.pagination.totalItems ?? data.pagination.totalDocs ?? 0,
      limit: data.pagination.limit ?? 20,
    } satisfies ReviewPagination,
  };
}

const reviewService = {
  async getReviews(filters: ReviewFilters = {}) {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.rating) params.set('rating', String(filters.rating));
    if (filters.search) params.set('search', filters.search);
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.productId) params.set('productId', filters.productId);

    const response = await api.get(`/reviews?${params.toString()}`);
    return normalizeList(response.data.data);
  },

  async getPendingReviews(filters: Pick<ReviewFilters, 'page' | 'limit'> = {}) {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    const response = await api.get(`/reviews/admin/pending?${params.toString()}`);
    return normalizeList(response.data.data);
  },

  async getReportedReviews(filters: Pick<ReviewFilters, 'page' | 'limit'> = {}) {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    const response = await api.get(`/reviews/admin/reported?${params.toString()}`);
    return normalizeList(response.data.data);
  },

  async approveReview(id: string) {
    const response = await api.put(`/reviews/${id}/approve`);
    return normalizeReview(response.data.data);
  },

  async rejectReview(id: string, reason?: string) {
    const response = await api.put(`/reviews/${id}/reject`, { reason });
    return normalizeReview(response.data.data);
  },

  async respondToReview(id: string, comment: string, approve = false) {
    const response = await api.post(`/reviews/${id}/respond`, { comment, approve });
    return normalizeReview(response.data.data);
  },

  async deleteReview(id: string) {
    const response = await api.delete(`/reviews/${id}`);
    return response.data;
  },
};

export default reviewService;
