import { CheckCircle, XCircle, Ban, Clock } from 'lucide-react';

const STATUS_LABEL = {
  pending: 'در انتظار تایید',
  confirmed: 'تایید شده',
  rejected: 'رد شده',
  cancelled_by_customer: 'لغو شده توسط مشتری',
  cancelled_by_stylist: 'لغو شده توسط آرایشگاه',
  cancel_requested: 'درخواست لغو',
  completed: 'انجام شده',
};

const STATUS_COLOR = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled_by_customer: 'bg-gray-100 text-gray-600',
  cancelled_by_stylist: 'bg-gray-100 text-gray-600',
  cancel_requested: 'bg-orange-100 text-orange-700',
  completed: 'bg-blue-100 text-blue-700',
};

export default function BookingList({ bookings, onStatusChange, showCustomer = true }) {
  if (bookings.length === 0) {
    return <div className="text-center py-12 text-gray-500">نوبتی یافت نشد</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {bookings.map((booking) => (
        <div key={booking._id} className="border rounded-xl p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Clock className="w-3.5 h-3.5" />
              {booking.booking_date} — {booking.start_time?.slice(0, 5)}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLOR[booking.status] || 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABEL[booking.status] || booking.status}
            </span>
          </div>

          {showCustomer && booking.customer && (
            <p className="text-sm text-gray-600 mb-1">مشتری: {booking.customer.full_name}</p>
          )}

          {booking.services?.length > 0 && (
            <p className="text-sm text-gray-600 mb-1">
              {booking.services.map((s) => s.name).join('، ')}
            </p>
          )}

          <p className="text-sm text-gray-500 mb-3">{booking.total_price?.toLocaleString()} تومان</p>

          {booking.notes && <p className="text-xs text-gray-500 mb-3">{booking.notes}</p>}

          {booking.status === 'pending' && (
            <div className="flex gap-2">
              <button
                onClick={() => onStatusChange(booking._id, 'confirmed')}
                className="flex items-center gap-1 text-xs px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                تایید
              </button>
              <button
                onClick={() => onStatusChange(booking._id, 'rejected')}
                className="flex items-center gap-1 text-xs px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                <XCircle className="w-3.5 h-3.5" />
                رد کردن
              </button>
            </div>
          )}

          {booking.status === 'confirmed' && (
            <div className="flex gap-2">
              <button
                onClick={() => onStatusChange(booking._id, 'completed')}
                className="flex items-center gap-1 text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                انجام شد
              </button>
              <button
                onClick={() => onStatusChange(booking._id, 'cancelled_by_stylist')}
                className="flex items-center gap-1 text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
              >
                <Ban className="w-3.5 h-3.5" />
                لغو
              </button>
            </div>
          )}

          {booking.status === 'cancel_requested' && (
            <div className="flex gap-2">
              <button
                onClick={() => onStatusChange(booking._id, 'cancelled_by_stylist')}
                className="flex items-center gap-1 text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
              >
                <Ban className="w-3.5 h-3.5" />
                تایید لغو
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
