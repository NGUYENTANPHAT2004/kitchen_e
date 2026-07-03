import { api, endpoints } from '../../../config/api_cli.config';
import type { AppNotification, NotificationPagination, NotificationListParams } from '../interface/interface';

const notificationService = {
  // GET /notifications — returns { notifications, pagination } under data
  async getNotifications(params: NotificationListParams = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.isRead !== undefined) query.set('isRead', String(params.isRead));
    if (params.isDismissed !== undefined) query.set('isDismissed', String(params.isDismissed));
    if (params.type) query.set('type', params.type);
    const response = await api.get(`${endpoints.notifications.base}?${query.toString()}`);
    const data = response.data?.data ?? response.data;
    return {
      notifications: (data?.notifications ?? []) as AppNotification[],
      pagination: data?.pagination as NotificationPagination,
    };
  },
  // GET /notifications/:id — notification returned bare under data
  async getNotification(id: string) {
    const response = await api.get(endpoints.notifications.byId(id));
    return (response.data?.data ?? response.data) as AppNotification;
  },

  async markAsRead(id: string) {
    const response = await api.put(endpoints.notifications.read(id));
    return (response.data?.data ?? response.data) as AppNotification;
  },

  async dismiss(id: string) {
    const response = await api.put(endpoints.notifications.dismiss(id));
    return (response.data?.data ?? response.data) as AppNotification;
  },

  async deleteNotification(id: string) {
    const response = await api.delete(endpoints.notifications.byId(id));
    return response.data;
  },
};

export default notificationService;
