export interface Review {
  _id: string;
  userId: { _id: string; name: string; avatar?: string };
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

// API relations can be unpopulated or null after a related record is removed.
export type ReviewPayload = Omit<Review, 'userId' | 'productId' | 'images' | 'adminResponse'> & {
  userId: {
    _id: string;
    name?: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    avatar?: string;
  } | string | null;
  productId: { _id: string; name?: string; images?: Array<{ url: string }> } | string | null;
  images?: Array<string | { url?: string; caption?: string } | null>;
  adminResponse?: { comment?: string; createdAt?: string; respondedAt?: string } | null;
};

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
