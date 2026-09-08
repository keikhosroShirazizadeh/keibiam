import { useState, useEffect } from 'react';
import { salonApi } from '../api/salons';
import { bookingApi } from '../api/bookings';
import { stylistApi } from '../api/stylists';
import { chairApi } from '../api/chairs';
import { serviceApi } from '../api/services';
import { fileUrl } from '../api/axiosConfig';
import SalonForm from '../components/SalonForm';
import BookingList from '../components/BookingList';
import BookForCustomerForm from '../components/BookForCustomerForm';
import { Plus, Settings, Users, Calendar, Armchair, ImagePlus, Scissors } from 'lucide-react';

const SERVICE_TYPES = [
  { value: 'haircut', label: 'اصلاح مو' },
  { value: 'shave', label: 'اصلاح ریش' },
  { value: 'manicure', label: 'مانیکور' },
  { value: 'pedicure', label: 'پدیکور' },
  { value: 'coloring', label: 'رنگ مو' },
  { value: 'treatment', label: 'درمان مو' },
  { value: 'other', label: 'سایر' },
];

const TEHRAN = { lat: 35.6892, lng: 51.389 };

export default function SalonOwnerDashboard() {
  const [salons, setSalons] = useState([]);
  const [activeTab, setActiveTab] = useState('salons');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSalon, setNewSalon] = useState({
    name: '',
    address: '',
    phone: '',
    description: '',
    management_mode: 'chair_based',
    min_booking_interval: 15,
    lat: TEHRAN.lat,
    lng: TEHRAN.lng,
  });

  const [editingSalonId, setEditingSalonId] = useState('');
  const [editSalon, setEditSalon] = useState(null);

  const [selectedSalonId, setSelectedSalonId] = useState('');
  const [stylists, setStylists] = useState([]);
  const [showAddStylistForm, setShowAddStylistForm] = useState(false);
  const [stylistError, setStylistError] = useState('');
  const [newStylist, setNewStylist] = useState({
    full_name: '',
    email: '',
    phone: '',
    national_code: '',
    password: '',
    bio: '',
  });

  const [chairs, setChairs] = useState([]);
  const [showAddChairForm, setShowAddChairForm] = useState(false);
  const [chairError, setChairError] = useState('');
  const [newChair, setNewChair] = useState({ name: '', description: '' });

  const [services, setServices] = useState([]);
  const [showAddServiceForm, setShowAddServiceForm] = useState(false);
  const [serviceError, setServiceError] = useState('');
  const [newService, setNewService] = useState({
    name: '',
    type: 'haircut',
    description: '',
    duration_minutes: 30,
    ingredients: '',
    price: '',
  });

  const [bookings, setBookings] = useState([]);
  const [showBookForCustomer, setShowBookForCustomer] = useState(false);

  useEffect(() => {
    loadSalons();
  }, []);

  useEffect(() => {
    if (!selectedSalonId && salons.length > 0) {
      setSelectedSalonId(salons[0]._id);
    }
  }, [salons]);

  useEffect(() => {
    if (activeTab === 'stylists' && selectedSalonId) {
      loadStylists(selectedSalonId);
    }
    if (activeTab === 'chairs' && selectedSalonId) {
      loadChairs(selectedSalonId);
    }
    if (activeTab === 'bookings' && selectedSalonId) {
      loadBookings(selectedSalonId);
    }
    if (activeTab === 'services' && selectedSalonId) {
      loadServices(selectedSalonId);
    }
  }, [activeTab, selectedSalonId]);

  const loadSalons = async () => {
    try {
      const res = await salonApi.getMine();
      setSalons(res.data.salons);
    } catch (err) {
      console.error(err);
    }
  };

  const loadStylists = async (salonId) => {
    try {
      const res = await stylistApi.getBySalon(salonId);
      setStylists(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadChairs = async (salonId) => {
    try {
      const res = await chairApi.getBySalon(salonId);
      setChairs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadServices = async (salonId) => {
    try {
      const res = await serviceApi.getBySalon(salonId);
      setServices(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateService = async (e) => {
    e.preventDefault();
    setServiceError('');
    try {
      await serviceApi.create(selectedSalonId, {
        name: newService.name,
        type: newService.type,
        description: newService.description || undefined,
        duration_minutes: Number(newService.duration_minutes),
        ingredients: newService.ingredients
          .split(',')
          .map((i) => i.trim())
          .filter(Boolean),
        price: Number(newService.price),
      });
      setShowAddServiceForm(false);
      setNewService({ name: '', type: 'haircut', description: '', duration_minutes: 30, ingredients: '', price: '' });
      loadServices(selectedSalonId);
    } catch (err) {
      setServiceError(err.response?.data?.detail || 'خطا در ثبت سرویس');
    }
  };

  const loadBookings = async (salonId) => {
    try {
      const res = await bookingApi.getBySalon(salonId);
      setBookings(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBookingStatusChange = async (bookingId, newStatus) => {
    try {
      await bookingApi.updateStatus(bookingId, newStatus);
      loadBookings(selectedSalonId);
    } catch (err) {
      alert('خطا در بروزرسانی نوبت');
    }
  };

  const handleCreateStylist = async (e) => {
    e.preventDefault();
    setStylistError('');
    try {
      await stylistApi.createAccount(selectedSalonId, newStylist);
      setShowAddStylistForm(false);
      setNewStylist({ full_name: '', email: '', phone: '', password: '', bio: '' });
      loadStylists(selectedSalonId);
    } catch (err) {
      setStylistError(err.response?.data?.detail || 'خطا در ثبت آرایشگر');
    }
  };

  const handleCreateChair = async (e) => {
    e.preventDefault();
    setChairError('');
    try {
      await chairApi.create(selectedSalonId, newChair);
      setShowAddChairForm(false);
      setNewChair({ name: '', description: '' });
      loadChairs(selectedSalonId);
    } catch (err) {
      setChairError(err.response?.data?.detail || 'خطا در ثبت صندلی');
    }
  };

  const handleUploadChairImage = async (chairId, file) => {
    if (!file) return;
    try {
      await chairApi.uploadImage(chairId, file);
      loadChairs(selectedSalonId);
    } catch (err) {
      alert('خطا در آپلود عکس');
    }
  };

  const handleUploadSalonImage = async (salonId, file) => {
    if (!file) return;
    try {
      await salonApi.uploadImage(salonId, file);
      loadSalons();
    } catch (err) {
      alert('خطا در آپلود عکس');
    }
  };

  const handleEditClick = (salon) => {
    setEditingSalonId(salon._id);
    setEditSalon({
      name: salon.name,
      address: salon.address,
      phone: salon.phone,
      description: salon.description || '',
      management_mode: salon.management_mode,
      min_booking_interval: salon.min_booking_interval,
      lng: salon.location?.coordinates?.[0] ?? TEHRAN.lng,
      lat: salon.location?.coordinates?.[1] ?? TEHRAN.lat,
    });
  };

  const handleUpdateSalon = async (e) => {
    e.preventDefault();
    try {
      await salonApi.update(editingSalonId, {
        name: editSalon.name,
        address: editSalon.address,
        phone: editSalon.phone,
        description: editSalon.description,
        management_mode: editSalon.management_mode,
        min_booking_interval: Number(editSalon.min_booking_interval),
        location: { type: 'Point', coordinates: [editSalon.lng, editSalon.lat] },
      });
      setEditingSalonId('');
      setEditSalon(null);
      loadSalons();
    } catch (err) {
      alert('خطا در بروزرسانی آرایشگاه');
    }
  };

  const handleCreateSalon = async (e) => {
    e.preventDefault();
    try {
      await salonApi.create({
        name: newSalon.name,
        address: newSalon.address,
        phone: newSalon.phone,
        description: newSalon.description,
        management_mode: newSalon.management_mode,
        min_booking_interval: Number(newSalon.min_booking_interval),
        location: { type: 'Point', coordinates: [newSalon.lng, newSalon.lat] },
      });
      setShowCreateForm(false);
      setNewSalon({
        name: '', address: '', phone: '', description: '',
        management_mode: 'chair_based', min_booking_interval: 15,
        lat: TEHRAN.lat, lng: TEHRAN.lng,
      });
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
          <SalonForm
            value={newSalon}
            onChange={setNewSalon}
            onSubmit={handleCreateSalon}
            onCancel={() => setShowCreateForm(false)}
            submitLabel="ثبت"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b mb-6">
        {[
          { id: 'salons', label: 'آرایشگاه‌ها', icon: Settings },
          { id: 'services', label: 'سرویس‌ها', icon: Scissors },
          { id: 'stylists', label: 'آرایشگرها', icon: Users },
          { id: 'chairs', label: 'صندلی‌ها', icon: Armchair },
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
              {editingSalonId === salon._id ? (
                <>
                  <h3 className="font-medium text-lg mb-3">ویرایش {salon.name}</h3>
                  <SalonForm
                    value={editSalon}
                    onChange={setEditSalon}
                    onSubmit={handleUpdateSalon}
                    onCancel={() => { setEditingSalonId(''); setEditSalon(null); }}
                    submitLabel="ذخیره تغییرات"
                  />
                </>
              ) : (
                <>
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
                  <p className="text-sm text-gray-500 mb-1">{salon.description}</p>
                  <p className="text-xs text-gray-400 mb-3">بازه نوبت‌دهی: {salon.min_booking_interval} دقیقه</p>

                  <div className="flex gap-2 flex-wrap mb-3">
                    {salon.images?.map((img, i) => (
                      <img
                        key={i}
                        src={fileUrl(img)}
                        alt=""
                        className="w-16 h-16 object-cover rounded-lg border"
                      />
                    ))}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleEditClick(salon)}
                      className="text-sm px-3 py-1 border rounded-lg hover:bg-gray-50"
                    >
                      ویرایش
                    </button>
                    <button
                      onClick={() => { setSelectedSalonId(salon._id); setActiveTab('chairs'); }}
                      className="text-sm px-3 py-1 border rounded-lg hover:bg-gray-50"
                    >
                      مدیریت صندلی‌ها
                    </button>
                    <label className="flex items-center gap-1 text-sm px-3 py-1 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <ImagePlus className="w-3.5 h-3.5" />
                      افزودن عکس
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleUploadSalonImage(salon._id, e.target.files[0])}
                      />
                    </label>
                  </div>
                </>
              )}
            </div>
          ))}
          {salons.length === 0 && (
            <div className="col-span-2 text-center py-12 text-gray-500">
              هنوز آرایشگاهی ثبت نکرده‌اید
            </div>
          )}
        </div>
      )}

      {activeTab === 'services' && (
        <div>
          {salons.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              ابتدا یک آرایشگاه ثبت کنید
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4 gap-4">
                {salons.length > 1 ? (
                  <select
                    value={selectedSalonId}
                    onChange={(e) => setSelectedSalonId(e.target.value)}
                    className="px-4 py-2 border rounded-lg"
                  >
                    {salons.map((s) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm text-gray-600">{salons[0]?.name}</span>
                )}
                <button
                  onClick={() => setShowAddServiceForm(!showAddServiceForm)}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
                >
                  <Plus className="w-4 h-4" />
                  سرویس جدید
                </button>
              </div>

              {showAddServiceForm && (
                <div className="border rounded-xl p-6 mb-6 bg-gray-50">
                  <h2 className="text-lg font-medium mb-4">افزودن سرویس</h2>

                  {serviceError && (
                    <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">
                      {serviceError}
                    </div>
                  )}

                  <form onSubmit={handleCreateService} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="نام سرویس (مثلا: کوتاهی ساده)"
                      value={newService.name}
                      onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                      className="px-4 py-2 border rounded-lg"
                      required
                    />
                    <select
                      value={newService.type}
                      onChange={(e) => setNewService({ ...newService, type: e.target.value })}
                      className="px-4 py-2 border rounded-lg"
                    >
                      {SERVICE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="زمان تقریبی (دقیقه)"
                      value={newService.duration_minutes}
                      onChange={(e) => setNewService({ ...newService, duration_minutes: e.target.value })}
                      className="px-4 py-2 border rounded-lg"
                      min={15}
                      max={300}
                      required
                    />
                    <input
                      type="number"
                      placeholder="قیمت (تومان)"
                      value={newService.price}
                      onChange={(e) => setNewService({ ...newService, price: e.target.value })}
                      className="px-4 py-2 border rounded-lg"
                      min={0}
                      required
                    />
                    <textarea
                      placeholder="توضیح کوتاه (مثلا: فقط کوتاه کردن مو، بدون شست‌وشو)"
                      value={newService.description}
                      onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                      className="px-4 py-2 border rounded-lg md:col-span-2 resize-none"
                      rows={2}
                    />
                    <input
                      type="text"
                      placeholder="مواد مصرفی، با ویرگول جدا کنید (مثلا: ژل، واکس)"
                      value={newService.ingredients}
                      onChange={(e) => setNewService({ ...newService, ingredients: e.target.value })}
                      className="px-4 py-2 border rounded-lg md:col-span-2"
                    />
                    <div className="md:col-span-2 flex gap-2">
                      <button type="submit" className="px-4 py-2 bg-black text-white rounded-lg">
                        ثبت
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddServiceForm(false)}
                        className="px-4 py-2 border rounded-lg hover:bg-gray-100"
                      >
                        انصراف
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((service) => (
                  <div key={service._id} className="border rounded-xl p-4">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-medium">{service.name}</h3>
                      <span className="text-sm font-medium">{service.price?.toLocaleString()} تومان</span>
                    </div>
                    {service.description && (
                      <p className="text-sm text-gray-500 mb-1">{service.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mb-1">زمان تقریبی: {service.duration_minutes} دقیقه</p>
                    {service.ingredients?.length > 0 && (
                      <p className="text-xs text-gray-400">مواد مصرفی: {service.ingredients.join('، ')}</p>
                    )}
                  </div>
                ))}
                {services.length === 0 && (
                  <div className="col-span-2 text-center py-12 text-gray-500">
                    هنوز سرویسی برای این آرایشگاه ثبت نشده
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'stylists' && (
        <div>
          {salons.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              ابتدا یک آرایشگاه ثبت کنید
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4 gap-4">
                {salons.length > 1 ? (
                  <select
                    value={selectedSalonId}
                    onChange={(e) => setSelectedSalonId(e.target.value)}
                    className="px-4 py-2 border rounded-lg"
                  >
                    {salons.map((s) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm text-gray-600">{salons[0]?.name}</span>
                )}
                <button
                  onClick={() => setShowAddStylistForm(!showAddStylistForm)}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
                >
                  <Plus className="w-4 h-4" />
                  آرایشگر جدید
                </button>
              </div>

              {showAddStylistForm && (
                <div className="border rounded-xl p-6 mb-6 bg-gray-50">
                  <h2 className="text-lg font-medium mb-4">افزودن آرایشگر</h2>

                  {stylistError && (
                    <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">
                      {stylistError}
                    </div>
                  )}

                  <form onSubmit={handleCreateStylist} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="نام کامل"
                      value={newStylist.full_name}
                      onChange={(e) => setNewStylist({ ...newStylist, full_name: e.target.value })}
                      className="px-4 py-2 border rounded-lg"
                      required
                    />
                    <input
                      type="email"
                      placeholder="ایمیل"
                      value={newStylist.email}
                      onChange={(e) => setNewStylist({ ...newStylist, email: e.target.value })}
                      className="px-4 py-2 border rounded-lg"
                      required
                    />
                    <input
                      type="tel"
                      placeholder="شماره موبایل"
                      value={newStylist.phone}
                      onChange={(e) => setNewStylist({ ...newStylist, phone: e.target.value })}
                      className="px-4 py-2 border rounded-lg"
                      required
                    />
                    <input
                      type="text"
                      placeholder="کد ملی (اختیاری)"
                      value={newStylist.national_code}
                      onChange={(e) => setNewStylist({ ...newStylist, national_code: e.target.value })}
                      className="px-4 py-2 border rounded-lg"
                    />
                    <input
                      type="password"
                      placeholder="رمز عبور (حداقل ۶ کاراکتر)"
                      value={newStylist.password}
                      onChange={(e) => setNewStylist({ ...newStylist, password: e.target.value })}
                      className="px-4 py-2 border rounded-lg"
                      minLength={6}
                      required
                    />
                    <textarea
                      placeholder="بیوگرافی (اختیاری)"
                      value={newStylist.bio}
                      onChange={(e) => setNewStylist({ ...newStylist, bio: e.target.value })}
                      className="px-4 py-2 border rounded-lg md:col-span-2 resize-none"
                      rows={2}
                    />
                    <div className="md:col-span-2 flex gap-2">
                      <button type="submit" className="px-4 py-2 bg-black text-white rounded-lg">
                        ثبت
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddStylistForm(false)}
                        className="px-4 py-2 border rounded-lg hover:bg-gray-100"
                      >
                        انصراف
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stylists.map((stylist) => (
                  <div key={stylist._id} className="border rounded-xl p-4">
                    <h3 className="font-medium">{stylist.full_name || stylist.user_id}</h3>
                    {stylist.bio && <p className="text-sm text-gray-500 mt-1">{stylist.bio}</p>}
                  </div>
                ))}
                {stylists.length === 0 && (
                  <div className="col-span-2 text-center py-12 text-gray-500">
                    هنوز آرایشگری برای این آرایشگاه ثبت نشده
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'chairs' && (
        <div>
          {salons.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              ابتدا یک آرایشگاه ثبت کنید
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4 gap-4">
                {salons.length > 1 ? (
                  <select
                    value={selectedSalonId}
                    onChange={(e) => setSelectedSalonId(e.target.value)}
                    className="px-4 py-2 border rounded-lg"
                  >
                    {salons.map((s) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm text-gray-600">{salons[0]?.name}</span>
                )}
                <button
                  onClick={() => setShowAddChairForm(!showAddChairForm)}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
                >
                  <Plus className="w-4 h-4" />
                  صندلی جدید
                </button>
              </div>

              {showAddChairForm && (
                <div className="border rounded-xl p-6 mb-6 bg-gray-50">
                  <h2 className="text-lg font-medium mb-4">افزودن صندلی</h2>

                  {chairError && (
                    <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">
                      {chairError}
                    </div>
                  )}

                  <form onSubmit={handleCreateChair} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="نام صندلی (مثلا: صندلی ۱)"
                      value={newChair.name}
                      onChange={(e) => setNewChair({ ...newChair, name: e.target.value })}
                      className="px-4 py-2 border rounded-lg"
                      required
                    />
                    <input
                      type="text"
                      placeholder="توضیحات (اختیاری)"
                      value={newChair.description}
                      onChange={(e) => setNewChair({ ...newChair, description: e.target.value })}
                      className="px-4 py-2 border rounded-lg"
                    />
                    <div className="md:col-span-2 flex gap-2">
                      <button type="submit" className="px-4 py-2 bg-black text-white rounded-lg">
                        ثبت
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddChairForm(false)}
                        className="px-4 py-2 border rounded-lg hover:bg-gray-100"
                      >
                        انصراف
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {chairs.map((chair) => (
                  <div key={chair._id} className="border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                        {chair.image_url ? (
                          <img src={fileUrl(chair.image_url)} alt={chair.name} className="w-full h-full object-cover" />
                        ) : (
                          <Armchair className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{chair.name}</h3>
                        {chair.description && <p className="text-sm text-gray-500">{chair.description}</p>}
                        <label className="flex items-center gap-1 text-xs mt-2 text-black hover:underline cursor-pointer w-fit">
                          <ImagePlus className="w-3.5 h-3.5" />
                          افزودن عکس
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleUploadChairImage(chair._id, e.target.files[0])}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
                {chairs.length === 0 && (
                  <div className="col-span-2 text-center py-12 text-gray-500">
                    هنوز صندلی‌ای برای این آرایشگاه ثبت نشده
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'bookings' && (
        <div>
          {salons.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              ابتدا یک آرایشگاه ثبت کنید
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4 gap-4">
                {salons.length > 1 ? (
                  <select
                    value={selectedSalonId}
                    onChange={(e) => setSelectedSalonId(e.target.value)}
                    className="px-4 py-2 border rounded-lg"
                  >
                    {salons.map((s) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm text-gray-600">{salons[0]?.name}</span>
                )}
                <button
                  onClick={() => setShowBookForCustomer(!showBookForCustomer)}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
                >
                  <Plus className="w-4 h-4" />
                  رزرو برای مشتری
                </button>
              </div>

              {showBookForCustomer && selectedSalonId && (
                <div className="mb-6">
                  <BookForCustomerForm
                    salonId={selectedSalonId}
                    onBooked={() => { setShowBookForCustomer(false); loadBookings(selectedSalonId); }}
                  />
                </div>
              )}

              <BookingList bookings={bookings} onStatusChange={handleBookingStatusChange} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
