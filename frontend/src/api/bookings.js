import api from './axiosConfig';

export const bookingApi = {
  create: (data) => api.post('/bookings/', data),
  createBulk: (data) => api.post('/bookings/bulk', data),
  getMine: () => api.get('/bookings/me'),
  getBySalon: (salonId) => api.get(`/bookings/salon/${salonId}`),
  getAvailability: (salonId, date) => api.get(`/bookings/salon/${salonId}/availability`, { params: { date } }),
  getMineAsStylist: () => api.get('/bookings/stylist/me'),
  updateStatus: (bookingId, newStatus) =>
    api.put(`/bookings/${bookingId}/status`, null, { params: { new_status: newStatus } }),
};
