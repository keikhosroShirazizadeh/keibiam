import { format, addDays } from 'date-fns';
import { formatJalali } from '../utils/jalali';

/**
 * Grid of the next `days` days, labeled in the Persian (Jalali) calendar.
 * The value passed to `onSelect` (and used as the selection key) is still
 * a plain Gregorian yyyy-MM-dd string - that's what the backend expects
 * and stores; only the display is Jalali.
 */
export default function PersianDatePicker({ selectedDate, onSelect, days = 90 }) {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    dates.push(addDays(today, i));
  }

  return (
    <div className="grid grid-cols-7 gap-2 max-h-64 overflow-y-auto border rounded-lg p-2">
      {dates.map((day) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const isSelected = selectedDate === dateStr;
        const { weekday, day: jDay, month } = formatJalali(day);
        return (
          <button
            key={dateStr}
            type="button"
            onClick={() => onSelect(dateStr)}
            className={`p-2 rounded-lg text-sm text-center transition-colors ${
              isSelected ? 'bg-black text-white' : 'hover:bg-gray-100 border'
            }`}
          >
            <div className="text-xs">{weekday}</div>
            <div className="font-medium">{jDay}</div>
            <div className="text-xs">{month}</div>
          </button>
        );
      })}
    </div>
  );
}
