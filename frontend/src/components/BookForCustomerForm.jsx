import { useState, useEffect } from 'react';
import { usersApi } from '../api/users';
import { salonApi } from '../api/salons';
import { serviceApi } from '../api/services';
import { chairApi } from '../api/chairs';
import { stylistApi } from '../api/stylists';
import { bookingApi } from '../api/bookings';
import DayBoxGrid from './DayBoxGrid';
import PersianDatePicker from './PersianDatePicker';
import { format } from 'date-fns';
import { Search, UserCheck } from 'lucide-react';

const MAX_BOXES = 3;

/** Salon owner / stylist books a reservation directly for an existing
 * customer, found by phone or name. Bookings made this way are
 * auto-confirmed by the backend (no separate accept step needed). */
export default function BookForCustomerForm({ salonId, fixedStylistId, onBooked }) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [salon, setSalon] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);

  const [chairs, setChairs] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [selectedChairId, setSelectedChairId] = useState('');
  const [selectedStylistId, setSelectedStylistId] = useState(fixedStylistId || '');

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedBoxes, setSelectedBoxes] = useState([]);
  const [busyTimes, setBusyTimes] = useState([]);

  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!salonId) return;
    salonApi.getById(salonId).then((res) => {
      const s = res.data;
      setSalon(s);
      if (!fixedStylistId) {
        if (s.management_mode === 'chair_based') {
          chairApi.getBySalon(salonId).then((r) => setChairs(r.data));
        } else {
          stylistApi.getBySalon(salonId).then((r) => setStylists(r.data));
        }
      }
    });
    serviceApi.getBySalon(salonId).then((res) => setServices(res.data));
  }, [salonId, fixedStylistId]);

  useEffect(() => {
    if (!salonId) return;
    bookingApi.getAvailability(salonId, selectedDate).then((res) => {
      setBusyTimes(res.data.busy_times);
      const busy = new Set(res.data.busy_times.map((t) => t.slice(0, 5)));
      setSelectedBoxes((prev) => prev.filter((t) => !busy.has(t)));
    });
  }, [salonId, selectedDate]);

  useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomerResults([]);
      return;
    }
    const t = setTimeout(() => {
      usersApi.searchCustomers(customerSearch).then((res) => setCustomerResults(res.data));
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

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

  const resetForm = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setCustomerResults([]);
    setSelectedServiceIds([]);
    setSelectedBoxes([]);
    setNotes('');
  };

  const handleSubmit = async () => {
    if (!selectedCustomer) {
      setError('لطفاً یک مشتری انتخاب کنید');
      return;
    }
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
        customer_id: selectedCustomer._id,
        service_ids: selectedServiceIds,
        booking_date: selectedDate,
        start_times: selectedBoxes.map((t) => `${t}:00`),
        stylist_id: selectedStylistId || undefined,
        chair_id: selectedChairId || undefined,
        notes: notes || undefined,
      });

      resetForm();
      onBooked?.();
    } catch (err) {
      setError(err.response?.data?.detail || 'خطا در ثبت رزرو');
    } finally {
      setLoading(false);
    }
  };

  if (!salon) return null;

  return (
    <div className="border rounded-xl p-6 bg-gray-50 space-y-6">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Customer search */}
      <div>
        <label className="block text-sm font-medium mb-2">مشتری</label>
        {selectedCustomer ? (
          <div className="flex items-center justify-between p-3 border rounded-lg bg-white">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-green-600" />
              <div>
                <div className="text-sm font-medium">{selectedCustomer.full_name}</div>
                <div className="text-xs text-gray-500">{selectedCustomer.phone}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCustomer(null)}
              className="text-xs text-gray-500 hover:underline"
            >
              تغییر
            </button>
          </div>
        ) : (
          <div>
            <div className="relative">
              <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="جستجو با نام یا شماره موبایل"
                className="w-full pr-9 pl-4 py-2 border rounded-lg text-sm"
              />
            </div>
            {customerResults.length > 0 && (
              <div className="mt-2 border rounded-lg divide-y bg-white">
                {customerResults.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => { setSelectedCustomer(c); setCustomerResults([]); }}
                    className="w-full text-right p-2 text-sm hover:bg-gray-50"
                  >
                    {c.full_name} — {c.phone}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Services */}
      <div>
        <label className="block text-sm font-medium mb-2">سرویس</label>
        <div className="space-y-2">
          {services.map((service) => (
            <label
              key={service._id}
              className={`flex items-center justify-between p-2 border rounded-lg cursor-pointer bg-white ${
                selectedServiceIds.includes(service._id) ? 'border-black' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedServiceIds.includes(service._id)}
                  onChange={() => toggleService(service._id)}
                />
                <span className="text-sm">{service.name}</span>
              </div>
              <span className="text-xs text-gray-500">{service.price.toLocaleString()} تومان</span>
            </label>
          ))}
          {services.length === 0 && <p className="text-sm text-gray-500">سرویسی ثبت نشده است</p>}
        </div>
      </div>

      {/* Chair / stylist */}
      {!fixedStylistId && salon.management_mode === 'chair_based' && chairs.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2">صندلی (اختیاری)</label>
          <select value={selectedChairId} onChange={(e) => setSelectedChairId(e.target.value)} className="w-full px-4 py-2 border rounded-lg">
            <option value="">بدون ترجیح خاص</option>
            {chairs.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {!fixedStylistId && salon.management_mode === 'stylist_based' && stylists.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2">آرایشگر (اختیاری)</label>
          <select value={selectedStylistId} onChange={(e) => setSelectedStylistId(e.target.value)} className="w-full px-4 py-2 border rounded-lg">
            <option value="">بدون ترجیح خاص</option>
            {stylists.map((s) => <option key={s._id} value={s._id}>{s.full_name || s._id}</option>)}
          </select>
        </div>
      )}

      {/* Date */}
      <div>
        <label className="block text-sm font-medium mb-2">تاریخ</label>
        <PersianDatePicker selectedDate={selectedDate} onSelect={setSelectedDate} />
      </div>

      {/* Boxes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">بازه زمانی (هر بازه {salon.min_booking_interval} دقیقه)</label>
          <span className="text-xs text-gray-500">{selectedBoxes.length} از {MAX_BOXES}</span>
        </div>
        <DayBoxGrid
          boxMinutes={salon.min_booking_interval}
          busyTimes={busyTimes}
          selected={selectedBoxes}
          onToggle={toggleBox}
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium mb-2">توضیحات (اختیاری)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-4 py-2 border rounded-lg resize-none"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-2.5 bg-black text-white rounded-lg font-medium disabled:bg-gray-300"
      >
        {loading ? 'در حال ثبت...' : 'ثبت رزرو برای مشتری'}
      </button>
    </div>
  );
}
