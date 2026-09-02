import api from './axiosConfig';

export const stylistApi = {
  getBySalon: (salonId) => api.get(`/stylists/salon/${salonId}`),
  createAccount: (salonId, data) => api.post(`/stylists/salon/${salonId}/create-account`, data),
};
