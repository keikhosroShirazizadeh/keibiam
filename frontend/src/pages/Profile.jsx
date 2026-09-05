import { useState } from 'react';
import { profileApi } from '../api/profile';
import { fileUrl } from '../api/axiosConfig';
import { useAuthStore } from '../store/authStore';
import { User, Upload } from 'lucide-react';

export default function Profile() {
  const { user, setUser } = useAuthStore();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const res = await profileApi.uploadAvatar(file);
      setUser(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'خطا در آپلود عکس');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 pt-12">
      <h1 className="text-2xl font-medium mb-6">پروفایل من</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col items-center gap-4 border rounded-xl p-6">
        <div className="w-28 h-28 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
          {user?.avatar_url ? (
            <img src={fileUrl(user.avatar_url)} alt={user.full_name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-12 h-12 text-gray-400" />
          )}
        </div>

        <div>
          <div className="font-medium text-lg text-center">{user?.full_name}</div>
          <div className="text-sm text-gray-500 text-center">{user?.email}</div>
        </div>

        <label className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 cursor-pointer text-sm">
          <Upload className="w-4 h-4" />
          {uploading ? 'در حال آپلود...' : 'تغییر عکس پروفایل'}
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
        </label>
      </div>
    </div>
  );
}
