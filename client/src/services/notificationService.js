import api from './api';

/**
 * Fetch authenticated user's notifications (paginated)
 *
 * @param {Object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=10]
 * @param {boolean|string} [params.isRead]
 * @returns {Promise<{ notifications: Array, pagination: Object, unreadCount: number }>}
 */
export const getUserNotifications = async (params = {}) => {
  const response = await api.get('/notifications', { params });
  return response.data?.data || { notifications: [], pagination: {}, unreadCount: 0 };
};

/**
 * Mark a single notification as read
 *
 * @param {string} id - Notification ID
 * @returns {Promise<Object>}
 */
export const markNotificationAsRead = async (id) => {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data?.data?.notification;
};

/**
 * Mark all unread notifications as read
 *
 * @returns {Promise<{ modifiedCount: number }>}
 */
export const markAllAsRead = async () => {
  const response = await api.patch('/notifications/read-all');
  return response.data?.data || { modifiedCount: 0 };
};

export default {
  getUserNotifications,
  markNotificationAsRead,
  markAllAsRead,
};
