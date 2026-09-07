import { toJalaali } from 'jalaali-js';

const WEEKDAYS_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
const MONTHS_FA = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];
const DIGITS_FA = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toFaDigits(value) {
  return String(value).replace(/[0-9]/g, (d) => DIGITS_FA[d]);
}

/** Gregorian JS Date -> { weekday, day, month, year } labels in Persian, for display only. */
export function formatJalali(date) {
  const { jy, jm, jd } = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return {
    weekday: WEEKDAYS_FA[date.getDay()],
    day: toFaDigits(jd),
    month: MONTHS_FA[jm - 1],
    year: toFaDigits(jy),
  };
}
