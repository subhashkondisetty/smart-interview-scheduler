import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import { SESSION_EXPIRED_EVENT } from '../services/api';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Restore current user session from stored token on mount/refresh
  const restoreUserSession = useCallback(async () => {
    const savedToken = localStorage.getItem('token');
    if (!savedToken) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }

    try {
      const response = await authService.getCurrentUser();
      if (response?.data?.user) {
        setUser(response.data.user);
        setToken(savedToken);
      } else {
        localStorage.removeItem('token');
        setUser(null);
        setToken(null);
      }
    } catch (err) {
      localStorage.removeItem('token');
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreUserSession();
  }, [restoreUserSession]);

  // Listen for the custom session-expired event dispatched by the axios 401 interceptor
  useEffect(() => {
    const handleSessionExpired = (event) => {
      setUser(null);
      setToken(null);
      setLoading(false);
      const message =
        event.detail?.message || 'Your session has expired. Please log in again.';
      navigate('/login', {
        replace: true,
        state: {
          sessionExpired: true,
          message,
        },
      });
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [navigate]);

  // Login handler
  const login = async (credentials) => {
    const response = await authService.login(credentials);
    const { token: receivedToken, user: receivedUser } = response.data;

    localStorage.setItem('token', receivedToken);
    setToken(receivedToken);
    setUser(receivedUser);

    return response;
  };

  // Register handler
  const register = async (userData) => {
    const response = await authService.register(userData);
    const { token: receivedToken, user: receivedUser } = response.data;

    localStorage.setItem('token', receivedToken);
    setToken(receivedToken);
    setUser(receivedUser);

    return response;
  };

  // Logout handler
  const logout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      // Proceed with client cleanup even if server call errors out
    } finally {
      localStorage.removeItem('token');
      setUser(null);
      setToken(null);
      navigate('/login', { replace: true });
    }
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(user && token),
    isAdmin: user?.role === 'admin',
    isCandidate: user?.role === 'candidate',
    login,
    register,
    logout,
    restoreUserSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
