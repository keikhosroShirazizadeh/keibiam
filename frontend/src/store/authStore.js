import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      login: (token, user) => set({ token, user, isAuthenticated: true }),
      logout: () => set({ token: null, user: null, isAuthenticated: false }),
      setUser: (user) => set({ user }),

      isSuperAdmin: () => get().user?.role === 'super_admin',
      isAdmin: () => ['super_admin', 'admin'].includes(get().user?.role),
      isSalonOwner: () => get().user?.role === 'salon_owner',
      isStylist: () => get().user?.role === 'stylist',
      isCustomer: () => get().user?.role === 'customer',
    }),
    {
      name: 'salon-auth',
      partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
