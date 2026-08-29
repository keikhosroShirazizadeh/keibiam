import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import SalonDetail from './pages/SalonDetail';
import BookingPage from './pages/BookingPage';
import AdminPanel from './pages/AdminPanel';
import SalonOwnerDashboard from './pages/SalonOwnerDashboard';
import StylistDashboard from './pages/StylistDashboard';
import { useAuthStore } from './store/authStore';

function ProtectedRoute({ children, allow }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allow && !allow(user)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/salon/:salonId" element={<SalonDetail />} />
          <Route path="/salon/:salonId/book" element={<BookingPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allow={(u) => ['super_admin', 'admin'].includes(u?.role)}>
                <AdminPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner-dashboard"
            element={
              <ProtectedRoute allow={(u) => u?.role === 'salon_owner'}>
                <SalonOwnerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stylist-dashboard"
            element={
              <ProtectedRoute allow={(u) => u?.role === 'stylist'}>
                <StylistDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
