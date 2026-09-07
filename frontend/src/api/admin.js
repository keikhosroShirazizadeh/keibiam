import api from './axiosConfig';

export const adminApi = {
  listUsers: (role, search) => api.get('/admin/users', { params: { role, search: search || undefined } }),
  getUserDetail: (userId) => api.get(`/admin/users/${userId}`),
};
