/**
 * KalaKriti Art Studio — Centralized API Client
 *
 * Handles HTTP requests to the Express backend via fetch() with:
 * - Session cookies automatically included (credentials: 'include')
 * - Automatic JSON serialization and header setting
 * - Standardized error extraction and propagation
 */

const BASE_URL = '/api';

/**
 * Core HTTP helper function
 * @param {string} endpoint - API route path e.g. '/paintings'
 * @param {object} options - Request options (method, body, headers)
 * @returns {Promise<any>} Parsed response data
 */
async function request(endpoint, options = {}) {
  const config = {
    ...options,
    credentials: 'include', // Crucial for persistent Express session cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  // Convert JavaScript objects into JSON string for POST / PATCH bodies
  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  // Parse JSON response body if available
  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  }

  // Handle non-2xx HTTP responses
  if (!response.ok) {
    const message = (data && data.error) || (data && data.message) || `HTTP error ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Authentication & Session
  auth: {
    register: (body) => request('/auth/register', { method: 'POST', body }),
    login: (body) => request('/auth/login', { method: 'POST', body }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    getMe: () => request('/auth/me', { method: 'GET' }),
  },

  // Paintings Catalogue
  paintings: {
    getAll: () => request('/paintings', { method: 'GET' }),
    create: (body) => request('/paintings', { method: 'POST', body }),
    update: (id, body) => request(`/paintings/${id}`, { method: 'PATCH', body }),
  },

  // Orders
  orders: {
    getAll: () => request('/orders', { method: 'GET' }),
    create: (paintingId) => request('/orders', { method: 'POST', body: { paintingId } }),
    cancel: (orderId) => request(`/orders/${orderId}/cancel`, { method: 'PATCH' }),
  },

  // Wall Painting Bookings
  bookings: {
    getAll: () => request('/bookings', { method: 'GET' }),
    getBookedDates: () => request('/bookings/booked-dates', { method: 'GET' }),
    create: (body) => request('/bookings', { method: 'POST', body }),
    cancel: (bookingId) => request(`/bookings/${bookingId}/cancel`, { method: 'PATCH' }),
    updateStatus: (bookingId, status) => request(`/bookings/${bookingId}/status`, { method: 'PATCH', body: { status } }),
  },

  // Custom Pottery Requests
  pottery: {
    getCatalogue: () => request('/pottery-requests/catalogue', { method: 'GET' }),
    getAll: () => request('/pottery-requests', { method: 'GET' }),
    create: (body) => request('/pottery-requests', { method: 'POST', body }),
    update: (id, body) => request(`/pottery-requests/${id}`, { method: 'PATCH', body }),
    cancel: (id) => request(`/pottery-requests/${id}/cancel`, { method: 'PATCH' }),
    updateStatus: (id, status) => request(`/pottery-requests/${id}/status`, { method: 'PATCH', body: { status } }),
  },
};
