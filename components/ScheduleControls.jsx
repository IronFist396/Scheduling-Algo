export default function ScheduleControls({
  currentDay,
  setCurrentDay,
  selectedOC,
  setSelectedOC,
  ocs,
}) {
  const weekNumber = Math.ceil(currentDay / 5);
  const weekStartDay = (weekNumber - 1) * 5 + 1;
  const weekEndDay = weekNumber * 5;
  const maxWeek = 32; // 157 days / 5 = ~32 weeks

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
              className="px-3 py-2 bg-blue-400 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={weekNumber === 1}
            >
              ←
            </button>
            <div className="px-4 py-2 bg-blue-50 text-blue-700 font-semibold rounded-lg">
              Week {weekNumber} (Days {weekStartDay}-{weekEndDay})
            </div>
            <button
              onClick={goToNextWeek}
              className="px-3 py-2 bg-blue-300 rounded-lg hover:bg-blue-400 disabled:opacity-50"
              disabled={weekNumber === maxWeek}
            >
              →
            </button>
          </div>
          <input
            type="number"
            min="1"
            max={maxWeek}
            value={weekNumber}
            onChange={(e) => goToWeek(Math.max(1, Math.min(maxWeek, parseInt(e.target.value) || 1)))}
            className="w-20 px-3 py-2 border rounded-lg"
            placeholder="Week"
          />
        </div>

        {/* OC Filter */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">
            View as OC:
          </label>
          <select
            value={selectedOC || ''}
            onChange={(e) => setSelectedOC(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-white"
          >
            <option value="">All OCs</option>
            {ocs.map((oc) => (
              <option key={oc.id} value={oc.id}>
                {oc.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
