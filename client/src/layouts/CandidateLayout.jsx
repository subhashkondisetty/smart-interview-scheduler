import React, { useState, useEffect } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import notificationService from '../services/notificationService';

const CandidateLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchUnread = async () => {
      try {
        const data = await notificationService.getUserNotifications({ limit: 1 });
        if (isMounted && typeof data?.unreadCount === 'number') {
          setUnreadCount(data.unreadCount);
        }
      } catch {
        // Silently ignore in layout if unauthenticated or error
      }
    };
    fetchUnread();
    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  return (
    <div className="layout-container candidate-portal">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="navbar candidate-navbar">
        <div className="navbar-brand">
          <Link to="/candidate/dashboard" className="brand-link">
            <span className="brand-icon">🎓</span>
            <span className="brand-title">Candidate Portal</span>
          </Link>
        </div>

        <nav className="navbar-links" aria-label="Candidate Portal Navigation">
          <NavLink to="/candidate/dashboard" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            Dashboard
          </NavLink>
          <NavLink to="/candidate/profile" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            Profile & Resume
          </NavLink>
          <NavLink to="/candidate/slots" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            Book Interview
          </NavLink>
          <NavLink to="/candidate/bookings" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            My Interviews
          </NavLink>
          <NavLink to="/candidate/assessments" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            Assessments
          </NavLink>
          <NavLink to="/candidate/history" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            Analytics
          </NavLink>
          <NavLink to="/candidate/notifications" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            Notifications
            {unreadCount > 0 && (
              <span className="nav-unread-badge" data-testid="nav-unread-badge">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </NavLink>
        </nav>

        <div className="navbar-actions">
          <span className="user-email">{user?.email}</span>
          <span className="role-badge role-candidate">Candidate</span>
          <button type="button" onClick={logout} className="btn btn-outline btn-sm">
            Logout
          </button>
        </div>
      </header>

      <main id="main-content" tabIndex="-1" className="main-content candidate-content">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer-content">
          <p>© {new Date().getFullYear()} SmartPrep - Candidate Dashboard</p>
        </div>
      </footer>
    </div>
  );
};

export default CandidateLayout;
