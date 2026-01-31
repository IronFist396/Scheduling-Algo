// Interview Scheduling Algorithm
// Day-wise greedy scheduler with availability-first sorting

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

/**
 * Calculate the number of available slot-day combinations for a candidate
 */
function calculateAvailabilityScore(candidate, oc1, oc2) {
  let totalSlots = 0;

  DAYS_OF_WEEK.forEach(day => {
    const candidateSlots = candidate.availability[day] || [];
    const oc1Slots = oc1.availability[day] || [];
    const oc2Slots = oc2.availability[day] || [];

    // Find common slots (intersection)
    const commonSlots = candidateSlots.filter(
      slot => oc1Slots.includes(slot) && oc2Slots.includes(slot)
    );

    totalSlots += commonSlots.length;
  });

  return totalSlots;
}

/**
 * Parse time from slot string (e.g., "9:30AM-10:30AM" or "7PM-8:30PM")
 * Extracts the START time of the slot
 */
function parseSlotTime(slot) {
  // Match the START time (before the dash)
  // Handle both "7PM" and "7:00PM" formats
  const timeMatch = slot.match(/^(\d+)(?::(\d+))?(AM|PM)/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0; // Default to 0 if no minutes
    const meridiem = timeMatch[3];

    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    return { hours, minutes };
  }
  return null;
}

/**
 * Find available time slots for a candidate with both OCs on a specific day
 */
function findAvailableSlotsForDay(candidate, oc1, oc2, bookedSlots, dayNumber) {
  const availableSlots = [];
  const dayOfWeek = DAYS_OF_WEEK[(dayNumber - 1) % 5];

  const candidateSlots = candidate.availability[dayOfWeek] || [];
  const oc1Slots = oc1.availability[dayOfWeek] || [];
  const oc2Slots = oc2.availability[dayOfWeek] || [];

  // Find slots where all three are available
  const commonSlots = candidateSlots.filter(
    slot => oc1Slots.includes(slot) && oc2Slots.includes(slot)
  );

  commonSlots.forEach(slot => {
    const slotKey = `day${dayNumber}-${slot}`;
    // Check if slot is not already booked
    if (!bookedSlots.has(slotKey)) {
      const timeInfo = parseSlotTime(slot);
      availableSlots.push({ 
        slot, 
        slotKey, 
        dayNumber,
        dayOfWeek,
        timeInfo 
      });
    }
  });

  // Sort by time (earliest first)
  availableSlots.sort((a, b) => {
    if (!a.timeInfo || !b.timeInfo) return 0;
    if (a.timeInfo.hours !== b.timeInfo.hours) {
      return a.timeInfo.hours - b.timeInfo.hours;
    }
    return a.timeInfo.minutes - b.timeInfo.minutes;
  });

  return availableSlots;
}

/**
 * Convert day number and slot to a scheduled DateTime
 */
function calculateScheduledTime(dayNumber, slot, startDate) {
  // Find the first Monday on or after startDate
  const firstMonday = new Date(startDate);
  const startDayOfWeek = firstMonday.getDay(); // 0=Sunday, 1=Monday, etc.
  
  // Calculate days to add to get to Monday
  let daysToMonday = 0;
  if (startDayOfWeek === 0) { // Sunday
    daysToMonday = 1;
  } else if (startDayOfWeek > 1) { // Tuesday-Saturday
    daysToMonday = 8 - startDayOfWeek;
  }
  // If startDayOfWeek === 1 (Monday), daysToMonday = 0
  
  firstMonday.setDate(firstMonday.getDate() + daysToMonday);
  
  // Now calculate offset from first Monday
  const dayOfWeek = DAYS_OF_WEEK[(dayNumber - 1) % 5];
  const weekNumber = Math.floor((dayNumber - 1) / 5);
  const dayIndex = DAYS_OF_WEEK.indexOf(dayOfWeek);
  const calendarDayOffset = weekNumber * 7 + dayIndex;

  const scheduledDate = new Date(firstMonday);
  scheduledDate.setDate(scheduledDate.getDate() + calendarDayOffset);

  const timeInfo = parseSlotTime(slot);
  if (timeInfo) {
    // Set time in IST and convert to UTC (IST = UTC + 5:30)
    // Subtract 5 hours 30 minutes to get correct UTC time for IST
    const istHours = timeInfo.hours;
    const istMinutes = timeInfo.minutes;
    
    // Convert IST to UTC: subtract 5 hours 30 minutes
    let utcHours = istHours - 5;
    let utcMinutes = istMinutes - 30;
    
    if (utcMinutes < 0) {
      utcMinutes += 60;
      utcHours -= 1;
    }
    if (utcHours < 0) {
      utcHours += 24;
      scheduledDate.setDate(scheduledDate.getDate() - 1);
    }
    
    scheduledDate.setUTCHours(utcHours, utcMinutes, 0, 0);
  }

  return scheduledDate;
}

/**
 * Main scheduling algorithm - Day-wise approach
 * @param {Array} candidates - List of candidates to schedule
 * @param {Array} ocs - List of OCs (should be 2)
 * @param {Date} startDate - Starting date for scheduling
 * @param {Number} maxDays - Maximum number of days (unlimited by default)
 */
function scheduleInterviews(candidates, ocs, startDate = new Date(process.env.SCHEDULE_START_DATE), maxDays = 999) {
  if (ocs.length < 2) {
    throw new Error('At least 2 OCs are required for scheduling');
  }

  const [oc1, oc2] = ocs;
  const scheduledInterviews = [];
  const unscheduledCandidates = [];
  const bookedSlots = new Set();

  // Step 1: Score candidates by availability (fewer slots = higher priority)
  const scoredCandidates = candidates.map(candidate => ({
    candidate,
    availabilityScore: calculateAvailabilityScore(candidate, oc1, oc2),
  }));

  // Sort by availability score (ascending - fewer slots first)
  scoredCandidates.sort((a, b) => a.availabilityScore - b.availabilityScore);

  console.log(`\n📊 Scheduling ${candidates.length} candidates...`);
  console.log(`Availability scores range: ${scoredCandidates[0]?.availabilityScore} - ${scoredCandidates[scoredCandidates.length - 1]?.availabilityScore}\n`);

  // Step 2: Day-wise greedy scheduling
  let currentDay = 1;

  for (const { candidate, availabilityScore } of scoredCandidates) {
    let scheduled = false;

    // Handle candidates with NO common slots
    if (availabilityScore === 0) {
      unscheduledCandidates.push({
        candidate,
        reason: 'No common available slots with both OCs',
        availabilityScore: 0,
      });
      continue;
    }

    // Try to schedule starting from Day 1 (not just current day)
    for (let day = 1; day <= maxDays && !scheduled; day++) {
      const availableSlots = findAvailableSlotsForDay(candidate, oc1, oc2, bookedSlots, day);

      if (availableSlots.length > 0) {
        // Pick the earliest slot on this day
        const selectedSlot = availableSlots[0];
        const { slot, slotKey, dayNumber } = selectedSlot;

        // Calculate scheduled time
        const startTime = calculateScheduledTime(dayNumber, slot, startDate);
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + 60); // 60-minute duration

        // Book the slot
        bookedSlots.add(slotKey);

        scheduledInterviews.push({
          candidateId: candidate.id,
          oc1Id: oc1.id,
          oc2Id: oc2.id,
          startTime,
          endTime,
          dayNumber,
          status: 'SCHEDULED',
        });

        scheduled = true;
      }
    }

    if (!scheduled) {
      unscheduledCandidates.push({
        candidate,
        reason: 'Could not find available slot within scheduling period',
        availabilityScore,
      });
    }
  }

  // Calculate statistics
  const daysUsed = Math.max(...scheduledInterviews.map(i => i.dayNumber), 0);
  const weeksUsed = Math.ceil(daysUsed / 5);

  // Day-wise breakdown
  const interviewsByDay = {};
  scheduledInterviews.forEach(interview => {
    const day = interview.dayNumber;
    if (!interviewsByDay[day]) interviewsByDay[day] = 0;
    interviewsByDay[day]++;
  });

  const stats = {
    totalCandidates: candidates.length,
    scheduled: scheduledInterviews.length,
    unscheduled: unscheduledCandidates.length,
    daysUsed,
    weeksUsed,
    scheduledInterviews,
    unscheduledCandidates,
    interviewsByDay,
  };

  console.log(`\n✅ Scheduling complete!`);
  console.log(`   Scheduled: ${stats.scheduled}/${stats.totalCandidates}`);
  console.log(`   Unscheduled: ${stats.unscheduled}`);
  console.log(`   Days used: ${stats.daysUsed} (${stats.weeksUsed} weeks)\n`);

  // Show day-wise breakdown
  console.log('📅 Day-wise breakdown:');
  const sortedDays = Object.keys(interviewsByDay).sort((a, b) => parseInt(a) - parseInt(b));
  
  sortedDays.forEach(day => {
    const count = interviewsByDay[day];
    const dayNum = parseInt(day);
    const weekNum = Math.ceil(dayNum / 5);
    const dayOfWeek = DAYS_OF_WEEK[(dayNum - 1) % 5];
    console.log(`   Day ${day} (Week ${weekNum}, ${dayOfWeek}): ${count} interviews`);
  });
  console.log('');

  return stats;
}

module.exports = {
  scheduleInterviews,
  calculateAvailabilityScore,
  findAvailableSlotsForDay,
};
