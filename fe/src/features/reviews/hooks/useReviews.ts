import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import reviewService from '../services/reviewService';
import type { ReviewFilters } from '../interface/interface';

export const useReviews = (filters: ReviewFilters = {}, enabled = true) => {
  const [page, setPage] = useState(filters.page ?? 1);
  const [limit] = useState(filters.limit ?? 20);

  const query = useQuery(
    ['reviews', { ...filters, page, limit }],
    () => reviewService.getReviews({ ...filters, page, limit }),
    { keepPreviousData: true, retry: false, enabled }
  );

  return { ...query, page, setPage, limit };
};

export const usePendingReviews = (filters: { page?: number; limit?: number } = {}, enabled = true) => {
  const [page, setPage] = useState(filters.page ?? 1);
  const limit = filters.limit ?? 20;
  return {
    ...useQuery(
      ['reviews', 'pending', page, limit],
      () => reviewService.getPendingReviews({ page, limit }),
      { keepPreviousData: true, retry: false, enabled }
    ),
    page,
    setPage,
  };
};

export const useReportedReviews = (filters: { page?: number; limit?: number } = {}, enabled = true) => {
  const [page, setPage] = useState(filters.page ?? 1);
  const limit = filters.limit ?? 20;
  return {
    ...useQuery(
      ['reviews', 'reported', page, limit],
      () => reviewService.getReportedReviews({ page, limit }),
      { keepPreviousData: true, retry: false, enabled }
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
    ({ id, comment, approve }: { id: string; comment: string; approve?: boolean }) => reviewService.respondToReview(id, comment, approve),
    { onSuccess: () => qc.invalidateQueries(['reviews']) }
  );
};

export const useDeleteReview = () => {
  const qc = useQueryClient();
  return useMutation((id: string) => reviewService.deleteReview(id), {
    onSuccess: () => qc.invalidateQueries(['reviews']),
  });
};
