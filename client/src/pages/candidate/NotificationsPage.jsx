import React, { useState, useEffect, useCallback } from 'react';
import notificationService from '../../services/notificationService';
import { useToast } from '../../context/ToastContext';

const NOTIFICATION_CONFIG = {
  booking_confirmed: {
    icon: '📅',
    label: 'Interview Confirmed',
    badgeClass: 'badge-success',
  },
  booking_cancelled: {
    icon: '✕',
    label: 'Interview Cancelled',
    badgeClass: 'badge-danger',
  },
  booking_rescheduled: {
    icon: '🔄',
    label: 'Interview Rescheduled',
    badgeClass: 'badge-warning',
  },
  assessment_completed: {
    icon: '📝',
    label: 'Assessment Completed',
    badgeClass: 'badge-info',
  },
  assessment_expired: {
    icon: '⏳',
    label: 'Assessment Expired',
    badgeClass: 'badge-warning',
  },
  admin_broadcast: {
    icon: '📢',
    label: 'Announcement',
    badgeClass: 'badge-primary',
  },
  system: {
    icon: '⚙️',
    label: 'System Notice',
    badgeClass: 'badge-neutral',
  },
};

const getNotificationDetails = (type) => {
  return (
    NOTIFICATION_CONFIG[type] || {
      icon: '🔔',
      label: 'Notification',
      badgeClass: 'badge-neutral',
    }
  );
};

const formatTimeAgo = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffSecs = Math.floor((now - date) / 1000);

  if (diffSecs < 60) return 'Just now';
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
  if (diffSecs < 172800) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

const NotificationsPage = () => {
  const toast = useToast();

  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread' | 'read'
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError(null);

        const params = { page, limit: 10 };
        if (activeFilter === 'unread') params.isRead = false;
        if (activeFilter === 'read') params.isRead = true;

        const data = await notificationService.getUserNotifications(params);
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount ?? 0);
        setPagination(data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
      } catch (err) {
        console.error('Failed to load notifications:', err);
        setError('Unable to load your notifications. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [activeFilter]
  );

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  // Mark single notification as read
  const handleMarkAsRead = async (id) => {
    try {
      await notificationService.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((item) => (item._id === id ? { ...item, isRead: true } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      toast.success('Notification marked as read');
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      toast.error('Could not mark notification as read.');
    }
  };

  // Mark all unread notifications as read
  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    try {
      setMarkingAll(true);
      const res = await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
      const modifiedCount = res.data?.modifiedCount ?? res.modifiedCount ?? 0;
      toast.success(
        modifiedCount > 0
          ? `Marked ${modifiedCount} notifications as read`
          : 'All notifications marked as read'
      );
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      toast.error('Could not mark all notifications as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="page-container notifications-page" data-testid="notifications-page">
      {/* Page Header */}
      <div className="page-header notifications-header">
        <div>
          <div className="header-title-row">
            <h1 className="page-title">Notifications</h1>
            {unreadCount > 0 && (
              <span className="badge badge-primary unread-counter-badge" data-testid="unread-count-badge">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="page-subtitle">
            Stay updated with your interview schedule changes, assessment results, and system announcements.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleMarkAllAsRead}
            disabled={markingAll || unreadCount === 0}
            data-testid="btn-mark-all-read"
          >
            {markingAll ? 'Marking all read...' : '✓ Mark All as Read'}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="notification-filters-bar">
        <button
          type="button"
          className={`filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveFilter('all')}
          data-testid="filter-all"
        >
          All
        </button>
        <button
          type="button"
          className={`filter-pill ${activeFilter === 'unread' ? 'active' : ''}`}
          onClick={() => setActiveFilter('unread')}
          data-testid="filter-unread"
        >
          Unread {unreadCount > 0 && `(${unreadCount})`}
        </button>
        <button
          type="button"
          className={`filter-pill ${activeFilter === 'read' ? 'active' : ''}`}
          onClick={() => setActiveFilter('read')}
          data-testid="filter-read"
        >
          Read
        </button>
      </div>

      {/* Content State */}
      {loading ? (
        <div className="notifications-loading" data-testid="notifications-loading">
          <div className="spinner"></div>
          <p>Loading notifications...</p>
        </div>
      ) : error ? (
        <div className="error-card">
          <h3>Failed to Load Notifications</h3>
          <p>{error}</p>
          <button onClick={() => fetchNotifications(pagination.page)} className="btn btn-primary">
            Retry
          </button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="empty-state-card notifications-empty">
          <span className="empty-icon">🔔</span>
          <h3>No notifications found</h3>
          <p>
            {activeFilter === 'unread'
              ? "You're all caught up! No unread notifications."
              : activeFilter === 'read'
              ? 'No read notifications in your history.'
              : 'You do not have any notifications yet.'}
          </p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((n) => {
            const config = getNotificationDetails(n.type);
            const isUnread = !n.isRead;

            return (
              <div
                key={n._id}
                className={`notification-card ${isUnread ? 'notification-unread' : 'notification-read'}`}
                data-testid="notification-item"
              >
                <div className="notification-icon-col">
                  <span className="notification-type-icon">{config.icon}</span>
                </div>

                <div className="notification-body">
                  <div className="notification-meta">
                    <span
                      className={`badge ${config.badgeClass} notification-type-badge`}
                      data-testid="notification-type-badge"
                    >
                      {config.label}
                    </span>
                    <span className="notification-time">{formatTimeAgo(n.createdAt)}</span>
                    {isUnread && <span className="unread-dot" data-testid="unread-dot" title="Unread" />}
                  </div>

                  <p className="notification-message" data-testid="notification-message">
                    {n.message}
                  </p>
                </div>

                {isUnread && (
                  <div className="notification-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline btn-mark-read"
                      onClick={() => handleMarkAsRead(n._id)}
                      data-testid={`btn-mark-read-${n._id}`}
                      title="Mark as read"
                    >
                      ✓ Mark read
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {pagination.totalPages > 1 && (
        <div className="pagination-bar">
          <button
            type="button"
            className="btn btn-sm btn-outline"
            disabled={!pagination.hasPrev || loading}
            onClick={() => fetchNotifications(pagination.page - 1)}
            data-testid="pagination-prev"
          >
            ← Previous
          </button>
          <span className="pagination-info">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            disabled={!pagination.hasNext || loading}
            onClick={() => fetchNotifications(pagination.page + 1)}
            data-testid="pagination-next"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
