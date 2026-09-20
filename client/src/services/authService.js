import api from './api';

/**
 * Authentication service communicating with backend /api/auth endpoints
 */
export const authService = {
  /**
   * Log in user with credentials
   * @param {Object} credentials - { email, password }
   */
  async login({ email, password }) {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  /**
   * Register a new candidate user
   * @param {Object} userData - { email, password }
   */
  async register({ email, password }) {
    const response = await api.post('/auth/register', { email, password });
    return response.data;
  },

  /**
   * Log out authenticated user (invalidates token on server)
   */
  async logout() {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  /**
   * Get current authenticated user profile
   */
  async getCurrentUser() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  /**
   * Request password reset email
   * @param {Object} data - { email }
   */
  async forgotPassword({ email }) {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  /**
   * Reset password with valid token
   * @param {string} token - Reset token from URL
   * @param {Object} data - { password }
   */
  async resetPassword(token, { password }) {
    const response = await api.put(`/auth/reset-password/${token}`, { password });
    return response.data;
  },
};

export default authService;
