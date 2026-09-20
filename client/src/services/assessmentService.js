import api from './api';

export class ClockIntegrityError extends Error {
  constructor(message = 'Security Error: Server clock synchronization header (Date) is missing or invalid.') {
    super(message);
    this.name = 'ClockIntegrityError';
    this.isClockIntegrityError = true;
  }
}

/**
 * Validates the presence of the authoritative HTTP Date response header,
 * calculates the clock skew relative to client local time, and extracts the attempt document.
 * Fails loudly if Date is missing or invalid.
 *
 * @param {import('axios').AxiosResponse} response
 * @returns {{ attempt: Object, serverDate: Date, clockSkew: number }}
 */
export const extractAuthoritativeAttempt = (response) => {
  const dateHeader =
    (response.headers?.get && typeof response.headers.get === 'function' && response.headers.get('date')) ||
    response.headers?.['date'] ||
    response.headers?.['Date'];

  if (!dateHeader) {
    throw new ClockIntegrityError(
      'Security Alert: Server clock synchronization header (Date) is missing from response. Authoritative assessment timer cannot be initialized.'
    );
  }

  const serverDate = new Date(dateHeader);
  if (isNaN(serverDate.getTime())) {
    throw new ClockIntegrityError(
      'Security Alert: Server clock synchronization header (Date) is unparseable. Clock integrity check failed.'
    );
  }

  // Calculate clock skew (positive means server is ahead of client, negative means behind)
  const clientTimeAtReceipt = Date.now();
  const clockSkew = serverDate.getTime() - clientTimeAtReceipt;

  const attempt = response.data?.data?.attempt || response.data?.attempt;

  return {
    attempt,
    serverDate,
    clockSkew,
  };
};

/**
 * Fetch published assessments for candidate browsing
 */
export const getPublishedAssessments = async (params = {}) => {
  const response = await api.get('/assessments', { params });
  return response.data?.data?.assessments || [];
};

/**
 * Fetch single published assessment by ID
 */
export const getPublishedAssessmentById = async (id) => {
  const response = await api.get(`/assessments/${id}`);
  return response.data?.data?.assessment;
};

/**
 * Fetch candidate-sanitized assessment questions (answers and explanations stripped)
 */
export const getCandidateQuestions = async (assessmentId) => {
  const response = await api.get(`/assessments/${assessmentId}/questions`);
  return response.data?.data?.questions || [];
};

/**
 * Start a new assessment attempt or resume an active one.
 * Authoritative response undergoes strict Date header validation.
 */
export const startAssessmentAttempt = async (assessmentId) => {
  const response = await api.post(`/candidate/assessments/${assessmentId}/start`);
  return extractAuthoritativeAttempt(response);
};

/**
 * Fetch candidate's attempt details by ID.
 * Authoritative response undergoes strict Date header validation.
 */
export const getAttemptById = async (attemptId) => {
  const response = await api.get(`/candidate/attempts/${attemptId}`);
  return extractAuthoritativeAttempt(response);
};

/**
 * Submit candidate's assessment attempt answers for server-side evaluation
 *
 * @param {string} attemptId
 * @param {Array<{ questionId: string, selectedOptionIndex: number|null }>} answers
 */
export const submitAssessmentAttempt = async (attemptId, answers = []) => {
  const response = await api.post(`/candidate/attempts/${attemptId}/submit`, { answers });
  return response.data;
};

/**
 * Fetch authenticated candidate's assessment attempts history
 */
export const getCandidateAttempts = async (params = {}) => {
  const response = await api.get('/candidate/attempts', { params });
  return response.data?.data?.attempts || [];
};

/**
 * Fetch finalized attempt result metrics
 */
export const getAttemptResult = async (attemptId) => {
  const response = await api.get(`/candidate/attempts/${attemptId}/result`);
  return response.data?.data?.result || response.data?.data?.attempt;
};

/**
 * Fetch authenticated candidate's past assessment attempt history (completed and expired)
 */
export const getAssessmentHistory = async () => {
  const response = await api.get('/candidate/assessments/history');
  return response.data?.data?.history || [];
};

/**
 * Fetch candidate's aggregated accuracy and metrics per topic across completed attempts
 */
export const getTopicWisePerformance = async () => {
  const response = await api.get('/candidate/performance/topic-wise');
  return response.data?.data?.topics || [];
};

/**
 * Classify assessment API errors into actionable UI guidance
 */
export const classifyAssessmentError = (error) => {
  if (error?.isClockIntegrityError) {
    return {
      category: 'clock_integrity',
      title: 'Clock Synchronization Error',
      message: error.message,
      canRetry: false,
    };
  }

  const status = error.response?.status;
  const rawMessage = error.response?.data?.message || error.message || 'An unexpected error occurred.';

  if (status === 400 && rawMessage.toLowerCase().includes('maximum attempts limit')) {
    return {
      category: 'max_attempts',
      title: 'Attempt Limit Reached',
      message: rawMessage,
      canRetry: false,
    };
  }

  if (status === 400 && (rawMessage.toLowerCase().includes('expired') || rawMessage.toLowerCase().includes('time limit'))) {
    return {
      category: 'expired',
      title: 'Time Limit Expired',
      message: 'The allowed duration for this assessment has elapsed. Your attempt has been finalized.',
      canRetry: false,
    };
  }

  if (status === 400 && rawMessage.toLowerCase().includes('already been submitted')) {
    return {
      category: 'already_submitted',
      title: 'Assessment Already Submitted',
      message: 'This assessment attempt has already been submitted or completed.',
      canRetry: false,
    };
  }

  if (status === 403) {
    return {
      category: 'forbidden',
      title: 'Access Denied',
      message: 'You are not authorized to view or submit this assessment attempt.',
      canRetry: false,
    };
  }

  if (status === 404) {
    return {
      category: 'not_found',
      title: 'Assessment Not Found',
      message: rawMessage || 'The requested assessment could not be found or is unpublished.',
      canRetry: false,
    };
  }

  return {
    category: 'generic',
    title: 'Error',
    message: rawMessage,
    canRetry: true,
  };
};

export default {
  getPublishedAssessments,
  getPublishedAssessmentById,
  getCandidateQuestions,
  startAssessmentAttempt,
  getAttemptById,
  submitAssessmentAttempt,
  getCandidateAttempts,
  getAttemptResult,
  getAssessmentHistory,
  getTopicWisePerformance,
  classifyAssessmentError,
  extractAuthoritativeAttempt,
  ClockIntegrityError,
};
