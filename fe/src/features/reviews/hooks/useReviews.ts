import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import reviewService from '../services/reviewService';
import type { ReviewFilters } from '../interface/interface';

export const useReviews = (filters: ReviewFilters = {}) => {
  const [page, setPage] = useState(filters.page ?? 1);
  const [limit] = useState(filters.limit ?? 20);

  const query = useQuery(
    ['reviews', { ...filters, page, limit }],
    () => reviewService.getReviews({ ...filters, page, limit }),
    { keepPreviousData: true }
  );

  return { ...query, page, setPage, limit };
};

export const usePendingReviews = (filters: { page?: number; limit?: number } = {}) => {
  const [page, setPage] = useState(filters.page ?? 1);
  return {
    ...useQuery(
      ['reviews', 'pending', page],
      () => reviewService.getPendingReviews({ page, limit: filters.limit ?? 20 }),
      { keepPreviousData: true }
    ),
    page,
    setPage,
  };
};

export const useReportedReviews = (filters: { page?: number; limit?: number } = {}) => {
  const [page, setPage] = useState(filters.page ?? 1);
  return {
    ...useQuery(
      ['reviews', 'reported', page],
      () => reviewService.getReportedReviews({ page, limit: filters.limit ?? 20 }),
      { keepPreviousData: true }
    ),
    page,
    setPage,
  };
};

export const useApproveReview = () => {
  const qc = useQueryClient();
  return useMutation((id: string) => reviewService.approveReview(id), {
    onSuccess: () => qc.invalidateQueries(['reviews']),
  });
};

export const useRejectReview = () => {
  const qc = useQueryClient();
  return useMutation(
    ({ id, reason }: { id: string; reason?: string }) => reviewService.rejectReview(id, reason),
    { onSuccess: () => qc.invalidateQueries(['reviews']) }
  );
};

export const useRespondToReview = () => {
  const qc = useQueryClient();
  return useMutation(
    ({ id, comment }: { id: string; comment: string }) => reviewService.respondToReview(id, comment),
    { onSuccess: () => qc.invalidateQueries(['reviews']) }
  );
};

export const useDeleteReview = () => {
  const qc = useQueryClient();
  return useMutation((id: string) => reviewService.deleteReview(id), {
    onSuccess: () => qc.invalidateQueries(['reviews']),
  });
};
