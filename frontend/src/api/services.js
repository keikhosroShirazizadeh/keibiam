import api from './axiosConfig';

export const serviceApi = {
  getBySalon: (salonId) => api.get(`/services/salon/${salonId}`),
  create: (salonId, data) => api.post(`/services/salon/${salonId}`, data),
};
