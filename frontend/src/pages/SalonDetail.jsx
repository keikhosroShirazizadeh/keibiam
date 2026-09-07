import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { salonApi } from '../api/salons';
import { serviceApi } from '../api/services';
import { chairApi } from '../api/chairs';
import { stylistApi } from '../api/stylists';
import { bookingApi } from '../api/bookings';
import DayBoxGrid from '../components/DayBoxGrid';
import PersianDatePicker from '../components/PersianDatePicker';
import { MapPin } from 'lucide-react';

const MAX_BOXES = 3;

export default function SalonDetail() {
  const { salonId } = useParams();
  const navigate = useNavigate();

  const [salon, setSalon] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);

  const [chairs, setChairs] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [selectedChairId, setSelectedChairId] = useState('');
  const [selectedStylistId, setSelectedStylistId] = useState('');

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedBoxes, setSelectedBoxes] = useState([]);
  const [busyTimes, setBusyTimes] = useState([]);

  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    salonApi.getById(salonId).then((res) => {
      const s = res.data;
      setSalon(s);
      if (s.management_mode === 'chair_based') {
        chairApi.getBySalon(salonId).then((r) => setChairs(r.data));
      } else {
        stylistApi.getBySalon(salonId).then((r) => setStylists(r.data));
      }
    });
    serviceApi.getBySalon(salonId).then((res) => setServices(res.data));
  }, [salonId]);

  useEffect(() => {
    bookingApi.getAvailability(salonId, selectedDate).then((res) => {
      setBusyTimes(res.data.busy_times);
      const busy = new Set(res.data.busy_times.map((t) => t.slice(0, 5)));
      setSelectedBoxes((prev) => prev.filter((t) => !busy.has(t)));
    });
  }, [salonId, selectedDate]);

  const toggleService = (id) => {
    setSelectedServiceIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const toggleBox = (time) => {
    setSelectedBoxes((prev) => {
      if (prev.includes(time)) return prev.filter((t) => t !== time);
      if (prev.length >= MAX_BOXES) return prev;
      return [...prev, time];
    });
  };

  const total = services
    .filter((s) => selectedServiceIds.includes(s._id))
    .reduce((sum, s) => sum + s.price, 0);

  const handleSubmit = async () => {
    if (selectedServiceIds.length === 0) {
      setError('لطفاً حداقل یک سرویس انتخاب کنید');
      return;
    }
    if (selectedBoxes.length === 0) {
      setError('لطفاً حداقل یک بازه زمانی را انتخاب کنید');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await bookingApi.createBulk({
        salon_id: salonId,
        service_ids: selectedServiceIds,
        booking_date: selectedDate,
        start_times: selectedBoxes.map((t) => `${t}:00`),
        stylist_id: selectedStylistId || undefined,
        chair_id: selectedChairId || undefined,
        notes: notes || undefined,
      });

      alert(`${selectedBoxes.length} درخواست رزرو ارسال شد! پس از تایید آرایشگاه اطلاع‌رسانی می‌شود.`);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'خطا در ثبت رزرو');
    } finally {
      setLoading(false);
    }
  };

  if (!salon) return <div className="max-w-2xl mx-auto p-4 text-gray-500">در حال بارگذاری...</div>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-medium">{salon.name}</h1>
      <p className="text-sm text-gray-600 flex items-center gap-1 mt-1 mb-6">
        <MapPin className="w-3.5 h-3.5" />
        {salon.address}
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <h2 className="text-lg font-medium mb-3">انتخاب سرویس</h2>
      <div className="space-y-2 mb-6">
        {services.map((service) => (
          <label
            key={service._id}
            className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
              selectedServiceIds.includes(service._id) ? 'border-black bg-gray-50' : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedServiceIds.includes(service._id)}
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

      <div className="flex items-center justify-between border-t pt-4 mb-6">
        <span className="text-sm text-gray-600">جمع کل: {total.toLocaleString()} تومان</span>
      </div>

      {/* Chair / stylist selection, per the salon's management strategy */}
      {salon.management_mode === 'chair_based' && chairs.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">انتخاب صندلی (اختیاری)</label>
          <select
            value={selectedChairId}
            onChange={(e) => setSelectedChairId(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="">بدون ترجیح خاص</option>
            {chairs.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {salon.management_mode === 'stylist_based' && stylists.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">انتخاب آرایشگر (اختیاری)</label>
          <select
            value={selectedStylistId}
            onChange={(e) => setSelectedStylistId(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="">بدون ترجیح خاص</option>
            {stylists.map((s) => (
              <option key={s._id} value={s._id}>{s.full_name || s._id}</option>
            ))}
          </select>
        </div>
      )}

      {/* Date Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">انتخاب تاریخ</label>
        <PersianDatePicker selectedDate={selectedDate} onSelect={setSelectedDate} />
      </div>

      {/* Box (time-slot) selection - multi-select, click directly to reserve */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">
            انتخاب بازه‌های زمانی (هر بازه {salon.min_booking_interval} دقیقه) — تا {MAX_BOXES} بازه پیشنهادی می‌توانید انتخاب کنید
          </label>
          <span className="text-xs text-gray-500">{selectedBoxes.length} از {MAX_BOXES} انتخاب شده</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          بازه‌های خط‌خورده قبلاً تایید شده‌اند. آرایشگاه هر بازه پیشنهادی را که برایش امکان‌پذیر باشد تایید می‌کند.
        </p>
        <DayBoxGrid
          boxMinutes={salon.min_booking_interval}
          busyTimes={busyTimes}
          selected={selectedBoxes}
          onToggle={toggleBox}
        />
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">توضیحات (اختیاری)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none"
          placeholder="هر توضیحات خاصی که دارید..."
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading || selectedServiceIds.length === 0 || selectedBoxes.length === 0}
        className="w-full py-3 bg-black text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
      >
        {loading ? 'در حال ارسال...' : `ارسال ${selectedBoxes.length || ''} درخواست رزرو`.trim()}
      </button>
    </div>
  );
}
