import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { salonApi } from '../api/salons';
import { serviceApi } from '../api/services';
import { bookingApi } from '../api/bookings';
import DayBoxGrid from '../components/DayBoxGrid';
import { format } from 'date-fns';
import { MapPin } from 'lucide-react';

export default function SalonDetail() {
  const { salonId } = useParams();
  const navigate = useNavigate();
  const [salon, setSalon] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [busyTimes, setBusyTimes] = useState([]);

  useEffect(() => {
    salonApi.getById(salonId).then((res) => setSalon(res.data));
    serviceApi.getBySalon(salonId).then((res) => setServices(res.data));

    const today = format(new Date(), 'yyyy-MM-dd');
    bookingApi.getAvailability(salonId, today).then((res) => setBusyTimes(res.data.busy_times));
  }, [salonId]);

  const toggleService = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const total = services
    .filter((s) => selectedIds.includes(s._id))
    .reduce((sum, s) => sum + s.price, 0);

  const handleContinue = () => {
    navigate(`/salon/${salonId}/book`, { state: { services: selectedIds } });
  };

  if (!salon) return <div className="max-w-2xl mx-auto p-4 text-gray-500">در حال بارگذاری...</div>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-medium">{salon.name}</h1>
      <p className="text-sm text-gray-600 flex items-center gap-1 mt-1 mb-6">
        <MapPin className="w-3.5 h-3.5" />
        {salon.address}
      </p>

      <div className="mb-6">
        <h2 className="text-lg font-medium mb-1">برنامه امروز</h2>
        <p className="text-xs text-gray-500 mb-3">
          هر روز به بازه‌های {salon.min_booking_interval} دقیقه‌ای تقسیم می‌شود. بازه‌های خط‌خورده قبلاً تایید شده‌اند.
        </p>
        <DayBoxGrid boxMinutes={salon.min_booking_interval} busyTimes={busyTimes} />
      </div>

      <h2 className="text-lg font-medium mb-3">انتخاب سرویس</h2>
      <div className="space-y-2 mb-6">
        {services.map((service) => (
          <label
            key={service._id}
            className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
              selectedIds.includes(service._id) ? 'border-black bg-gray-50' : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedIds.includes(service._id)}
                onChange={() => toggleService(service._id)}
              />
              <div>
                <div className="font-medium">{service.name}</div>
                <div className="text-xs text-gray-500">{service.duration_minutes} دقیقه</div>
              </div>
            </div>
            <span className="text-sm font-medium">{service.price.toLocaleString()} تومان</span>
          </label>
        ))}
        {services.length === 0 && <p className="text-gray-500 text-sm">سرویسی ثبت نشده است</p>}
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <span className="text-sm text-gray-600">جمع کل: {total.toLocaleString()} تومان</span>
        <button
          onClick={handleContinue}
          disabled={selectedIds.length === 0}
          className="px-4 py-2 bg-black text-white rounded-lg disabled:bg-gray-300"
        >
          ادامه به رزرو
        </button>
      </div>
    </div>
  );
}
