// Interview Scheduling Algorithm
// Two-panel scheduler: each panel = exactly 2 people, at least 1 SPMC.
//
// Panel priority order (per candidate, per slot):
//   1. SPMC + Reviewer          (preferred — frees the other SPMC for a concurrent panel)
//   2. SPMC + other SPMC        (last resort — both SMPCs consumed, no concurrency possible)
//   Solo SPMC panels are NOT allowed — every interview must have exactly 2 interviewers.
//
// Concurrency is naturally enforced by personBookings alone:
// if Sara is booked in a slot, she cannot be assigned to any second panel in that slot.
// A both-SPMC panel books both, so no concurrent panel is possible.

// Maps JS getDay() value (0=Sun, 1=Mon, ..., 6=Sat) to availability key
const JS_TO_DAY_NAME = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// All 7 day names in order (Mon–Sun) — used only for score iteration
const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * Returns the availability key ('monday', 'tuesday', ...) for a given dayNumber
 * relative to the schedule startDate. Day 1 = startDate, Day 2 = startDate+1, etc.
 */
function getDayName(dayNumber, startDate) {
  const d = new Date(startDate);
  d.setDate(d.getDate() + (dayNumber - 1));
  return JS_TO_DAY_NAME[d.getDay()];
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

function calculateScheduledTime(dayNumber, slot, startDate) {
  // Day 1 = startDate, Day 2 = startDate + 1, etc. No Monday-snapping.
  const scheduledDate = new Date(startDate);
  scheduledDate.setDate(scheduledDate.getDate() + (dayNumber - 1));

  const timeInfo = parseSlotTime(slot);
  if (timeInfo) {
    let utcHours = timeInfo.hours - 5;
    let utcMinutes = timeInfo.minutes - 30;
    if (utcMinutes < 0) { utcMinutes += 60; utcHours -= 1; }
    if (utcHours < 0) { utcHours += 24; scheduledDate.setDate(scheduledDate.getDate() - 1); }
    scheduledDate.setUTCHours(utcHours, utcMinutes, 0, 0);
  }
  return scheduledDate;
}

function calculateAvailabilityScore(candidate, spmcs, reviewers, startDate, maxDays) {
  let totalSlots = 0;
  // Score over a 60-day window for performance; we only need a relative ordering
  const scoreDays = Math.min(maxDays, 60);

  for (let day = 1; day <= scoreDays; day++) {
    // Skip blocked calendar dates — they contribute 0 to the score
    const blockedDates = candidate.blockedDates || [];
    if (blockedDates.length > 0) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + (day - 1));
      if (blockedDates.includes(d.toISOString().slice(0, 10))) continue;
    }

    const dayOfWeek = getDayName(day, startDate);
    const candidateSlots = candidate.availability[dayOfWeek] || [];

    spmcs.forEach(spmc => {
      const spmcSlots = spmc.availability[dayOfWeek] || [];
      const withSpmc = candidateSlots.filter(s => spmcSlots.includes(s));

      // Tier 1: SPMC + Reviewer slots (highest weight)
      reviewers.forEach(reviewer => {
        const reviewerSlots = reviewer.availability[dayOfWeek] || [];
        totalSlots += withSpmc.filter(s => reviewerSlots.includes(s)).length * 10;
      });
    });

    // Tier 2: both-SPMC slots (lowest weight — last resort)
    if (spmcs.length >= 2) {
      const slotsA = spmcs[0].availability[dayOfWeek] || [];
      const slotsB = spmcs[1].availability[dayOfWeek] || [];
      const candidateSlotsDay = candidate.availability[dayOfWeek] || [];
      const bothSpmcOverlap = candidateSlotsDay.filter(s => slotsA.includes(s) && slotsB.includes(s));
      totalSlots += bothSpmcOverlap.length * 1;
    }
  }

  return totalSlots;
}

function scheduleInterviews(
  candidates,
  spmcs,
  reviewers = [],
  startDate = new Date(process.env.SCHEDULE_START_DATE),
  maxDays = 999
) {
  if (spmcs.length < 2) {
    throw new Error('At least 2 SPMCs (OCs) are required for scheduling');
  }

  const [spmcA, spmcB] = spmcs;

  const scheduledInterviews = [];
  const unscheduledCandidates = [];

  // Single booking tracker: "<personId>-day<N>-<slot>"
  // Covers all 4 interviewers. Concurrency is naturally enforced —
  // if an SPMC is already booked in a slot, they can't be assigned to a second panel.
  const personBookings = new Set();

  function isPersonFree(personId, dayNumber, slot) {
    return !personBookings.has(`${personId}-day${dayNumber}-${slot}`);
  }
  function bookPerson(personId, dayNumber, slot) {
    personBookings.add(`${personId}-day${dayNumber}-${slot}`);
  }

  function findPanelForCandidateOnDay(candidate, dayNumber) {
    // Check if the candidate has blocked this specific calendar date
    const blockedDates = candidate.blockedDates || [];
    if (blockedDates.length > 0) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + (dayNumber - 1));
      const isoDate = d.toISOString().slice(0, 10); // "YYYY-MM-DD"
      if (blockedDates.includes(isoDate)) return null;
    }

    const dayOfWeek = getDayName(dayNumber, startDate);
    const candidateSlots = candidate.availability[dayOfWeek] || [];

    // --- Tier 1: SPMC + Reviewer (preferred) ---
    const tier1 = [];
    for (const spmc of spmcs) {
      const spmcSlots = spmc.availability[dayOfWeek] || [];
      for (const reviewer of reviewers) {
        const reviewerSlots = reviewer.availability[dayOfWeek] || [];
        const commonSlots = candidateSlots.filter(slot =>
          spmcSlots.includes(slot) && reviewerSlots.includes(slot)
        );
        for (const slot of commonSlots) {
          if (!isPersonFree(spmc.id, dayNumber, slot)) continue;
          if (!isPersonFree(reviewer.id, dayNumber, slot)) continue;
          tier1.push({ spmc, partner: reviewer, slot, panelType: 'SPMC+Reviewer' });
        }
      }
    }
    if (tier1.length > 0) {
      // prefer earliest slot
      tier1.sort((a, b) => {
        const tA = parseSlotTime(a.slot);
        const tB = parseSlotTime(b.slot);
        return (tA.hours * 60 + tA.minutes) - (tB.hours * 60 + tB.minutes);
      });
      return tier1[0];
    }

    // --- Tier 2: SPMC + other SPMC (last resort — no concurrent panel possible this slot) ---
    const [spmcA, spmcB] = spmcs;
    const spmcASlots = spmcA.availability[dayOfWeek] || [];
    const spmcBSlots = spmcB.availability[dayOfWeek] || [];
    const bothSpmcSlots = candidateSlots.filter(slot =>
      spmcASlots.includes(slot) && spmcBSlots.includes(slot)
    );
    const tier2 = [];
    for (const slot of bothSpmcSlots) {
      if (!isPersonFree(spmcA.id, dayNumber, slot)) continue;
      if (!isPersonFree(spmcB.id, dayNumber, slot)) continue;
      tier2.push({ spmc: spmcA, partner: spmcB, slot, panelType: 'SPMC+SPMC' });
    }
    if (tier2.length > 0) {
      tier2.sort((a, b) => {
        const tA = parseSlotTime(a.slot);
        const tB = parseSlotTime(b.slot);
        return (tA.hours * 60 + tA.minutes) - (tB.hours * 60 + tB.minutes);
      });
      return tier2[0];
    }

    return null;
  }

  const scoredCandidates = candidates.map(candidate => ({
    candidate,
    availabilityScore: calculateAvailabilityScore(candidate, spmcs, reviewers, startDate, maxDays),
  })).sort((a, b) => a.availabilityScore - b.availabilityScore);

  console.log(`\n[Scheduler] Two-Panel Scheduling: ${candidates.length} candidates...`);
  console.log(`   SPMCs: ${spmcs.map(s => s.name).join(', ')}`);
  console.log(`   Reviewers: ${reviewers.map(r => r.name).join(', ') || 'none'}\n`);

  for (const { candidate, availabilityScore } of scoredCandidates) {
    if (availabilityScore === 0) {
      unscheduledCandidates.push({ candidate, reason: 'No overlapping slots with any interviewer within the scheduling window', availabilityScore: 0 });
      continue;
    }

    let scheduled = false;

    for (let day = 1; day <= maxDays && !scheduled; day++) {
      const panel = findPanelForCandidateOnDay(candidate, day);
      if (!panel) continue;

      const { spmc, partner, slot, panelType } = panel;
      const isBothSpmc = panelType === 'SPMC+SPMC';

      // Book both panel members — this alone enforces all concurrency constraints
      bookPerson(spmc.id, day, slot);
      bookPerson(partner.id, day, slot);

      const startTime = calculateScheduledTime(day, slot, startDate);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      // For DB: oc1 = active SPMC, oc2 = other SPMC (always stored for schema compat)
      // reviewer1Id = reviewer if SPMC+Reviewer panel, null if SPMC+SPMC panel
      const otherSpmc = isBothSpmc ? partner : spmcs.find(s => s.id !== spmc.id);

      scheduledInterviews.push({
        candidateId: candidate.id,
        oc1Id: spmc.id,
        oc2Id: otherSpmc.id,
        reviewer1Id: isBothSpmc ? null : partner.id,
        reviewer2Id: null,
        startTime,
        endTime,
        dayNumber: day,
        status: 'SCHEDULED',
        panelId: `${spmc.name}+${partner.name}`,
      });

      scheduled = true;
    }

    if (!scheduled) {
      unscheduledCandidates.push({ candidate, reason: 'No slot found in scheduling period', availabilityScore });
    }
  }

  const daysUsed = scheduledInterviews.length > 0
    ? Math.max(...scheduledInterviews.map(i => i.dayNumber))
    : 0;
  const weeksUsed = Math.ceil(daysUsed / 7);

  const interviewsByDay = {};
  scheduledInterviews.forEach(i => {
    interviewsByDay[i.dayNumber] = (interviewsByDay[i.dayNumber] || 0) + 1;
  });

  const slotConcurrency = {};
  scheduledInterviews.forEach(i => {
    const key = `day${i.dayNumber}-${i.startTime.toISOString()}`;
    slotConcurrency[key] = (slotConcurrency[key] || 0) + 1;
  });
  const concurrentSlots = Object.values(slotConcurrency).filter(v => v > 1).length;

  const stats = {
    totalCandidates: candidates.length,
    scheduled: scheduledInterviews.length,
    unscheduled: unscheduledCandidates.length,
    daysUsed,
    weeksUsed,
    scheduledInterviews,
    unscheduledCandidates,
    interviewsByDay,
    concurrentSlots,
  };

  console.log(`\n[Scheduler] Done! Scheduled: ${stats.scheduled}/${stats.totalCandidates}`);
  console.log(`   Days: ${daysUsed} (${weeksUsed} weeks), Concurrent slots: ${concurrentSlots}\n`);

  Object.keys(interviewsByDay).sort((a, b) => parseInt(a) - parseInt(b)).forEach(day => {
    const w = Math.ceil(parseInt(day) / 7);
    const d = getDayName(parseInt(day), startDate);
    console.log(`   Day ${day} (Week ${w}, ${d}): ${interviewsByDay[day]} interview(s)`);
  });

  return stats;
}

module.exports = {
  scheduleInterviews,
  calculateAvailabilityScore,
  calculateScheduledTime,
  parseSlotTime,
};
