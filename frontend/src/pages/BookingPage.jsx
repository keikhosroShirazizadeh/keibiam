import { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { bookingApi } from '../api/bookings';
import { format, addDays } from 'date-fns';

export default function BookingPage() {
  const { salonId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { services, stylistId, chairId } = location.state || {};

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  // Generate time slots (9:00 to 21:00, 30 min intervals)
  const timeSlots = [];
  for (let h = 9; h < 21; h++) {
    for (let m of [0, 30]) {
      timeSlots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }

  // Generate next 90 days
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 90; i++) {
    dates.push(addDays(today, i));
  }

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) {
      setError('لطفاً تاریخ و ساعت را انتخاب کنید');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const startTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

      await bookingApi.create({
        salon_id: salonId,
        service_ids: services,
        booking_date: selectedDate,
        start_time: startTime,
        stylist_id: stylistId,
        chair_id: chairId,
        notes: notes || undefined,
      });

      alert('درخواست رزرو با موفقیت ارسال شد!');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'خطا در ثبت رزرو');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-medium mb-6">تکمیل رزرو</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
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
                onClick={() => setSelectedDate(dateStr)}
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

      {/* Time Selection */}
      {selectedDate && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">انتخاب ساعت</label>
          <div className="grid grid-cols-4 gap-2">
            {timeSlots.map((time) => (
              <button
                key={time}
                onClick={() => setSelectedTime(time)}
                className={`p-2 rounded-lg text-sm border transition-colors ${
                  selectedTime === time
                    ? 'bg-black text-white border-black'
                    : 'hover:border-gray-400'
                }`}
              >
                {time}
              </button>
            ))}
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
        disabled={loading || !selectedDate || !selectedTime}
        className="w-full py-3 bg-black text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
      >
        {loading ? 'در حال ارسال...' : 'ارسال درخواست رزرو'}
      </button>
    </div>
  );
}
