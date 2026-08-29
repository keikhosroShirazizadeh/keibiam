import api from './axiosConfig';

export const bookingApi = {
  create: (data) => api.post('/bookings/', data),
  getMine: () => api.get('/bookings/me'),
  getBySalon: (salonId) => api.get(`/bookings/salon/${salonId}`),
  updateStatus: (bookingId, newStatus) =>
    api.put(`/bookings/${bookingId}/status`, null, { params: { new_status: newStatus } }),
};
