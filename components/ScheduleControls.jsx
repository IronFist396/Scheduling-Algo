import { useState } from 'react';
import { calculateCurrentWeek, getInterviewDate } from '../lib/dateUtils';

export default function ScheduleControls({
  currentDay,
  setCurrentDay,
  selectedOC,
  setSelectedOC,
  ocs,
  maxWeek = 1, // Dynamic max week from actual scheduled interviews
  daysUsed = 0,
  weeksUsed = 0,
  scheduleStartDate = null, // Schedule start date for current week calculation
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  
  const weekNumber = Math.ceil(currentDay / 5);
  const weekStartDay = (weekNumber - 1) * 5 + 1;
  const weekEndDay = weekNumber * 5;

  // Calculate current week based on real calendar date
  const currentWeek = scheduleStartDate ? calculateCurrentWeek(scheduleStartDate) : null;
  const isCurrentWeek = currentWeek && weekNumber === currentWeek;

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

  const jumpToDate = () => {
    if (!selectedDate || !scheduleStartDate) return;
    
    const targetDate = new Date(selectedDate);
    const startDate = new Date(scheduleStartDate);
    
    // Calculate days elapsed
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysElapsed = Math.floor((targetDate - startDate) / msPerDay);
    
    if (daysElapsed < 0) {
      alert('Selected date is before the schedule start date!');
      return;
    }
    
    // Calculate which week this falls into
    const calendarWeeksElapsed = Math.floor(daysElapsed / 7);
    const targetWeek = calendarWeeksElapsed + 1;
    
    if (targetWeek > maxWeek) {
      alert(`Selected date is beyond the scheduled weeks (Week ${maxWeek} is the last week)`);
      return;
    }
    
    goToWeek(targetWeek);
    setShowDatePicker(false);
    setSelectedDate('');
  };

  const goToToday = () => {
    if (currentWeek && currentWeek <= maxWeek) {
      goToWeek(currentWeek);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        {/* Week Navigation */}
        <div className="flex items-center gap-4 flex-wrap">
          <label className="text-sm font-medium text-gray-700">
            Interview Week:
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousWeek}
              className="px-3 py-2 bg-blue-400 text-white rounded-lg hover:bg-blue-500 disabled:opacity-10 transition-colors"
              disabled={weekNumber === 1}
              title="Previous Week"
            >
              ←
            </button>
            <div className="px-4 py-2 bg-blue-50 text-blue-700 font-semibold rounded-lg">
              Week {weekNumber} {isCurrentWeek && <span className="text-green-600">(Current Week)</span>} (Days {weekStartDay}-{weekEndDay})
            </div>
            <button
              onClick={goToNextWeek}
              className="px-3 py-2 bg-blue-400 text-white rounded-lg hover:bg-blue-500 disabled:opacity-10 transition-colors"
              disabled={weekNumber === maxWeek}
              title="Next Week"
            >
              →
            </button>
          </div>

          {/* Quick Jump Dropdown */}
          <select
            value={weekNumber}
            onChange={(e) => goToWeek(parseInt(e.target.value))}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Array.from({ length: maxWeek }, (_, i) => i + 1).map((week) => (
              <option key={week} value={week}>
                Jump to Week {week}
              </option>
            ))}
          </select>

          {/* Calendar Date Picker Button */}
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="px-3 py-2 bg-purple-400 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            title="Jump to specific date"
          >
            <span>📅</span>
            <span className="text-sm font-medium">Jump to Date</span>
          </button>

          {/* Today Button */}
          {currentWeek && currentWeek <= maxWeek && !isCurrentWeek && (
            <button
              onClick={goToToday}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              title="Go to current week"
            >
              Go to Today
            </button>
          )}
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

      {/* Date Picker Modal */}
      {showDatePicker && (
        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">
              Select Date:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={jumpToDate}
              disabled={!selectedDate}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              Jump
            </button>
            <button
              onClick={() => {
                setShowDatePicker(false);
                setSelectedDate('');
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
          {scheduleStartDate && (
            <p className="text-xs text-gray-600 mt-2">
              Schedule runs from {new Date(scheduleStartDate).toLocaleDateString()} to Week {maxWeek}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
