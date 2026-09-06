import { useState, useEffect } from 'react';
import { bookingApi } from '../api/bookings';
import { useAuthStore } from '../store/authStore';
import BookingList from '../components/BookingList';
import { Calendar } from 'lucide-react';

export default function StylistDashboard() {
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const res = await bookingApi.getMineAsStylist();
      setBookings(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (bookingId, newStatus) => {
    try {
      await bookingApi.updateStatus(bookingId, newStatus);
      loadBookings();
    } catch (err) {
      alert('خطا در بروزرسانی نوبت');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="w-6 h-6" />
        <h1 className="text-2xl font-medium">برنامه من</h1>
      </div>
      <p className="text-gray-500 mb-6">خوش آمدید {user?.full_name}</p>

      {loading ? (
        <p className="text-gray-500">در حال بارگذاری...</p>
      ) : (
        <BookingList bookings={bookings} onStatusChange={handleStatusChange} />
      )}
    </div>
  );
}
