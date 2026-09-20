import api from './api';

/**
 * Classifies backend booking errors into structured, user-friendly failure categories
 * matching interviewBookingController.js status codes and messages.
 *
 * @param {Object} error - Axios error object
 * @returns {{ category: string, title: string, message: string, actionText: string|null, actionLink: string|null }}
 */
export function classifyBookingError(error) {
  const status = error.response?.status;
  const serverMsg = error.response?.data?.message || error.message || 'An unexpected error occurred.';

  // 1. Slot Full / Capacity Collision (409)
  if (status === 409 && /fully booked|no longer available/i.test(serverMsg)) {
    return {
      category: 'slot_full',
      title: 'Slot Just Filled Up',
      message: 'Another candidate booked the remaining seat for this slot right before your request. Please choose an alternate session.',
      actionText: 'Browse Alternate Slots',
      actionLink: null,
    };
  }

  // 2. Duplicate Active Booking (409 or 400)
  if ((status === 409 || status === 400) && /already have an active booking/i.test(serverMsg)) {
    return {
      category: 'duplicate_booking',
      title: 'Already Reserved',
      message: 'You already hold a confirmed reservation for this interview session. You can manage or reschedule it in My Interviews.',
      actionText: 'View in My Interviews',
      actionLink: '/candidate/bookings',
    };
  }

  // 3. Past or Ongoing Slot (400)
  if (status === 400 && /past or ongoing/i.test(serverMsg)) {
    return {
      category: 'past_slot',
      title: 'Session Has Elapsed',
      message: 'This interview slot has already started or completed. Please choose a future session.',
      actionText: 'Browse Future Slots',
      actionLink: null,
    };
  }

  // 4. Ownership Mismatch / Access Denied (403)
  if (status === 403 || /Forbidden|only cancel your own|only reschedule your own/i.test(serverMsg)) {
    return {
      category: 'permission_denied',
      title: 'Access Denied',
      message: 'You do not have permission to modify this booking because it belongs to another candidate account.',
      actionText: null,
      actionLink: null,
    };
  }

  // 5. Lost Concurrency Race / Already Cancelled or Modified (400)
  if (status === 400 && /already been cancelled or modified/i.test(serverMsg)) {
    return {
      category: 'already_updated',
      title: 'Booking Status Changed',
      message: 'This booking was already cancelled or modified in another session. Refreshing your bookings...',
      actionText: 'Refresh Bookings',
      actionLink: null,
    };
  }

  // 6. Cannot Reschedule Inactive Booking (400)
  if (status === 400 && /Cannot reschedule a/i.test(serverMsg)) {
    return {
      category: 'invalid_status',
      title: 'Cannot Reschedule',
      message: serverMsg,
      actionText: null,
      actionLink: null,
    };
  }

  // 7. Same Slot Reschedule (400)
  if (status === 400 && /different from current slot/i.test(serverMsg)) {
    return {
      category: 'same_slot',
      title: 'Identical Slot Selected',
      message: 'Please choose a different date or time slot than your current booking.',
      actionText: null,
      actionLink: null,
    };
  }

  // 8. Not Found (404)
  if (status === 404) {
    return {
      category: 'not_found',
      title: 'Resource Not Found',
      message: serverMsg || 'The requested interview slot or booking could not be located.',
      actionText: null,
      actionLink: null,
    };
  }

  // Generic fallback
  return {
    category: 'generic',
    title: 'Booking Error',
    message: serverMsg,
    actionText: null,
    actionLink: null,
  };
}

/**
 * Service for interview slots and candidate booking operations
 */
export const interviewService = {
  /**
   * Browse available future interview slots
   * @returns {Promise<Array>} List of available slot objects
   */
  async getAvailableSlots() {
    const response = await api.get('/interview-slots');
    return response.data?.data?.slots || [];
  },

  /**
   * Book an interview slot
   * @param {Object} data - { slotId: string, notes?: string }
   * @returns {Promise<Object>} Created booking payload
   */
  async bookSlot({ slotId, notes = '' }) {
    const response = await api.post('/candidate/bookings', { slotId, notes });
    return response.data;
  },

  /**
   * Get authenticated candidate's bookings history
   * @returns {Promise<Array>} List of candidate bookings with populated slots
   */
  async getCandidateBookings() {
    const response = await api.get('/candidate/bookings');
    return response.data?.data?.bookings || [];
  },

  /**
   * Get single booking by ID (resolved from candidate's booking set)
   * @param {string} bookingId
   * @returns {Promise<Object|null>} Populated booking object or null if not found
   */
  async getBookingById(bookingId) {
    const bookings = await this.getCandidateBookings();
    return bookings.find((b) => b._id === bookingId) || null;
  },

  /**
   * Cancel candidate's own booking
   * @param {string} bookingId
   * @returns {Promise<Object>} Cancel response
   */
  async cancelBooking(bookingId) {
    const response = await api.patch(`/candidate/bookings/${bookingId}/cancel`);
    return response.data;
  },

  /**
   * Reschedule candidate's own booking to a new slot
   * @param {string} bookingId
   * @param {Object} data - { newSlotId: string, notes?: string }
   * @returns {Promise<Object>} Reschedule response
   */
  async rescheduleBooking(bookingId, { newSlotId, notes }) {
    const response = await api.patch(`/candidate/bookings/${bookingId}/reschedule`, {
      newSlotId,
      notes,
    });
    return response.data;
  },
};

export default interviewService;
