import { useState, useEffect } from 'react';
import { salonApi } from '../api/salons';
import { bookingApi } from '../api/bookings';
import { useAuthStore } from '../store/authStore';
import { Plus, Settings, Users, Calendar, Chair, Scissors } from 'lucide-react';

export default function SalonOwnerDashboard() {
  const { user } = useAuthStore();
  const [salons, setSalons] = useState([]);
  const [activeTab, setActiveTab] = useState('salons');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSalon, setNewSalon] = useState({
    name: '',
    address: '',
    phone: '',
    description: '',
    management_mode: 'chair_based',
  });

  useEffect(() => {
    loadSalons();
  }, []);

  const loadSalons = async () => {
    try {
      // In real app, you'd have an endpoint for owner's salons
      const res = await salonApi.getAll({ limit: 100 });
      const mySalons = res.data.salons.filter(s => s.owner_id === user?._id);
      setSalons(mySalons);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSalon = async (e) => {
    e.preventDefault();
    try {
      await salonApi.create({
        ...newSalon,
        location: { type: 'Point', coordinates: [51.389, 35.6892] }, // Default Tehran
      });
      setShowCreateForm(false);
      setNewSalon({ name: '', address: '', phone: '', description: '', management_mode: 'chair_based' });
      loadSalons();
    } catch (err) {
      alert('خطا در ایجاد آرایشگاه');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-medium">پنل مدیریت آرایشگاه</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
        >
          <Plus className="w-4 h-4" />
          آرایشگاه جدید
        </button>
      </div>

      {showCreateForm && (
        <div className="border rounded-xl p-6 mb-6 bg-gray-50">
          <h2 className="text-lg font-medium mb-4">ثبت آرایشگاه جدید</h2>
          <form onSubmit={handleCreateSalon} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="نام آرایشگاه"
              value={newSalon.name}
              onChange={(e) => setNewSalon({ ...newSalon, name: e.target.value })}
              className="px-4 py-2 border rounded-lg"
              required
            />
            <input
              type="text"
              placeholder="آدرس"
              value={newSalon.address}
              onChange={(e) => setNewSalon({ ...newSalon, address: e.target.value })}
              className="px-4 py-2 border rounded-lg"
              required
            />
            <input
              type="text"
              placeholder="تلفن"
              value={newSalon.phone}
              onChange={(e) => setNewSalon({ ...newSalon, phone: e.target.value })}
              className="px-4 py-2 border rounded-lg"
              required
            />
            <select
              value={newSalon.management_mode}
              onChange={(e) => setNewSalon({ ...newSalon, management_mode: e.target.value })}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="chair_based">مدیریت صندلی‌محور</option>
              <option value="stylist_based">مدیریت آرایشگرمحور</option>
            </select>
            <textarea
              placeholder="توضیحات"
              value={newSalon.description}
              onChange={(e) => setNewSalon({ ...newSalon, description: e.target.value })}
              className="px-4 py-2 border rounded-lg md:col-span-2 resize-none"
              rows={3}
            />
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" className="px-4 py-2 bg-black text-white rounded-lg">
                ثبت
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                انصراف
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b mb-6">
        {[
          { id: 'salons', label: 'آرایشگاه‌ها', icon: Settings },
          { id: 'stylists', label: 'آرایشگرها', icon: Users },
          { id: 'bookings', label: 'نوبت‌ها', icon: Calendar },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 pb-3 px-2 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'salons' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {salons.map((salon) => (
            <div key={salon._id} className="border rounded-xl p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-lg">{salon.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  salon.status === 'active' ? 'bg-green-100 text-green-700' :
                  salon.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {salon.status === 'active' ? 'فعال' : salon.status === 'pending' ? 'در انتظار' : 'غیرفعال'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{salon.address}</p>
              <p className="text-sm text-gray-500 mb-3">{salon.description}</p>
              <div className="flex gap-2">
                <button className="text-sm px-3 py-1 border rounded-lg hover:bg-gray-50">
                  ویرایش
                </button>
                <button className="text-sm px-3 py-1 border rounded-lg hover:bg-gray-50">
                  مدیریت صندلی‌ها
                </button>
              </div>
            </div>
          ))}
          {salons.length === 0 && (
            <div className="col-span-2 text-center py-12 text-gray-500">
              هنوز آرایشگاهی ثبت نکرده‌اید
            </div>
          )}
        </div>
      )}

      {activeTab === 'stylists' && (
        <div className="text-center py-12 text-gray-500">
          مدیریت آرایشگرها (بخش کامل در نسخه نهایی)
        </div>
      )}

      {activeTab === 'bookings' && (
        <div className="text-center py-12 text-gray-500">
          مدیریت نوبت‌ها (بخش کامل در نسخه نهایی)
        </div>
      )}
    </div>
  );
}
