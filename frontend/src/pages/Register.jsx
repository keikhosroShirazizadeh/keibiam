import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api/axiosConfig';
import { UserPlus, Mail, Lock, User, Phone, Fingerprint } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    national_code: '',
    password: '',
    role: 'customer',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/register', form);
      login(res.data.access_token, res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'خطا در ثبت‌نام');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 pt-12">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-black text-white rounded-2xl flex items-center justify-center mx-auto mb-4">
          <UserPlus className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-medium">ثبت‌نام</h1>
        <p className="text-gray-500 mt-1">حساب کاربری جدید بسازید</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">نام کامل</label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="نام و نام خانوادگی"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">ایمیل</label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="your@email.com"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">شماره موبایل</label>
          <div className="relative">
            <Phone className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="0912XXXXXXX"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">کد ملی (اختیاری)</label>
          <div className="relative">
            <Fingerprint className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              name="national_code"
              value={form.national_code}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="۱۰ رقم"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">رمز عبور</label>
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="حداقل ۶ کاراکتر"
              required
              minLength={6}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">نوع حساب</label>
          <select
            name="role"
            value={form.role}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="customer">مشتری</option>
            <option value="salon_owner">صاحب آرایشگاه</option>
            <option value="stylist">آرایشگر</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:bg-gray-300"
        >
          {loading ? 'در حال ثبت‌نام...' : 'ثبت‌نام'}
        </button>
      </form>

      <p className="text-center mt-6 text-sm text-gray-600">
        قبلاً ثبت‌نام کرده‌اید؟{' '}
        <Link to="/login" className="text-black font-medium hover:underline">
          وارد شوید
        </Link>
      </p>
    </div>
  );
}
