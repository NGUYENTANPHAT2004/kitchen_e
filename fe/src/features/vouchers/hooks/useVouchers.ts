import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import voucherService from '../services/voucherService';
import type { VoucherFormData } from '../interface/interface';

export const useVouchers = (params: { search?: string; isActive?: boolean; discountType?: string } = {}) => {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const query = useQuery(
    ['vouchers', { ...params, page, limit }],
    () => voucherService.getVouchers({ ...params, page, limit }),
    { keepPreviousData: true }
  );

  return { ...query, page, setPage, limit };
};

export const useVoucher = (id: string) =>
  useQuery(['vouchers', id], () => voucherService.getVoucher(id), { enabled: !!id });

export const useCreateVoucher = () => {
  const qc = useQueryClient();
  return useMutation((data: VoucherFormData) => voucherService.createVoucher(data), {
    onSuccess: () => qc.invalidateQueries(['vouchers']),
  });
};

export const useUpdateVoucher = () => {
  const qc = useQueryClient();
  return useMutation(
    ({ id, data }: { id: string; data: Partial<VoucherFormData> }) =>
      voucherService.updateVoucher(id, data),
    { onSuccess: () => qc.invalidateQueries(['vouchers']) }
  );
};

export const useDeleteVoucher = () => {
  const qc = useQueryClient();
  return useMutation((id: string) => voucherService.deleteVoucher(id), {
    onSuccess: () => qc.invalidateQueries(['vouchers']),
  });
};

export const useAssignVoucher = () => {
  const qc = useQueryClient();
  return useMutation(
    ({ id, userId }: { id: string; userId: string }) => voucherService.assignToUser(id, userId),
    { onSuccess: () => qc.invalidateQueries(['vouchers']) }
  );
};
