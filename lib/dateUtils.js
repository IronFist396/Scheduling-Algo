/**
 * Calculate the actual calendar date for an interview based on day number
 * @param {number} dayNumber - Day number (1-based, where Day 1 = scheduleStartDate)
 * @param {string} scheduleStartDate - ISO date string (e.g., '2026-03-02')
 * @returns {Date} The actual date for this interview
 */
export function getInterviewDate(dayNumber, scheduleStartDate) {
  if (!scheduleStartDate) {
    throw new Error('scheduleStartDate is required');
  }
  const startDate = new Date(scheduleStartDate);

  // Day 1 = startDate, Day 2 = startDate + 1, etc. No Monday-snapping.
  const interviewDate = new Date(startDate);
  interviewDate.setDate(startDate.getDate() + (dayNumber - 1));

  return interviewDate;
}

/**
 * Calculate which week we're currently in based on the schedule start date
 * @param {string} scheduleStartDate - ISO date string (e.g., '2026-03-02')
 * @returns {number} Current week number (1-based), or null if before start
 */
export function calculateCurrentWeek(scheduleStartDate) {
  if (!scheduleStartDate) return null;

  const startDate = new Date(scheduleStartDate);
  const today = new Date();
  
  // Reset times to midnight for accurate day comparison
  startDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  // If we're before the start date, return null
  if (today < startDate) {
    return null;
  }
  
  // Calculate days elapsed since start
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysElapsed = Math.floor((today - startDate) / msPerDay);
  
  // Calculate current week (7-day weeks including weekends)
  // Week 1 = Days 0-6, Week 2 = Days 7-13, etc.
  const calendarWeeksElapsed = Math.floor(daysElapsed / 7);
  const currentWeek = calendarWeeksElapsed + 1;
  
  return currentWeek;
}

/**
 * Calculate the current day number based on the schedule start date
 * @param {string} scheduleStartDate - ISO date string (e.g., '2026-03-02')
 * @returns {number} Current day number (1-based), or 1 if before start
 */
export function calculateCurrentDay(scheduleStartDate) {
  if (!scheduleStartDate) return 1;

  const startDate = new Date(scheduleStartDate);
  const today = new Date();

  startDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (today < startDate) return 1; // Before schedule starts

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysElapsed = Math.floor((today - startDate) / msPerDay);

  // Day 1 = startDate, Day 2 = startDate+1, etc.
  return daysElapsed + 1;
}
