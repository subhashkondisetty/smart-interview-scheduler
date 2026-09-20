import React from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const PublicLayout = () => {
  const { isAuthenticated, isAdmin, user, logout } = useAuth();

  return (
    <div className="layout-container">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="navbar public-navbar">
        <div className="navbar-brand">
          <Link to="/" className="brand-link">
            <span className="brand-icon">⚡</span>
            <span className="brand-title">SmartPrep Scheduler</span>
          </Link>
        </div>

        <nav className="navbar-links" aria-label="Public Navigation">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            Home
          </NavLink>
          <NavLink to="/slots" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            Browse Slots
          </NavLink>
          <NavLink to="/assessments" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            Assessments
          </NavLink>
        </nav>

        <div className="navbar-actions">
          {isAuthenticated ? (
            <div className="user-session-bar">
              <span className="user-email">{user?.email}</span>
              <span className={`role-badge ${isAdmin ? 'role-admin' : 'role-candidate'}`}>
                {user?.role}
              </span>
              <Link
                to={isAdmin ? '/admin/dashboard' : '/candidate/dashboard'}
                className="btn btn-secondary btn-sm"
              >
                Dashboard
              </Link>
              <button type="button" onClick={logout} className="btn btn-outline btn-sm">
                Logout
              </button>
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="btn btn-outline btn-sm">
                Log In
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Register
              </Link>
            </div>
          )}
        </div>
      </header>

      <main id="main-content" tabIndex="-1" className="main-content">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer-content">
          <p>© {new Date().getFullYear()} Smart Interview Scheduler & Mock Assessment Platform</p>
          <p className="footer-subtext">Phase 6: Frontend Client Architecture</p>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
