import api from './axiosConfig';

export const usersApi = {
  searchCustomers: (search) => api.get('/users/search', { params: { search } }),
};
