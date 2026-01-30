export default function ScheduleControls({
  currentDay,
  setCurrentDay,
  selectedOC,
  setSelectedOC,
  ocs,
  maxWeek = 1, // Dynamic max week from actual scheduled interviews
  daysUsed = 0,
  weeksUsed = 0,
}) {
  const weekNumber = Math.ceil(currentDay / 5);
  const weekStartDay = (weekNumber - 1) * 5 + 1;
  const weekEndDay = weekNumber * 5;

  const goToPreviousWeek = () => {
    const prevWeekStartDay = Math.max(1, weekStartDay - 5);
    setCurrentDay(prevWeekStartDay);
  };

  const goToNextWeek = () => {
    const nextWeekStartDay = weekStartDay + 5;
    if (nextWeekStartDay <= maxWeek * 5) {
      setCurrentDay(nextWeekStartDay);
    }
  };

  const goToWeek = (week) => {
    const newDay = (week - 1) * 5 + 1;
    setCurrentDay(newDay);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        {/* Week Navigation */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">
            Interview Week:
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousWeek}
              className="px-3 py-2 bg-blue-400 rounded-lg hover:bg-blue-500 disabled:opacity-10"
              disabled={weekNumber === 1}
            >
              ←
            </button>
            <div className="px-4 py-2 bg-blue-50 text-blue-700 font-semibold rounded-lg">
              Week {weekNumber} (Days {weekStartDay}-{weekEndDay})
            </div>
            <button
              onClick={goToNextWeek}
              className="px-3 py-2 bg-blue-400 rounded-lg hover:bg-blue-500 disabled:opacity-10"
              disabled={weekNumber === maxWeek}
            >
              →
            </button>
          </div>
        </div>

        {/* Timeline Stats */}
        {daysUsed > 0 && (
          <div className="flex items-center gap-4 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📅</span>
              <div>
                <div className="text-xs text-gray-600 uppercase">Total Days</div>
                <div className="text-lg font-bold text-blue-700">{daysUsed}</div>
              </div>
            </div>
            <div className="h-8 w-px bg-blue-300"></div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📊</span>
              <div>
                <div className="text-xs text-gray-600 uppercase">Total Weeks</div>
                <div className="text-lg font-bold text-blue-700">{weeksUsed}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
