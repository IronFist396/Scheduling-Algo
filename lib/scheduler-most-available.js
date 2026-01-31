// Algorithm 2: Most Available First (Opposite of current)
// Schedules candidates with MORE available slots first

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

function calculateAvailabilityScore(candidate, oc1, oc2) {
  let totalSlots = 0;

  DAYS_OF_WEEK.forEach(day => {
    const candidateSlots = candidate.availability[day] || [];
    const oc1Slots = oc1.availability[day] || [];
    const oc2Slots = oc2.availability[day] || [];

    const commonSlots = candidateSlots.filter(
      slot => oc1Slots.includes(slot) && oc2Slots.includes(slot)
    );

    totalSlots += commonSlots.length;
  });

  return totalSlots;
}

function parseSlotTime(slot) {
  const timeMatch = slot.match(/^(\d+)(?::(\d+))?(AM|PM)/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const meridiem = timeMatch[3];

    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    return { hours, minutes };
  }
  return null;
}

function findAvailableSlotsForDay(candidate, oc1, oc2, bookedSlots, dayNumber) {
  const availableSlots = [];
  const dayOfWeek = DAYS_OF_WEEK[(dayNumber - 1) % 5];

  const candidateSlots = candidate.availability[dayOfWeek] || [];
  const oc1Slots = oc1.availability[dayOfWeek] || [];
  const oc2Slots = oc2.availability[dayOfWeek] || [];

  const commonSlots = candidateSlots.filter(
    slot => oc1Slots.includes(slot) && oc2Slots.includes(slot)
  );

  commonSlots.forEach(slot => {
    const slotKey = `day${dayNumber}-${slot}`;
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

  availableSlots.sort((a, b) => {
    if (!a.timeInfo || !b.timeInfo) return 0;
    if (a.timeInfo.hours !== b.timeInfo.hours) {
      return a.timeInfo.hours - b.timeInfo.hours;
    }
    return a.timeInfo.minutes - b.timeInfo.minutes;
  });

  return availableSlots;
}

function calculateScheduledTime(dayNumber, slot, startDate) {
  const firstMonday = new Date(startDate);
  const startDayOfWeek = firstMonday.getDay();
  
  let daysToMonday = 0;
  if (startDayOfWeek === 0) {
    daysToMonday = 1;
  } else if (startDayOfWeek > 1) {
    daysToMonday = 8 - startDayOfWeek;
  }
  
  firstMonday.setDate(firstMonday.getDate() + daysToMonday);
  
  const dayOfWeek = DAYS_OF_WEEK[(dayNumber - 1) % 5];
  const weekNumber = Math.floor((dayNumber - 1) / 5);
  const dayIndex = DAYS_OF_WEEK.indexOf(dayOfWeek);
  const calendarDayOffset = weekNumber * 7 + dayIndex;

  const scheduledDate = new Date(firstMonday);
  scheduledDate.setDate(scheduledDate.getDate() + calendarDayOffset);

  const timeInfo = parseSlotTime(slot);
  if (timeInfo) {
    // Set time in IST and convert to UTC (IST = UTC + 5:30)
    const istHours = timeInfo.hours;
    const istMinutes = timeInfo.minutes;
    
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
 * ALGORITHM 2: Most Available First
 * Schedules candidates with MORE slots first (opposite of current algorithm)
 * Theory: Flexible candidates can fit anywhere, schedule them early
 */
function scheduleInterviews(candidates, ocs, startDate = new Date('2025-03-01'), maxDays = 999) {
  if (ocs.length < 2) {
    throw new Error('At least 2 OCs are required for scheduling');
  }

  const [oc1, oc2] = ocs;
  const scheduledInterviews = [];
  const unscheduledCandidates = [];
  const bookedSlots = new Set();

  const scoredCandidates = candidates.map(candidate => ({
    candidate,
    availabilityScore: calculateAvailabilityScore(candidate, oc1, oc2),
  }));

  // DIFFERENT: Sort DESCENDING - most available first
  scoredCandidates.sort((a, b) => b.availabilityScore - a.availabilityScore);

  console.log(`\n📊 [ALGO 2: Most Available First] Scheduling ${candidates.length} candidates...`);
  console.log(`Availability scores range: ${scoredCandidates[scoredCandidates.length - 1]?.availabilityScore} - ${scoredCandidates[0]?.availabilityScore}\n`);

  let currentDay = 1;

  for (const { candidate, availabilityScore } of scoredCandidates) {
    let scheduled = false;

    if (availabilityScore === 0) {
      unscheduledCandidates.push({
        candidate,
        reason: 'No common available slots with both OCs',
        availabilityScore: 0,
      });
      continue;
    }

    for (let day = 1; day <= maxDays && !scheduled; day++) {
      const availableSlots = findAvailableSlotsForDay(candidate, oc1, oc2, bookedSlots, day);

      if (availableSlots.length > 0) {
        const selectedSlot = availableSlots[0];
        const { slot, slotKey, dayNumber } = selectedSlot;

        const startTime = calculateScheduledTime(dayNumber, slot, startDate);
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + 60);

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

  const daysUsed = Math.max(...scheduledInterviews.map(i => i.dayNumber), 0);
  const weeksUsed = Math.ceil(daysUsed / 5);

  const interviewsByDay = {};
  scheduledInterviews.forEach(interview => {
    const day = interview.dayNumber;
    if (!interviewsByDay[day]) interviewsByDay[day] = 0;
    interviewsByDay[day]++;
  });

  const stats = {
    algorithmName: 'Most Available First',
    totalCandidates: candidates.length,
    scheduled: scheduledInterviews.length,
    unscheduled: unscheduledCandidates.length,
    daysUsed,
    weeksUsed,
    scheduledInterviews,
    unscheduledCandidates,
    interviewsByDay,
  };

  console.log(`\n✅ [ALGO 2] Scheduling complete!`);
  console.log(`   Scheduled: ${stats.scheduled}/${stats.totalCandidates}`);
  console.log(`   Unscheduled: ${stats.unscheduled}`);
  console.log(`   Days used: ${stats.daysUsed} (${stats.weeksUsed} weeks)\n`);

  return stats;
}

module.exports = {
  scheduleInterviews,
  calculateAvailabilityScore,
  findAvailableSlotsForDay,
};
