import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import flashSaleService from '../services/flashSaleService';
import type { FlashSale, FlashSaleFormData, FlashSaleItemFormData } from '../interface/interface';


export const useFlashSales = (params: { status?: string; search?: string } = {}) => {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const query = useQuery(
    ['flash-sales', { ...params, page, limit }],
    () => flashSaleService.getFlashSales({ ...params, page, limit }),
    { keepPreviousData: true }
  );

  return { ...query, page, setPage, limit };
};

export const useFlashSale = (id: string) =>
  useQuery(['flash-sales', id], () => flashSaleService.getFlashSale(id), { enabled: !!id });

export const useCreateFlashSale = () => {
  const qc = useQueryClient();
  return useMutation((data: FlashSaleFormData) => flashSaleService.createFlashSale(data), {
    onSuccess: () => qc.invalidateQueries(['flash-sales']),
  });
};

export const useUpdateFlashSale = () => {
  const qc = useQueryClient();
  return useMutation(
    ({ id, data }: { id: string; data: Partial<FlashSaleFormData> }) =>
      flashSaleService.updateFlashSale(id, data),
    { onSuccess: () => qc.invalidateQueries(['flash-sales']) }
  );
};

export const useDeleteFlashSale = () => {
  const qc = useQueryClient();
  return useMutation((id: string) => flashSaleService.deleteFlashSale(id), {
    onSuccess: () => qc.invalidateQueries(['flash-sales']),
  });
};

export const useUpdateFlashSaleStatus = () => {
  const qc = useQueryClient();
  return useMutation(
    ({ id, status }: { id: string; status: FlashSale['status'] }) =>
      flashSaleService.updateStatus(id, status),
    { onSuccess: () => qc.invalidateQueries(['flash-sales']) }
  );
};

export const useAddFlashSaleItem = () => {
  const qc = useQueryClient();
  return useMutation(
    ({ flashSaleId, item }: { flashSaleId: string; item: FlashSaleItemFormData }) =>
      flashSaleService.addItem(flashSaleId, item),
    { onSuccess: () => qc.invalidateQueries(['flash-sales']) }
  );
};

export const useRemoveFlashSaleItem = () => {
  const qc = useQueryClient();
  return useMutation((itemId: string) => flashSaleService.removeItem(itemId), {
    onSuccess: () => qc.invalidateQueries(['flash-sales']),
  });
};
