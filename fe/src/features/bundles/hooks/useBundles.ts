import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import bundleService from '../services/bundleService';
import type { Bundle, BundleListParams } from '../interface/interface';

export const useBundles = (params: { search?: string; active?: boolean } = {}) => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const query = useQuery(
    ['bundles', { ...params, page, limit }],
    () => bundleService.getBundles({ ...params, page, limit } as BundleListParams),
    { keepPreviousData: true }
  );

  return { ...query, page, setPage, limit, setLimit };
};

export const useBundle = (id: string) =>
  useQuery(['bundles', id], () => bundleService.getBundle(id), { enabled: !!id });

export const useDeleteBundle = () => {
  const qc = useQueryClient();
  return useMutation((id: string) => bundleService.deleteBundle(id), {
    onSuccess: () => qc.invalidateQueries(['bundles']),
  });
};

export const useUpdateBundle = () => {
  const qc = useQueryClient();
  return useMutation(
    ({ id, data }: { id: string; data: Partial<Bundle> }) => bundleService.updateBundle(id, data),
    { onSuccess: () => qc.invalidateQueries(['bundles']) }
  );
};
