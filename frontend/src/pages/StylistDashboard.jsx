import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Calendar } from 'lucide-react';

export default function StylistDashboard() {
  const { user } = useAuthStore();

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="w-6 h-6" />
        <h1 className="text-2xl font-medium">برنامه من</h1>
      </div>
      <p className="text-gray-500">
        خوش آمدید {user?.full_name}. مدیریت برنامه کاری و نوبت‌ها در نسخه بعدی اضافه می‌شود.
      </p>
    </div>
  );
}
