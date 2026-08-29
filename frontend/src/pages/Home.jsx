import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { salonApi } from '../api/salons';
import { MapPin, Star, Scissors } from 'lucide-react';

export default function Home() {
  const [salons, setSalons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    salonApi
      .getAll({ limit: 50 })
      .then((res) => setSalons(res.data.salons))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-medium mb-6">آرایشگاه‌های فعال</h1>

      {loading && <p className="text-gray-500">در حال بارگذاری...</p>}

      {!loading && salons.length === 0 && (
        <p className="text-gray-500 text-center py-12">در حال حاضر آرایشگاهی برای نمایش وجود ندارد</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {salons.map((salon) => (
          <Link
            key={salon._id}
            to={`/salon/${salon._id}`}
            className="border rounded-xl p-4 hover:shadow-md transition-shadow"
          >
            <div className="w-full h-32 bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
              <Scissors className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-medium text-lg">{salon.name}</h3>
            <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5" />
              {salon.address}
            </p>
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
              <Star className="w-3.5 h-3.5" />
              {salon.rating?.toFixed?.(1) ?? '0.0'} ({salon.review_count ?? 0})
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
