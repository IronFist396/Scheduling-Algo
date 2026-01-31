/**
 * Calculate the actual calendar date for an interview based on day number
 * @param {number} dayNumber - Day number (1-based, where Day 1 = first Monday)
 * @param {string} scheduleStartDate - ISO date string (e.g., '2026-03-02')
 * @returns {Date} The actual date for this interview
 */
export function getInterviewDate(dayNumber, scheduleStartDate) {
  if (!scheduleStartDate) {
    throw new Error('scheduleStartDate is required');
  }
  const startDate = new Date(scheduleStartDate);
  
  // Calculate which week and day of week this is
  // Day 1-5 = Week 1 (Mon-Fri), Day 6-10 = Week 2, etc.
  const weekNumber = Math.ceil(dayNumber / 5);
  const dayOfWeek = ((dayNumber - 1) % 5); // 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri
  
  // Calculate calendar date: add (weekNumber-1) full weeks + dayOfWeek days
  const daysToAdd = (weekNumber - 1) * 7 + dayOfWeek;
  
  const interviewDate = new Date(startDate);
  interviewDate.setDate(startDate.getDate() + daysToAdd);
  
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
  
  // Calculate current week (considering 5-day weeks with weekends)
  // Week 1 = Days 0-4, Week 2 = Days 7-11, etc.
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
  const currentWeek = calculateCurrentWeek(scheduleStartDate);
  
  if (!currentWeek) {
    return 1; // Default to Day 1 if before start
  }
  
  const startDate = new Date(scheduleStartDate);
  const today = new Date();
  
  startDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysElapsed = Math.floor((today - startDate) / msPerDay);
  
  // Get day of week (0 = Sunday, 1 = Monday, etc.)
  const dayOfWeek = today.getDay();
  
  // If it's Saturday (6) or Sunday (0), use Friday of current week
  if (dayOfWeek === 6 || dayOfWeek === 0) {
    // Find Friday of the current calendar week
    const currentWeekStart = (currentWeek - 1) * 5 + 1;
    return currentWeekStart + 4; // Friday (5th day of week)
  }
  
  // Monday-Friday: Calculate the day within the working week
  const workingDayOfWeek = dayOfWeek - 1; // Mon=0, Tue=1, ..., Fri=4
  const currentWeekStart = (currentWeek - 1) * 5 + 1;
  
  return currentWeekStart + workingDayOfWeek;
}
