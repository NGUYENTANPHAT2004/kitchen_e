import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import notificationService from '../services/notificationService';
import type { NotificationListParams, NotificationType } from '../interface/interface';

export const useNotifications = (params: { type?: NotificationType; isRead?: boolean } = {}) => {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const query = useQuery(
    ['notifications', { ...params, page, limit }],
    () => notificationService.getNotifications({ ...params, page, limit } as NotificationListParams),
    { keepPreviousData: true }
  );

  return { ...query, page, setPage, limit };
};

export const useNotification = (id: string) =>
  useQuery(['notifications', id], () => notificationService.getNotification(id), { enabled: !!id });

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation((id: string) => notificationService.markAsRead(id), {
    onSuccess: () => qc.invalidateQueries(['notifications']),
  });
};

export const useDeleteNotification = () => {
  const qc = useQueryClient();
  return useMutation((id: string) => notificationService.deleteNotification(id), {
    onSuccess: () => qc.invalidateQueries(['notifications']),
  });
};
