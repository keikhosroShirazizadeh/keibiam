import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Scissors, LogOut, User, Shield, Settings, Calendar } from 'lucide-react';

export default function Navbar() {
  const { isAuthenticated, user, logout, isAdmin, isSalonOwner, isStylist, isCustomer } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white border-b z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Scissors className="w-6 h-6" />
          <span className="font-medium text-lg">SalonBook</span>
        </Link>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              {isAdmin() && (
                <Link to="/admin" className="flex items-center gap-1 text-sm hover:text-gray-600">
                  <Shield className="w-4 h-4" />
                  ادمین
                </Link>
              )}
              {isSalonOwner() && (
                <Link to="/owner-dashboard" className="flex items-center gap-1 text-sm hover:text-gray-600">
                  <Settings className="w-4 h-4" />
                  مدیریت
                </Link>
              )}
              {isStylist() && (
                <Link to="/stylist-dashboard" className="flex items-center gap-1 text-sm hover:text-gray-600">
                  <Calendar className="w-4 h-4" />
                  برنامه
                </Link>
              )}
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4" />
                <span>{user?.full_name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
              >
                <LogOut className="w-4 h-4" />
                خروج
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="text-sm hover:text-gray-600"
              >
                ورود
              </Link>
              <Link
                to="/register"
                className="text-sm px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800"
              >
                ثبت‌نام
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
