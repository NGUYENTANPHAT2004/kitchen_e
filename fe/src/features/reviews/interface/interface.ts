export interface Review {
  _id: string;
  userId: { _id: string; name: string; email: string; avatar?: string };
  productId: { _id: string; name: string; images?: Array<{ url: string }> };
  orderId?: string;
  title?: string;
  comment: string;
  rating: number;
  images: string[];
  likes: number;
  isVerifiedPurchase: boolean;
  isApproved: boolean;
  isRejected: boolean;
  rejectionReason?: string;
  isDeleted: boolean;
  reportCount: number;
  adminResponse?: { comment: string; respondedAt: string };
  createdAt: string;
  updatedAt: string;
}

export interface ReviewFilters {
  page?: number;
  limit?: number;
  status?: 'pending' | 'approved' | 'rejected' | 'reported' | 'all';
  rating?: number;
  search?: string;
  sort?: string;
  productId?: string;
}

export interface ReviewPagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  limit: number;
}
