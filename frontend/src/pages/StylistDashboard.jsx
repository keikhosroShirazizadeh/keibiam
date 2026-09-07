import { useState, useEffect } from 'react';
import { bookingApi } from '../api/bookings';
import { stylistApi } from '../api/stylists';
import { useAuthStore } from '../store/authStore';
import BookingList from '../components/BookingList';
import BookForCustomerForm from '../components/BookForCustomerForm';
import { Calendar, Plus } from 'lucide-react';

export default function StylistDashboard() {
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [stylistProfile, setStylistProfile] = useState(null);
  const [selectedSalonId, setSelectedSalonId] = useState('');
  const [showBookForCustomer, setShowBookForCustomer] = useState(false);

  useEffect(() => {
    loadBookings();
    stylistApi.getMe().then((res) => {
      setStylistProfile(res.data);
      if (res.data.salons?.length > 0) setSelectedSalonId(res.data.salons[0].id);
    }).catch(() => {});
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          <h1 className="text-2xl font-medium">برنامه من</h1>
        </div>
        {stylistProfile?.salons?.length > 0 && (
          <button
            onClick={() => setShowBookForCustomer(!showBookForCustomer)}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            <Plus className="w-4 h-4" />
            رزرو برای مشتری
          </button>
        )}
      </div>
      <p className="text-gray-500 mb-6">خوش آمدید {user?.full_name}</p>

      {stylistProfile?.salons?.length > 1 && (
        <div className="mb-4">
          <select
            value={selectedSalonId}
            onChange={(e) => setSelectedSalonId(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            {stylistProfile.salons.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {showBookForCustomer && selectedSalonId && stylistProfile && (
        <div className="mb-6">
          <BookForCustomerForm
            salonId={selectedSalonId}
            fixedStylistId={stylistProfile._id}
            onBooked={() => { setShowBookForCustomer(false); loadBookings(); }}
          />
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">در حال بارگذاری...</p>
      ) : (
        <BookingList bookings={bookings} onStatusChange={handleStatusChange} />
      )}
    </div>
  );
}
