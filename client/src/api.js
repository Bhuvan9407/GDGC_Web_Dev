/**
 * Centralized API Client for Art Studio
 * Automatically manages credentials, headers, and error parsing.
 */

const BASE_URL = '/api';

async function request(endpoint, options = {}) {
  const config = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  }

  if (!response.ok) {
    const errorMsg = (data && data.error) || (data && data.message) || `HTTP error ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Authentication
  auth: {
    register: (body) => request('/auth/register', { method: 'POST', body }),
    login: (body) => request('/auth/login', { method: 'POST', body }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    getMe: () => request('/auth/me', { method: 'GET' }),
  },

  // Paintings
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
