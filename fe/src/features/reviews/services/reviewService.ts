import { api } from '../../../config/api_cli.config';
import type { Review, ReviewFilters, ReviewPagination } from '../interface/interface';
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
    return response.data.data as { reviews: Review[]; pagination: ReviewPagination };
  },

  async getPendingReviews(filters: Pick<ReviewFilters, 'page' | 'limit'> = {}) {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    const response = await api.get(`/reviews/admin/pending?${params.toString()}`);
    return response.data.data as { reviews: Review[]; pagination: ReviewPagination };
  },

  async getReportedReviews(filters: Pick<ReviewFilters, 'page' | 'limit'> = {}) {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    const response = await api.get(`/reviews/admin/reported?${params.toString()}`);
    return response.data.data as { reviews: Review[]; pagination: ReviewPagination };
  },

  async approveReview(id: string) {
    const response = await api.put(`/reviews/${id}/approve`);
    return response.data.data as { review: Review };
  },

  async rejectReview(id: string, reason?: string) {
    const response = await api.put(`/reviews/${id}/reject`, { reason });
    return response.data.data as { review: Review };
  },

  async respondToReview(id: string, comment: string) {
    const response = await api.post(`/reviews/${id}/respond`, { comment });
    return response.data.data as { review: Review };
  },

  async deleteReview(id: string) {
    const response = await api.delete(`/reviews/${id}`);
    return response.data;
  },
};

export default reviewService;
