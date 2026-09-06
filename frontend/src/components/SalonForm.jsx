import LocationPicker from './LocationPicker';

export default function SalonForm({ value, onChange, onSubmit, onCancel, submitLabel }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <input
        type="text"
        placeholder="نام آرایشگاه"
        value={value.name}
        onChange={set('name')}
        className="px-4 py-2 border rounded-lg"
        required
      />
      <input
        type="text"
        placeholder="آدرس"
        value={value.address}
        onChange={set('address')}
        className="px-4 py-2 border rounded-lg"
        required
      />
      <input
        type="text"
        placeholder="تلفن"
        value={value.phone}
        onChange={set('phone')}
        className="px-4 py-2 border rounded-lg"
        required
      />
      <select value={value.management_mode} onChange={set('management_mode')} className="px-4 py-2 border rounded-lg">
        <option value="chair_based">مدیریت صندلی‌محور</option>
        <option value="stylist_based">مدیریت آرایشگرمحور</option>
      </select>
      <div>
        <label className="block text-sm font-medium mb-1">اندازه هر بازه زمانی نوبت‌دهی</label>
        <select
          value={value.min_booking_interval}
          onChange={set('min_booking_interval')}
          className="w-full px-4 py-2 border rounded-lg"
        >
          <option value={15}>۱۵ دقیقه</option>
          <option value={30}>۳۰ دقیقه</option>
          <option value={60}>۶۰ دقیقه</option>
        </select>
      </div>
      <textarea
        placeholder="توضیحات"
        value={value.description}
        onChange={set('description')}
        className="px-4 py-2 border rounded-lg md:col-span-2 resize-none"
        rows={3}
      />
      <div className="md:col-span-2">
        <label className="block text-sm font-medium mb-2">موقعیت روی نقشه (برای انتخاب کلیک کنید)</label>
        <LocationPicker
          lat={value.lat}
          lng={value.lng}
          onChange={(lat, lng) => onChange({ ...value, lat, lng })}
        />
      </div>
      <div className="md:col-span-2 flex gap-2">
        <button type="submit" className="px-4 py-2 bg-black text-white rounded-lg">
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-lg hover:bg-gray-100">
          انصراف
        </button>
      </div>
    </form>
  );
}
