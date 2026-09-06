import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { salonApi } from '../api/salons';
import { chairApi } from '../api/chairs';
import { stylistApi } from '../api/stylists';
import { bookingApi } from '../api/bookings';
import { format, addDays } from 'date-fns';

const MAX_BOXES = 10;
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 21;

export default function BookingPage() {
  const { salonId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { services } = location.state || {};

  const [salon, setSalon] = useState(null);
  const [chairs, setChairs] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [selectedChairId, setSelectedChairId] = useState('');
  const [selectedStylistId, setSelectedStylistId] = useState('');

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedBoxes, setSelectedBoxes] = useState([]);
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
  }, [salonId]);

  if (!services || services.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-4 text-center">
        <p className="text-gray-600 mb-4">هیچ سرویسی انتخاب نشده</p>
        <button
          onClick={() => navigate(`/salon/${salonId}`)}
          className="px-4 py-2 bg-black text-white rounded-lg"
        >
          بازگشت به آرایشگاه
        </button>
      </div>
    );
  }

  const boxMinutes = salon?.min_booking_interval || 15;

  // Time boxes across the salon's booking-interval grid
  const timeSlots = [];
  for (let mins = DAY_START_HOUR * 60; mins < DAY_END_HOUR * 60; mins += boxMinutes) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    timeSlots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  }

  // Next 90 days
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 90; i++) {
    dates.push(addDays(today, i));
  }

  const toggleBox = (time) => {
    setSelectedBoxes((prev) => {
      if (prev.includes(time)) return prev.filter((t) => t !== time);
      if (prev.length >= MAX_BOXES) return prev;
      return [...prev, time];
    });
  };

  const handleSubmit = async () => {
    if (!selectedDate || selectedBoxes.length === 0) {
      setError('لطفاً تاریخ و حداقل یک بازه زمانی را انتخاب کنید');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await bookingApi.createBulk({
        salon_id: salonId,
        service_ids: services,
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

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-medium mb-2">تکمیل رزرو</h1>
      <p className="text-sm text-gray-500 mb-6">
        می‌توانید چند بازه زمانی پیشنهادی انتخاب کنید؛ آرایشگاه هرکدام را که برایش امکان‌پذیر باشد تایید می‌کند.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {/* Chair / stylist selection, per the salon's management strategy */}
      {salon?.management_mode === 'chair_based' && chairs.length > 0 && (
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

      {salon?.management_mode === 'stylist_based' && stylists.length > 0 && (
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
        <div className="grid grid-cols-7 gap-2 max-h-64 overflow-y-auto border rounded-lg p-2">
          {dates.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isSelected = selectedDate === dateStr;
            return (
              <button
                key={dateStr}
                onClick={() => { setSelectedDate(dateStr); setSelectedBoxes([]); }}
                className={`p-2 rounded-lg text-sm text-center transition-colors ${
                  isSelected
                    ? 'bg-black text-white'
                    : 'hover:bg-gray-100 border'
                }`}
              >
                <div className="text-xs">{format(day, 'EEEE')}</div>
                <div className="font-medium">{format(day, 'd')}</div>
                <div className="text-xs">{format(day, 'MMM')}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Box (time-slot) selection - multi-select */}
      {selectedDate && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">
              انتخاب بازه‌های زمانی پیشنهادی (هر بازه {boxMinutes} دقیقه)
            </label>
            <span className="text-xs text-gray-500">{selectedBoxes.length} از {MAX_BOXES} انتخاب شده</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {timeSlots.map((time) => {
              const isSelected = selectedBoxes.includes(time);
              return (
                <button
                  key={time}
                  onClick={() => toggleBox(time)}
                  className={`p-2 rounded-lg text-sm border transition-colors ${
                    isSelected
                      ? 'bg-black text-white border-black'
                      : 'hover:border-gray-400'
                  }`}
                >
                  {time}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
        disabled={loading || !selectedDate || selectedBoxes.length === 0}
        className="w-full py-3 bg-black text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
      >
        {loading ? 'در حال ارسال...' : `ارسال ${selectedBoxes.length || ''} درخواست رزرو`.trim()}
      </button>
    </div>
  );
}
