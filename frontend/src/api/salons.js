import api from './axiosConfig';

export const salonApi = {
  getAll: (params) => api.get('/salons/', { params }),
  getMine: () => api.get('/salons/mine'),
  getById: (salonId) => api.get(`/salons/${salonId}`),
  create: (data) => api.post('/salons/', data),
  update: (salonId, data) => api.put(`/salons/${salonId}`, data),
  updateStatus: (salonId, status, isVisible) =>
    api.put(`/admin/salons/${salonId}/status`, null, { params: { status, is_visible: isVisible } }),
  uploadImage: (salonId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/salons/${salonId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
