import React from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const AdminLayout = () => {
  const { user, logout } = useAuth();

  return (
    <div className="layout-container admin-portal">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="navbar admin-navbar">
        <div className="navbar-brand">
          <Link to="/admin/dashboard" className="brand-link">
            <span className="brand-icon">🛡️</span>
            <span className="brand-title">Admin Console</span>
          </Link>
        </div>

        <nav className="navbar-links" aria-label="Admin Operations Navigation">
          <NavLink to="/admin/dashboard" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            Overview
          </NavLink>
          <NavLink to="/admin/candidates" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            Candidates
          </NavLink>
          <NavLink to="/admin/slots" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            Manage Slots
          </NavLink>
          <NavLink to="/admin/bookings" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            Manage Bookings
          </NavLink>
          <NavLink to="/admin/assessments" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            Assessments
          </NavLink>
          <NavLink to="/admin/questions" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            Questions
          </NavLink>
          <NavLink to="/admin/results" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            Results
          </NavLink>
          <NavLink to="/admin/broadcast" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            Broadcast
          </NavLink>
        </nav>

        <div className="navbar-actions">
          <span className="user-email">{user?.email}</span>
          <span className="role-badge role-admin">Admin</span>
          <button type="button" onClick={logout} className="btn btn-outline btn-sm">
            Logout
          </button>
        </div>
      </header>

      <main id="main-content" tabIndex="-1" className="main-content admin-content">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer-content">
          <p>© {new Date().getFullYear()} SmartPrep - Administrative Operations Console</p>
        </div>
      </footer>
    </div>
  );
};

export default AdminLayout;
