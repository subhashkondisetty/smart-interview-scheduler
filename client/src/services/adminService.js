import api from './api';

const adminService = {
  /**
   * Fetches aggregated administrative dashboard metrics and recent platform activity.
   *
   * @param {Object} [params] - Query parameters
   * @param {number} [params.limit=10] - Number of activity items to retrieve (capped at 50 on backend)
   * @returns {Promise<Object>} The aggregated metrics payload
   */
  getDashboardMetrics: async (params = {}) => {
    const res = await api.get('/admin/dashboard', { params });
    return res.data?.data || res.data;
  },

  /**
   * Fetches paginated, searchable, filterable candidate list.
   *
   * @param {Object} [params] - Query parameters
   * @param {number} [params.page=1] - Page number
   * @param {number} [params.limit=10] - Items per page
   * @param {string} [params.search] - Search text
   * @param {string} [params.status] - 'all' | 'active' | 'inactive'
   * @param {string} [params.experienceLevel] - 'all' | 'entry' | 'mid' | 'senior' | 'lead'
   * @param {string} [params.sortBy] - 'createdAt' | 'fullName' | 'email' | 'profileCompletionPercentage'
   * @param {string} [params.sortOrder] - 'asc' | 'desc'
   * @returns {Promise<Object>} { candidates, pagination, summary }
   */
  getCandidates: async (params = {}) => {
    const res = await api.get('/admin/candidates', { params });
    return res.data?.data || res.data;
  },

  /**
   * Fetches full 360-degree candidate details (profile, bookings, attempts, stats).
   *
   * @param {string} id - Candidate user ID
   * @returns {Promise<Object>} { candidate, bookings, attempts, stats }
   */
  getCandidateById: async (id) => {
    const res = await api.get(`/admin/candidates/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * Toggles candidate account active status.
   *
   * @param {string} id - Candidate user ID
   * @param {boolean} isActive - Desired status
   * @returns {Promise<Object>} Updated user
   */
  updateCandidateStatus: async (id, isActive) => {
    const res = await api.patch(`/admin/candidates/${id}/status`, { isActive });
    return res.data?.data || res.data;
  },

  /**
   * Downloads a candidate's resume as an admin.
   *
   * @param {string} candidateId - Candidate user ID
   * @param {string} [fallbackFilename='resume.pdf'] - Suggested download filename
   */
  downloadCandidateResume: async (candidateId, fallbackFilename = 'resume.pdf') => {
    const response = await api.get('/candidate/profile/resume', {
      params: { candidateId },
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

  /**
   * Fetches interview slots for administrative management.
   *
   * @param {Object} [params] - Optional filters (status, startDate, endDate)
   * @returns {Promise<Array>} List of slot objects
   */
  getSlots: async (params = {}) => {
    const res = await api.get('/admin/interview-slots', { params });
    return res.data?.data?.slots || [];
  },

  /**
   * Fetches a single interview slot by ID.
   *
   * @param {string} id
   * @returns {Promise<Object>} Slot object
   */
  getSlotById: async (id) => {
    const res = await api.get(`/admin/interview-slots/${id}`);
    return res.data?.data?.slot || res.data;
  },

  /**
   * Creates a new interview slot.
   *
   * @param {Object} slotData - { title, interviewerName, startTime, durationMinutes, capacity, description, meetingLink }
   * @returns {Promise<Object>} Created slot payload
   */
  createSlot: async (slotData) => {
    const res = await api.post('/admin/interview-slots', slotData);
    return res.data?.data?.slot || res.data;
  },

  /**
   * Updates an existing interview slot.
   *
   * @param {string} id
   * @param {Object} slotData - { title, interviewerName, startTime, durationMinutes, capacity, status, description, meetingLink }
   * @returns {Promise<Object>} Updated slot payload
   */
  updateSlot: async (id, slotData) => {
    const res = await api.put(`/admin/interview-slots/${id}`, slotData);
    return res.data?.data?.slot || res.data;
  },

  /**
   * Deletes or cancels an interview slot.
   *
   * @param {string} id
   * @returns {Promise<Object>} Response data
   */
  deleteSlot: async (id) => {
    const res = await api.delete(`/admin/interview-slots/${id}`);
    return res.data;
  },

  /**
   * Fetches interview bookings with filters (status, slotId, candidateId).
   *
   * @param {Object} [params] - Query filters
   * @returns {Promise<Array>} List of booking objects
   */
  getBookings: async (params = {}) => {
    const res = await api.get('/admin/bookings', { params });
    return res.data?.data?.bookings || [];
  },

  /**
   * Cancels a booking on candidate's behalf as admin.
   *
   * @param {string} bookingId
   * @returns {Promise<Object>} Response data with cancelled booking
   */
  adminCancelBooking: async (bookingId) => {
    const res = await api.patch(`/admin/bookings/${bookingId}/cancel`);
    return res.data;
  },

  /**
   * Reschedules a booking to a new slot on candidate's behalf as admin.
   *
   * @param {string} bookingId
   * @param {Object} data - { newSlotId: string, notes?: string }
   * @returns {Promise<Object>} Response data with newBooking and previousBooking
   */
  adminRescheduleBooking: async (bookingId, { newSlotId, notes }) => {
    const res = await api.patch(`/admin/bookings/${bookingId}/reschedule`, {
      newSlotId,
      notes,
    });
    return res.data;
  },

  /**
   * Fetches available future interview slots for rescheduling picker.
   *
   * @returns {Promise<Array>} List of available slots
   */
  getAvailableSlots: async () => {
    const res = await api.get('/interview-slots');
    return res.data?.data?.slots || [];
  },

  /**
   * Fetches all assessments for admin management (includes drafts and question/attempt counts).
   *
   * @param {Object} [params] - { difficulty, isPublished }
   * @returns {Promise<Array>} List of assessments
   */
  getAssessments: async (params = {}) => {
    const res = await api.get('/admin/assessments', { params });
    return res.data?.data?.assessments || [];
  },

  /**
   * Fetches a single assessment by ID for admin.
   *
   * @param {string} id
   * @returns {Promise<Object>} Assessment document
   */
  getAssessmentById: async (id) => {
    const res = await api.get(`/admin/assessments/${id}`);
    return res.data?.data?.assessment || res.data;
  },

  /**
   * Creates a new assessment.
   *
   * @param {Object} data - { title, description, difficulty, durationMinutes, passingPercentage, maxAttempts, isPublished }
   * @returns {Promise<Object>} Created assessment
   */
  createAssessment: async (data) => {
    const res = await api.post('/admin/assessments', data);
    return res.data?.data?.assessment || res.data;
  },

  /**
   * Updates an existing assessment.
   *
   * @param {string} id
   * @param {Object} data - fields to update
   * @returns {Promise<Object>} Updated assessment
   */
  updateAssessment: async (id, data) => {
    const res = await api.put(`/admin/assessments/${id}`, data);
    return res.data?.data?.assessment || res.data;
  },

  /**
   * Deletes an assessment (blocked if attempts exist, cascades questions if zero attempts).
   *
   * @param {string} id
   * @returns {Promise<Object>} Response payload
   */
  deleteAssessment: async (id) => {
    const res = await api.delete(`/admin/assessments/${id}`);
    return res.data;
  },

  /**
   * Toggles the published status of an assessment.
   *
   * @param {string} id
   * @param {boolean} [isPublished] - Optional explicit target boolean
   * @returns {Promise<Object>} Updated assessment
   */
  togglePublishAssessment: async (id, isPublished) => {
    const payload = isPublished !== undefined ? { isPublished } : {};
    const res = await api.patch(`/admin/assessments/${id}/publish`, payload);
    return res.data?.data?.assessment || res.data;
  },

  /**
   * Fetches all questions for a specific assessment (Admin view with correct answers and explanations).
   *
   * @param {string} assessmentId
   * @returns {Promise<Array>} List of question documents
   */
  getQuestions: async (assessmentId) => {
    const res = await api.get(`/admin/assessments/${assessmentId}/questions`);
    return res.data?.data?.questions || [];
  },

  /**
   * Fetches single question by ID under an assessment.
   *
   * @param {string} assessmentId
   * @param {string} questionId
   * @returns {Promise<Object>} Question document
   */
  getQuestionById: async (assessmentId, questionId) => {
    const res = await api.get(`/admin/assessments/${assessmentId}/questions/${questionId}`);
    return res.data?.data?.question || res.data;
  },

  /**
   * Creates a new question under an assessment.
   *
   * @param {string} assessmentId
   * @param {Object} data - { text, options, correctOptionIndex, explanation, marks, topic, difficulty }
   * @returns {Promise<Object>} Created question
   */
  createQuestion: async (assessmentId, data) => {
    const res = await api.post(`/admin/assessments/${assessmentId}/questions`, data);
    return res.data?.data?.question || res.data;
  },

  /**
   * Updates an existing question under an assessment.
   *
   * @param {string} assessmentId
   * @param {string} questionId
   * @param {Object} data - fields to update
   * @returns {Promise<Object>} Updated question
   */
  updateQuestion: async (assessmentId, questionId, data) => {
    const res = await api.put(`/admin/assessments/${assessmentId}/questions/${questionId}`, data);
    return res.data?.data?.question || res.data;
  },

  /**
   * Deletes a question under an assessment.
   *
   * @param {string} assessmentId
   * @param {string} questionId
   * @returns {Promise<Object>} Response payload
   */
  deleteQuestion: async (assessmentId, questionId) => {
    const res = await api.delete(`/admin/assessments/${assessmentId}/questions/${questionId}`);
    return res.data;
  },

  /**
   * Fetches candidate results (assessment attempts across all candidates) with search, filters, pagination.
   *
   * @param {Object} [params] - { page, limit, search, assessmentId, candidateId, status, passed, sortBy, sortOrder }
   * @returns {Promise<Object>} { results, pagination, metrics }
   */
  getResults: async (params = {}) => {
    const res = await api.get('/admin/results', { params });
    return res.data?.data || { results: [], pagination: {}, metrics: {} };
  },

  /**
   * Fetches a single attempt result with full breakdown for admin inspection.
   *
   * @param {string} id - Assessment attempt ID
   * @returns {Promise<Object>} Full attempt result with candidate and assessment info
   */
  getResultById: async (id) => {
    const res = await api.get(`/admin/results/${id}`);
    return res.data?.data?.result || res.data;
  },

  /**
   * Fetches platform notifications audit feed (Admin only).
   *
   * @param {Object} [params] - { page, limit, type, search }
   * @returns {Promise<Object>} { notifications, pagination }
   */
  getNotifications: async (params = {}) => {
    const res = await api.get('/admin/notifications', { params });
    return res.data?.data || { notifications: [], pagination: {} };
  },

  /**
   * Fetches platform notifications audit feed (Admin only) - alias for getNotifications.
   *
   * @param {Object} [params] - { page, limit, type, search }
   * @returns {Promise<Object>} { notifications, pagination }
   */
  getAdminNotifications: async (params = {}) => {
    const res = await api.get('/admin/notifications', { params });
    return res.data?.data || { notifications: [], pagination: {} };
  },

  /**
   * Sends a broadcast or targeted notification to candidate(s) (Admin only).
   * Reuses POST /api/admin/notifications/broadcast directly.
   *
   * @param {Object} data - { message: string, type?: string, role?: string, userIds?: Array<string>|string, candidateId?: string }
   * @returns {Promise<Object>} Response payload with recipientCount
   */
  sendNotification: async (data) => {
    const res = await api.post('/admin/notifications/broadcast', data);
    return res.data;
  },
};

export default adminService;
