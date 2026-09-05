import api from './axiosConfig';

export const chairApi = {
  getBySalon: (salonId) => api.get(`/chairs/salon/${salonId}`),
  create: (salonId, data) => api.post(`/chairs/salon/${salonId}`, data),
  uploadImage: (chairId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/chairs/${chairId}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
