import { useState, useEffect } from 'react';
import { salonApi } from '../api/salons';
import { useAuthStore } from '../store/authStore';
import { Shield, Eye, EyeOff, CheckCircle, XCircle, Ban, Power } from 'lucide-react';

export default function AdminPanel() {
  const { isSuperAdmin } = useAuthStore();
  const [salons, setSalons] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSalons();
  }, [filter]);

  const loadSalons = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { status: filter } : {};
      const res = await salonApi.getAll({ ...params, limit: 100 });
      setSalons(res.data.salons);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (salonId, newStatus, isVisible) => {
    try {
      await salonApi.updateStatus(salonId, newStatus, isVisible);
      loadSalons();
    } catch (err) {
      alert('خطا در بروزرسانی');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-6 h-6" />
        <h1 className="text-2xl font-medium">پنل مدیریت ادمین</h1>
      </div>

      {!isSuperAdmin() && (
        <div className="mb-4 p-3 bg-yellow-50 text-yellow-700 rounded-lg border border-yellow-200">
          شما دسترسی فقط-خواندنی دارید. نمی‌توانید تغییرات ایجاد کنید.
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'all', label: 'همه' },
          { id: 'pending', label: 'در انتظار' },
          { id: 'active', label: 'فعال' },
          { id: 'inactive', label: 'غیرفعال' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
              filter === f.id
                ? 'bg-black text-white border-black'
                : 'hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Salons Table */}
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-right px-4 py-3 font-medium">نام</th>
              <th className="text-right px-4 py-3 font-medium">صاحب</th>
              <th className="text-right px-4 py-3 font-medium">وضعیت</th>
              <th className="text-right px-4 py-3 font-medium">نمایش</th>
              <th className="text-right px-4 py-3 font-medium">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {salons.map((salon) => (
              <tr key={salon._id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{salon.name}</div>
                  <div className="text-gray-500 text-xs">{salon.address}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{salon.owner_id}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    salon.status === 'active' ? 'bg-green-100 text-green-700' :
                    salon.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {salon.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {salon.is_visible ? (
                    <Eye className="w-4 h-4 text-green-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {salon.status === 'pending' && isSuperAdmin() && (
                      <>
                        <button
                          onClick={() => handleStatusChange(salon._id, 'active', true)}
                          className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                          title="فعال کردن"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStatusChange(salon._id, 'rejected', false)}
                          className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                          title="رد کردن"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {salon.status === 'active' && isSuperAdmin() && (
                      <button
                        onClick={() => handleStatusChange(salon._id, 'inactive', false)}
                        className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                        title="غیرفعال کردن"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                    {salon.status === 'inactive' && isSuperAdmin() && (
                      <button
                        onClick={() => handleStatusChange(salon._id, 'active', true)}
                        className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                        title="فعال کردن"
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    )}
                    <button className="text-xs px-2 py-1 border rounded hover:bg-gray-100">
                      جزئیات
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {salons.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-500">
                  آرایشگاهی یافت نشد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
