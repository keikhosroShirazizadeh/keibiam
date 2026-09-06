const DAY_START_HOUR = 8;
const DAY_END_HOUR = 24;

export function buildDayBoxes(boxMinutes) {
  const boxes = [];
  for (let mins = DAY_START_HOUR * 60; mins < DAY_END_HOUR * 60; mins += boxMinutes) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    boxes.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  }
  return boxes;
}

/**
 * Renders one day divided into boxes of `boxMinutes` from 08:00 to 24:00.
 * Read-only preview when `onToggle` is omitted (SalonDetail); interactive
 * multi-select when provided (BookingPage). Busy boxes are never
 * selectable in either mode.
 */
export default function DayBoxGrid({ boxMinutes, busyTimes = [], selected = [], onToggle }) {
  const boxes = buildDayBoxes(boxMinutes);
  const busySet = new Set(busyTimes.map((t) => t.slice(0, 5)));

  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
      {boxes.map((time) => {
        const isBusy = busySet.has(time);
        const isSelected = selected.includes(time);

        let classes = 'p-2 rounded-lg text-sm border text-center transition-colors ';
        if (isBusy) {
          classes += 'bg-gray-100 text-gray-400 border-gray-100 cursor-not-allowed line-through';
        } else if (isSelected) {
          classes += 'bg-black text-white border-black';
        } else if (onToggle) {
          classes += 'hover:border-gray-400 cursor-pointer';
        } else {
          classes += 'text-gray-600';
        }

        return (
          <button
            key={time}
            type="button"
            disabled={isBusy || !onToggle}
            onClick={() => onToggle?.(time)}
            className={classes}
          >
            {time}
          </button>
        );
      })}
    </div>
  );
}
