import api from './api';

/**
 * Candidate Profile and Resume Service
 */
export const candidateProfileService = {
  /**
   * Fetch authenticated candidate's profile
   * @returns {Promise<Object>} Profile payload
   */
  async getProfile() {
    const response = await api.get('/candidate/profile');
    return response.data;
  },

  /**
   * Update candidate's profile details
   * @param {Object} profileData - Profile fields to update
   * @returns {Promise<Object>} Updated profile payload with authoritative completion score
   */
  async updateProfile(profileData) {
    const response = await api.put('/candidate/profile', profileData);
    return response.data;
  },

  /**
   * Upload or replace resume file with progress tracking
   * @param {File} file - File to upload
   * @param {Function} [onProgress] - Optional callback receiving progress percentage (0-100)
   * @returns {Promise<Object>} Upload response with updated resume and authoritative completion percentage
   */
  async uploadResume(file, onProgress) {
    const formData = new FormData();
    formData.append('resume', file);

    const response = await api.post('/candidate/profile/resume', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });

    return response.data;
  },

  /**
   * Delete authenticated candidate's resume
   * @returns {Promise<Object>} Deletion response with authoritative completion percentage
   */
  async deleteResume() {
    const response = await api.delete('/candidate/profile/resume');
    return response.data;
  },

  /**
   * Download authenticated candidate's resume via authenticated blob stream
   * @param {string} [fallbackFilename='resume.pdf']
   */
  async downloadResume(fallbackFilename = 'resume.pdf') {
    const response = await api.get('/candidate/profile/resume', {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], {
      type: response.headers['content-type'] || 'application/octet-stream',
    });

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fallbackFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  },
};

export default candidateProfileService;
