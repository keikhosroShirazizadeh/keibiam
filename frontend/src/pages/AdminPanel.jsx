import { useState, useEffect } from 'react';
import { salonApi } from '../api/salons';
import { adminApi } from '../api/admin';
import { fileUrl } from '../api/axiosConfig';
import { useAuthStore } from '../store/authStore';
import { Shield, Eye, EyeOff, CheckCircle, XCircle, Ban, Power, Search, User } from 'lucide-react';

const USER_ROLE_TABS = [
  { id: 'salon_owner', label: 'صاحبان آرایشگاه' },
  { id: 'stylist', label: 'آرایشگرها' },
  { id: 'customer', label: 'مشتریان' },
];

function SalonStatusBadge({ status }) {
  const labels = { active: 'فعال', pending: 'در انتظار', inactive: 'غیرفعال', rejected: 'رد شده' };
  const colors = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    inactive: 'bg-gray-100 text-gray-600',
    rejected: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  );
}

function SalonStatusActions({ salon, isSuperAdmin, onChange }) {
  if (!isSuperAdmin) return null;
  if (salon.status === 'pending') {
    return (
      <>
        <button
          onClick={() => onChange(salon._id, 'active', true)}
          className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
          title="فعال کردن"
        >
          <CheckCircle className="w-4 h-4" />
        </button>
        <button
          onClick={() => onChange(salon._id, 'rejected', false)}
          className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
          title="رد کردن"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </>
    );
  }
  if (salon.status === 'active') {
    return (
      <button
        onClick={() => onChange(salon._id, 'inactive', false)}
        className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
        title="غیرفعال کردن"
      >
        <Ban className="w-4 h-4" />
      </button>
    );
  }
  if (salon.status === 'inactive') {
    return (
      <button
        onClick={() => onChange(salon._id, 'active', true)}
        className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
        title="فعال کردن"
      >
        <Power className="w-4 h-4" />
      </button>
    );
  }
  return null;
}

export default function AdminPanel() {
  const { isSuperAdmin } = useAuthStore();
  const [topTab, setTopTab] = useState('salons');

  const [salons, setSalons] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const [userRoleTab, setUserRoleTab] = useState('salon_owner');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userDetail, setUserDetail] = useState(null);

  useEffect(() => {
    if (topTab === 'salons') loadSalons();
  }, [filter, topTab]);

  useEffect(() => {
    if (topTab !== 'users') return;
    setSelectedUserId('');
    setUserDetail(null);
  }, [topTab, userRoleTab]);

  useEffect(() => {
    if (topTab !== 'users') return;
    const t = setTimeout(() => loadUsers(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topTab, userRoleTab, search]);

  const loadSalons = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { status: filter } : {};
      const res = await salonApi.getAll({ ...params, limit: 100 });
      setSalons(res.data.salons);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      const res = await adminApi.listUsers(userRoleTab, search);
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleSelectUser = async (userId) => {
    setSelectedUserId(userId);
    try {
      const res = await adminApi.getUserDetail(userId);
      setUserDetail(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (salonId, newStatus, isVisible) => {
    try {
      await salonApi.updateStatus(salonId, newStatus, isVisible);
      loadSalons();
      if (selectedUserId) handleSelectUser(selectedUserId);
    } catch (err) {
      alert('خطا در بروزرسانی');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-6 h-6" />
        <h1 className="text-2xl font-medium">پنل مدیریت ادمین</h1>
      </div>

      {!isSuperAdmin() && (
        <div className="mb-4 p-3 bg-yellow-50 text-yellow-700 rounded-lg border border-yellow-200">
          شما دسترسی فقط-خواندنی دارید. نمی‌توانید تغییرات ایجاد کنید.
        </div>
      )}

      {/* Top-level tabs */}
      <div className="flex gap-4 border-b mb-6">
        {[
          { id: 'salons', label: 'آرایشگاه‌ها' },
          { id: 'users', label: 'کاربران' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTopTab(tab.id)}
            className={`pb-3 px-2 border-b-2 transition-colors ${
              topTab === tab.id
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {topTab === 'salons' && (
        <>
          {/* Filters */}
          <div className="flex gap-2 mb-6">
            {[
              { id: 'all', label: 'همه' },
              { id: 'pending', label: 'در انتظار' },
              { id: 'active', label: 'فعال' },
              { id: 'inactive', label: 'غیرفعال' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                  filter === f.id
                    ? 'bg-black text-white border-black'
                    : 'hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Salons Table */}
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">نام</th>
                  <th className="text-right px-4 py-3 font-medium">صاحب</th>
                  <th className="text-right px-4 py-3 font-medium">وضعیت</th>
                  <th className="text-right px-4 py-3 font-medium">نمایش</th>
                  <th className="text-right px-4 py-3 font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {salons.map((salon) => (
                  <tr key={salon._id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{salon.name}</div>
                      <div className="text-gray-500 text-xs">{salon.address}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{salon.owner_id}</td>
                    <td className="px-4 py-3"><SalonStatusBadge status={salon.status} /></td>
                    <td className="px-4 py-3">
                      {salon.is_visible ? (
                        <Eye className="w-4 h-4 text-green-600" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <SalonStatusActions salon={salon} isSuperAdmin={isSuperAdmin()} onChange={handleStatusChange} />
                      </div>
                    </td>
                  </tr>
                ))}
                {salons.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      آرایشگاهی یافت نشد
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {topTab === 'users' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            {/* Role tabs */}
            <div className="flex gap-2 mb-4">
              {USER_ROLE_TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setUserRoleTab(t.id)}
                  className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                    userRoleTab === t.id ? 'bg-black text-white border-black' : 'hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجو بر اساس نام، شماره موبایل یا کد ملی"
                className="w-full pr-9 pl-4 py-2 border rounded-lg text-sm"
              />
            </div>

            {/* User list */}
            <div className="border rounded-xl divide-y">
              {usersLoading && <div className="p-4 text-sm text-gray-500">در حال جستجو...</div>}
              {!usersLoading && users.length === 0 && (
                <div className="p-4 text-sm text-gray-500 text-center">کاربری یافت نشد</div>
              )}
              {users.map((u) => (
                <button
                  key={u._id}
                  onClick={() => handleSelectUser(u._id)}
                  className={`w-full text-right flex items-center gap-3 p-3 hover:bg-gray-50 ${
                    selectedUserId === u._id ? 'bg-gray-50' : ''
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                    {u.avatar_url ? (
                      <img src={fileUrl(u.avatar_url)} alt={u.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{u.full_name}</div>
                    <div className="text-xs text-gray-500">{u.phone}{u.national_code ? ` — ${u.national_code}` : ''}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detail panel */}
          <div>
            {!userDetail && (
              <div className="border rounded-xl p-6 text-center text-gray-500 text-sm">
                یک کاربر را انتخاب کنید
              </div>
            )}

            {userDetail && (
              <div className="border rounded-xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                    {userDetail.user.avatar_url ? (
                      <img
                        src={fileUrl(userDetail.user.avatar_url)}
                        alt={userDetail.user.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{userDetail.user.full_name}</div>
                    <div className="text-xs text-gray-500">{userDetail.user.email}</div>
                  </div>
                </div>

                <dl className="text-sm space-y-1 mb-4">
                  <div className="flex justify-between"><dt className="text-gray-500">موبایل</dt><dd>{userDetail.user.phone}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">کد ملی</dt><dd>{userDetail.user.national_code || '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">وضعیت حساب</dt><dd>{userDetail.user.is_active ? 'فعال' : 'غیرفعال'}</dd></div>
                </dl>

                {/* Salon owner: their salons, activate/deactivate */}
                {userDetail.salons && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">آرایشگاه‌ها</h3>
                    <div className="space-y-2">
                      {userDetail.salons.map((salon) => (
                        <div key={salon._id} className="border rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">{salon.name}</div>
                            <div className="text-xs text-gray-500">{salon.address}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <SalonStatusBadge status={salon.status} />
                            <SalonStatusActions salon={salon} isSuperAdmin={isSuperAdmin()} onChange={handleStatusChange} />
                          </div>
                        </div>
                      ))}
                      {userDetail.salons.length === 0 && (
                        <p className="text-sm text-gray-500">هنوز آرایشگاهی ثبت نکرده</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Stylist profile */}
                {userDetail.user.role === 'stylist' && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">پروفایل آرایشگر</h3>
                    {userDetail.stylist_profile ? (
                      <div className="text-sm space-y-2">
                        {userDetail.stylist_profile.bio && <p className="text-gray-600">{userDetail.stylist_profile.bio}</p>}
                        {userDetail.stylist_profile.specialties?.length > 0 && (
                          <p className="text-gray-600">تخصص‌ها: {userDetail.stylist_profile.specialties.join('، ')}</p>
                        )}
                        <div>
                          <span className="text-gray-500">آرایشگاه‌ها: </span>
                          {userDetail.stylist_profile.salons?.length > 0
                            ? userDetail.stylist_profile.salons.map((s) => s.name).join('، ')
                            : '—'}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">این آرایشگر هنوز به هیچ آرایشگاهی متصل نشده</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
