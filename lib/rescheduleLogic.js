// Reschedule Logic
//
// Two-tier strategy:
//   Tier 1 — Same-slot swap with a future-week candidate
//             (same weekday + same time = availability guaranteed, zero disruption)
//   Tier 2 — Backfill vacated slot + partial rebuild from next week
//             Current week untouched. Vacated slot gets one backfill attempt
//             before the scheduler rebuilds Week N+1 onwards.
//
// Also exports: applyWeekendOverride
//   Applies a per-date weekend time window override by moving only the trimmed
//   interviews (those outside the new window) to new slots appended after the
//   last scheduled day. Everything else is untouched.

import { prisma } from './prisma';
import { scheduleInterviews, parseSlotTime, calculateScheduledTime } from './scheduler';

// Ordered slot list — mirrors scheduler.js ALL_SLOTS_ORDERED
const ALL_SLOTS_ORDERED = [
  '9:30AM-10:30AM', '10:30AM-11:30AM', '11:30AM-12:30PM', '12:30PM-2PM',
  '2PM-3:30PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM',
  '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM',
];

// Maps JS getDay() (0=Sun … 6=Sat) to availability key — mirrors scheduler.js
const JS_TO_DAY_NAME = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Returns the ISO date string ("YYYY-MM-DD") for a given dayNumber
 * relative to SCHEDULE_START_DATE. Day 1 = startDate, Day 2 = startDate+1, etc.
 */
function getIsoDateForDay(dayNumber) {
  const d = new Date(process.env.SCHEDULE_START_DATE);
  d.setDate(d.getDate() + (dayNumber - 1));
  return d.toISOString().slice(0, 10);
}

/**
 * Returns true if the candidate has this calendar date blocked.
 */
function isCandidateBlocked(candidate, dayNumber) {
  const blockedDates = candidate.blockedDates || [];
  if (blockedDates.length === 0) return false;
  return blockedDates.includes(getIsoDateForDay(dayNumber));
}

/**
 * Loop guard: prevent A->B->A swaps within 24 hours
 */
async function checkForLoop(interviewId, candidateId) {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    select: { lastRescheduledFrom: true, lastRescheduledAt: true },
  });
  if (!interview) return false;
  if (
    interview.lastRescheduledFrom === candidateId &&
    interview.lastRescheduledAt &&
    Date.now() - new Date(interview.lastRescheduledAt).getTime() < 24 * 60 * 60 * 1000
  ) {
    return true;
  }
  return false;
}

/**
 * Tier 1: Same-slot swap with a future-week candidate.
 *
 * Since availability repeats weekly, if candidate B is scheduled on the same
 * weekday and time as candidate A but in a future week, they are guaranteed
 * to be available in A's slot (and vice versa). No availability re-check needed.
 *
 * We pick the candidate from the EARLIEST future week to minimise schedule extension.
 */
async function trySwap(interview) {
  // Which day-of-week (0=Sun … 6=Sat, via JS Date) is the original interview?
  const startDate = new Date(process.env.SCHEDULE_START_DATE);
  const originalDate = new Date(startDate);
  originalDate.setDate(originalDate.getDate() + (interview.dayNumber - 1));
  const targetDayOfWeek = originalDate.getDay(); // JS getDay() value

  const interviewHour = new Date(interview.startTime).getUTCHours();
  const interviewMin  = new Date(interview.startTime).getUTCMinutes();
  const currentWeekEnd = Math.ceil(interview.dayNumber / 7) * 7;

  // Find all future scheduled interviews (include blockedDates for the check)
  const futureCandidates = await prisma.interview.findMany({
    where: {
      dayNumber: { gt: currentWeekEnd },
      status: 'SCHEDULED',
      isCompleted: false,
    },
    include: {
      candidate: { select: { id: true, name: true, blockedDates: true } },
    },
    orderBy: { dayNumber: 'asc' }, // earliest future week first
  });

  for (const future of futureCandidates) {
    // Must be same day-of-week (derived from calendar date, not modulo)
    const futureDate2 = new Date(startDate);
    futureDate2.setDate(futureDate2.getDate() + (future.dayNumber - 1));
    if (futureDate2.getDay() !== targetDayOfWeek) continue;

    // Must be same time slot
    const futureDate = new Date(future.startTime);
    if (
      futureDate.getUTCHours()   !== interviewHour ||
      futureDate.getUTCMinutes() !== interviewMin
    ) continue;

    // The displaced candidate (interview.candidate) must not have the future date blocked
    if (isCandidateBlocked(interview.candidate, future.dayNumber)) continue;

    // The swap target candidate must not have the original interview's date blocked
    if (isCandidateBlocked(future.candidate, interview.dayNumber)) continue;

    // Loop guard
    const isLoop = await checkForLoop(interview.id, future.candidateId);
    if (isLoop) continue;

    return future; // first valid match
  }

  return null;
}

/**
 * Tier 2 — Step A: Backfill the vacated slot.
 *
 * Slot X (Week N) is now empty. Before rebuilding future weeks, try to fill it
 * with a candidate from the rebuild pool (displaced + PENDING) whose weekly
 * availability includes that weekday+time slot string.
 *
 * The panel (SMPC + reviewer) already on slot X is reused as-is — no panel
 * re-composition needed.
 *
 * Returns the candidate assigned (or null if no one fits), and mutates the
 * pool array by removing the assigned candidate.
 */
function backfillVacatedSlot(vacatedInterview, pool) {
  // Derive the real weekday from the calendar date (not % 5)
  const startDate = new Date(process.env.SCHEDULE_START_DATE);
  const vacatedDate = new Date(startDate);
  vacatedDate.setDate(vacatedDate.getDate() + (vacatedInterview.dayNumber - 1));
  const dayOfWeek = JS_TO_DAY_NAME[vacatedDate.getDay()];

  // Reconstruct the slot string from the stored startTime (UTC -> IST)
  const utcHours = new Date(vacatedInterview.startTime).getUTCHours();
  const utcMins  = new Date(vacatedInterview.startTime).getUTCMinutes();
  let istHours = utcHours + 5;
  let istMins  = utcMins  + 30;
  if (istMins >= 60) { istMins -= 60; istHours += 1; }
  if (istHours >= 24)  istHours -= 24;

  const meridiem = istHours >= 12 ? 'PM' : 'AM';
  const displayHour = istHours > 12 ? istHours - 12 : (istHours === 0 ? 12 : istHours);
  const timePrefix = istMins === 0
    ? `${displayHour}${meridiem}`
    : `${displayHour}:${String(istMins).padStart(2,'0')}${meridiem}`;

  // Find the matching slot string from the candidate's availability
  // (slot strings start with the time prefix, e.g. "9:30AM-10:30AM")
  for (let i = 0; i < pool.length; i++) {
    const candidate = pool[i];

    // Skip if the candidate has this calendar date blocked
    if (isCandidateBlocked(candidate, vacatedInterview.dayNumber)) continue;

    const daySlots = (candidate.availability && candidate.availability[dayOfWeek]) || [];
    const matchingSlot = daySlots.find(s => s.startsWith(timePrefix));
    if (matchingSlot) {
      pool.splice(i, 1); // remove from pool
      return candidate;
    }
  }
  return null;
}

/**
 * Tier 2 — Step B: Partial rebuild from next week.
 *
 * Deletes all non-completed interviews from (currentWeekEnd+1) onwards.
 * Runs the scheduler on the remaining pool starting from that day,
 * using the existing SCHEDULE_START_DATE as the base calendar anchor.
 */
async function partialRebuild(currentWeekEnd, pool, reason) {
  const rebuildFromDay = currentWeekEnd + 1;

  if (pool.length === 0) {
    return { scheduled: 0, unscheduled: 0, newInterviews: [] };
  }

  // Fetch SMPCs and reviewers
  const [spmcs, reviewers] = await Promise.all([
    prisma.oC.findMany({ select: { id: true, name: true, availability: true } }),
    prisma.reviewer.findMany({ select: { id: true, name: true, availability: true } }),
  ]);

  if (spmcs.length < 2) throw new Error('At least 2 SMPCs required');

  // The scheduler uses day numbers relative to its own startDate.
  // We pass the original SCHEDULE_START_DATE so day numbers stay consistent
  // with the rest of the schedule.
  const baseDate = new Date(process.env.SCHEDULE_START_DATE);

  const stats = scheduleInterviews(pool, spmcs, reviewers, baseDate, 999);

  // Keep only interviews scheduled at or after rebuildFromDay
  const newInterviews = stats.scheduledInterviews.filter(
    i => i.dayNumber >= rebuildFromDay
  );

  return {
    scheduled: newInterviews.length,
    unscheduled: stats.unscheduled,
    unscheduledCandidates: stats.unscheduledCandidates,
    newInterviews,
  };
}

/**
 * Main export: smartReschedule
 *
 * Orchestrates the two-tier reschedule for a given interview ID.
 */
export async function smartReschedule(interviewId, reason = 'Candidate unavailable') {
  try {
    // ── Load the interview to reschedule ──────────────────────────────────
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        candidate: { select: { id: true, name: true, rollNumber: true, availability: true, blockedDates: true } },
        oc1: { select: { id: true, name: true } },
        oc2: { select: { id: true, name: true } },
      },
    });

    if (!interview) return { success: false, message: 'Interview not found' };
    if (interview.isCompleted || interview.status === 'COMPLETED') {
      return { success: false, message: 'Cannot reschedule a completed interview' };
    }

    const currentWeek    = Math.ceil(interview.dayNumber / 7);
    const currentWeekEnd = currentWeek * 7;

    console.log(`[Reschedule] ${interview.candidate.name} — Day ${interview.dayNumber} (Week ${currentWeek})`);

    // ── TIER 1: Same-slot swap ─────────────────────────────────────────────
    console.log('[Reschedule] Tier 1: looking for same-slot swap...');
    const swapTarget = await trySwap(interview);

    if (swapTarget) {
      console.log(`[Reschedule] Swap found: ${swapTarget.candidate.name} (Day ${swapTarget.dayNumber})`);

      await prisma.$transaction([
        // Put the swap candidate into the displaced slot
        prisma.interview.update({
          where: { id: interviewId },
          data: {
            candidateId: swapTarget.candidateId,
            lastRescheduledFrom: interview.candidateId,
            lastRescheduledTo:   swapTarget.candidateId,
            lastRescheduledAt:   new Date(),
            rescheduleReason:    reason,
            rescheduleCount:     { increment: 1 },
          },
        }),
        // Put the displaced candidate into the swap target's slot
        prisma.interview.update({
          where: { id: swapTarget.id },
          data: {
            candidateId: interview.candidateId,
            lastRescheduledFrom: swapTarget.candidateId,
            lastRescheduledTo:   interview.candidateId,
            lastRescheduledAt:   new Date(),
            rescheduleReason:    `Swapped with ${interview.candidate.name}: ${reason}`,
            rescheduleCount:     { increment: 1 },
          },
        }),
        prisma.candidate.update({ where: { id: interview.candidateId },  data: { status: 'SCHEDULED' } }),
        prisma.candidate.update({ where: { id: swapTarget.candidateId }, data: { status: 'SCHEDULED' } }),
      ]);

      return {
        success: true,
        method: 'SWAP',
        message: `Swapped ${interview.candidate.name} (Day ${interview.dayNumber}) with ${swapTarget.candidate.name} (Day ${swapTarget.dayNumber})`,
        affectedCandidates: [
          { name: interview.candidate.name,  oldSlot: `Day ${interview.dayNumber}`,  newSlot: `Day ${swapTarget.dayNumber}` },
          { name: swapTarget.candidate.name, oldSlot: `Day ${swapTarget.dayNumber}`, newSlot: `Day ${interview.dayNumber}`  },
        ],
      };
    }

    // ── TIER 2: Backfill + partial rebuild ────────────────────────────────
    console.log('[Reschedule] Tier 1 failed. Tier 2: backfill + partial rebuild...');

    // Build the pool: displaced candidate + all currently PENDING candidates
    const pendingCandidates = await prisma.candidate.findMany({
      where: { status: 'PENDING' },
      select: { id: true, name: true, rollNumber: true, availability: true, blockedDates: true },
    });

    const pool = [
      {
        id:           interview.candidate.id,
        name:         interview.candidate.name,
        rollNumber:   interview.candidate.rollNumber,
        availability: interview.candidate.availability,
        blockedDates: interview.candidate.blockedDates || [],
      },
      ...pendingCandidates.filter(c => c.id !== interview.candidate.id),
    ];

    // Step A: try to backfill the now-vacated slot with someone from the pool
    const backfillCandidate = backfillVacatedSlot(interview, pool);
    // pool is mutated — backfillCandidate (if any) is removed from it

    // Step B: delete future interviews (currentWeekEnd+1 onwards, non-completed)
    const futureInterviewsToDelete = await prisma.interview.findMany({
      where: {
        dayNumber:   { gt: currentWeekEnd },
        isCompleted: false,
      },
      select: { id: true, candidateId: true },
    });

    // Also add the candidates from those future interviews to the pool
    const futureCandidateIds = futureInterviewsToDelete.map(i => i.candidateId);
    if (futureCandidateIds.length > 0) {
      const futureCandidates = await prisma.candidate.findMany({
        where: { id: { in: futureCandidateIds } },
        select: { id: true, name: true, rollNumber: true, availability: true, blockedDates: true },
      });
      // Merge into pool (avoid duplicates)
      const poolIds = new Set(pool.map(c => c.id));
      futureCandidates.forEach(c => { if (!poolIds.has(c.id)) pool.push(c); });
    }

    // Run the rebuild on the pool (future candidates + displaced + PENDING)
    const rebuildResult = await partialRebuild(currentWeekEnd, pool, reason);

    // ── Commit everything in one transaction ──────────────────────────────
    await prisma.$transaction(async (tx) => {
      // 1. Update vacated slot: assign backfill candidate OR mark vacant
      if (backfillCandidate) {
        await tx.interview.update({
          where: { id: interviewId },
          data: {
            candidateId:         backfillCandidate.id,
            lastRescheduledFrom: interview.candidateId,
            lastRescheduledTo:   backfillCandidate.id,
            lastRescheduledAt:   new Date(),
            rescheduleReason:    `Backfilled: ${reason}`,
            rescheduleCount:     { increment: 1 },
            status:              'SCHEDULED',
          },
        });
        await tx.candidate.update({
          where: { id: backfillCandidate.id },
          data: { status: 'SCHEDULED' },
        });
      } else {
        // No backfill found — delete the vacated slot
        await tx.interview.delete({ where: { id: interviewId } });
      }

      // 2. Reset displaced candidate to PENDING (will be re-scheduled in rebuild or stay PENDING)
      await tx.candidate.update({
        where: { id: interview.candidateId },
        data: { status: 'PENDING' },
      });

      // 3. Delete all future non-completed interviews
      if (futureInterviewsToDelete.length > 0) {
        await tx.interview.deleteMany({
          where: {
            id: { in: futureInterviewsToDelete.map(i => i.id) },
          },
        });
        // Reset their candidates to PENDING
        await tx.candidate.updateMany({
          where: { id: { in: futureCandidateIds } },
          data: { status: 'PENDING' },
        });
      }

      // 4. Insert the new rebuild schedule
      if (rebuildResult.newInterviews.length > 0) {
        await tx.interview.createMany({
          data: rebuildResult.newInterviews.map(i => ({
            ...i,
            rescheduleReason: `Partial rebuild: ${reason}`,
            rescheduleCount:  1,
          })),
        });
        const rebuiltIds = rebuildResult.newInterviews.map(i => i.candidateId);
        await tx.candidate.updateMany({
          where: { id: { in: rebuiltIds } },
          data: { status: 'SCHEDULED' },
        });
      }
    });

    console.log(`[Reschedule] Rebuild done. Scheduled: ${rebuildResult.scheduled}, Unscheduled: ${rebuildResult.unscheduled}`);

    return {
      success: true,
      method: 'REBUILD',
      message: backfillCandidate
        ? `Vacated slot backfilled with ${backfillCandidate.name}. Rebuilt Week ${currentWeek + 1}+ with ${rebuildResult.scheduled} interviews.`
        : `Vacated slot could not be backfilled. Rebuilt Week ${currentWeek + 1}+ with ${rebuildResult.scheduled} interviews.`,
      backfilled:          !!backfillCandidate,
      backfilledCandidate: backfillCandidate?.name || null,
      scheduled:           rebuildResult.scheduled,
      unscheduled:         rebuildResult.unscheduled,
    };

  } catch (error) {
    console.error('[Reschedule] Error:', error);
    return { success: false, message: `Reschedule failed: ${error.message}` };
  }
}

/**
 * applyWeekendOverride
 *
 * Applies a weekend time-window override for a specific date WITHOUT touching
 * any other interviews. Only interviews on that date that fall OUTSIDE the
 * new [startSlot, endSlot] window are moved. They are appended after the last
 * currently scheduled day, using the candidate's own availability.
 *
 * @param {string} date       - ISO date "YYYY-MM-DD" (must be Sat or Sun)
 * @param {string} startSlot  - First allowed slot e.g. "11:30AM-12:30PM"
 * @param {string} endSlot    - Last allowed slot  e.g. "5:30PM-7PM"
 * @returns {object}          - { success, moved, couldNotPlace, details }
 */
export async function applyWeekendOverride(date, startSlot, endSlot) {
  const baseDate = new Date(process.env.SCHEDULE_START_DATE);

  // ── 1. Work out which day-number this date corresponds to ────────────────
  const targetDate = new Date(date); // already UTC midnight from "YYYY-MM-DD"
  const msPerDay   = 24 * 60 * 60 * 1000;
  const dayNumber  = Math.round((targetDate - baseDate) / msPerDay) + 1;

  if (dayNumber < 1) {
    return { success: false, message: 'Override date is before the schedule start date' };
  }

  // ── 2. Determine the allowed slot set ───────────────────────────────────
  const startIdx = ALL_SLOTS_ORDERED.indexOf(startSlot);
  const endIdx   = ALL_SLOTS_ORDERED.indexOf(endSlot);
  if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
    return { success: false, message: 'Invalid startSlot / endSlot' };
  }
  const allowedSlots = new Set(ALL_SLOTS_ORDERED.slice(startIdx, endIdx + 1));

  // ── 3. Find all non-completed interviews on that day ────────────────────
  const interviewsOnDay = await prisma.interview.findMany({
    where: { dayNumber, isCompleted: false, status: { not: 'COMPLETED' } },
    include: {
      candidate: {
        select: { id: true, name: true, rollNumber: true, availability: true, blockedDates: true },
      },
      oc1:       { select: { id: true, name: true, availability: true } },
      oc2:       { select: { id: true, name: true, availability: true } },
      reviewer1: { select: { id: true, name: true, availability: true } },
    },
  });

  if (interviewsOnDay.length === 0) {
    return { success: true, moved: 0, couldNotPlace: 0, details: [], message: 'No interviews on that day' };
  }

  // ── 4. Identify trimmed interviews (outside the allowed window) ──────────
  // Convert stored UTC startTime back to IST slot string for comparison
  const JS_TO_DAY_NAME = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

  function utcToSlotString(startTime) {
    const d     = new Date(startTime);
    let h       = d.getUTCHours() + 5;
    let m       = d.getUTCMinutes() + 30;
    if (m >= 60) { m -= 60; h += 1; }
    if (h >= 24)   h -= 24;
    const mer   = h >= 12 ? 'PM' : 'AM';
    const disp  = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    const prefix = m === 0 ? `${disp}${mer}` : `${disp}:${String(m).padStart(2,'0')}${mer}`;
    return ALL_SLOTS_ORDERED.find(s => s.startsWith(prefix)) || null;
  }

  const trimmed = interviewsOnDay.filter(iv => {
    const slot = utcToSlotString(iv.startTime);
    return slot === null || !allowedSlots.has(slot);
  });

  if (trimmed.length === 0) {
    return { success: true, moved: 0, couldNotPlace: 0, details: [], message: 'All interviews already within the new window — nothing to move' };
  }

  // ── 5. Find the last scheduled day across the whole schedule ────────────
  const lastScheduled = await prisma.interview.findFirst({
    orderBy: { dayNumber: 'desc' },
    select: { dayNumber: true },
  });
  let appendFromDay = (lastScheduled?.dayNumber ?? dayNumber) + 1;

  // ── 6. Build existing bookings map so we don't double-book ───────────────
  // Key: "<personId>-day<N>-<slot>"
  const existingInterviews = await prisma.interview.findMany({
    where: { dayNumber: { gte: appendFromDay } },
    select: { oc1Id: true, oc2Id: true, reviewer1Id: true, dayNumber: true, startTime: true },
  });
  const personBookings = new Set();
  existingInterviews.forEach(iv => {
    const slot = utcToSlotString(iv.startTime);
    if (!slot) return;
    [iv.oc1Id, iv.oc2Id, iv.reviewer1Id].filter(Boolean).forEach(pid => {
      personBookings.add(`${pid}-day${iv.dayNumber}-${slot}`);
    });
  });

  // ── 7. For each trimmed interview, find the first free slot ─────────────
  const results     = [];
  const toCreate    = [];
  const toDelete    = [];
  const MAX_LOOK_AHEAD = 999;

  for (const iv of trimmed) {
    const candidate = iv.candidate;
    let placed      = false;

    outer: for (let d = appendFromDay; d < appendFromDay + MAX_LOOK_AHEAD; d++) {
      const calDate  = new Date(baseDate);
      calDate.setUTCDate(calDate.getUTCDate() + (d - 1));
      const dayName  = JS_TO_DAY_NAME[calDate.getUTCDay()];

      // Skip if candidate has this date blocked
      const isoD = calDate.toISOString().slice(0, 10);
      if ((candidate.blockedDates || []).includes(isoD)) continue;

      const candidateSlots = (candidate.availability?.[dayName] || []);

      // Try to pair with the same panel (oc1 + reviewer1 preferred, else oc1 + oc2)
      const panelOptions = iv.reviewer1
        ? [{ spmc: iv.oc1, partner: iv.reviewer1 }, { spmc: iv.oc1, partner: iv.oc2 }]
        : [{ spmc: iv.oc1, partner: iv.oc2 }];

      for (const { spmc, partner } of panelOptions) {
        const spmcSlots    = (spmc.availability?.[dayName]    || []);
        const partnerSlots = (partner.availability?.[dayName] || []);

        const commonSlots = candidateSlots.filter(s =>
          spmcSlots.includes(s) && partnerSlots.includes(s)
        );

        // Sort earliest first
        commonSlots.sort((a, b) => {
          const tA = parseSlotTime(a), tB = parseSlotTime(b);
          return (tA.hours * 60 + tA.minutes) - (tB.hours * 60 + tB.minutes);
        });

        for (const slot of commonSlots) {
          const sKey = `${spmc.id}-day${d}-${slot}`;
          const pKey = `${partner.id}-day${d}-${slot}`;
          if (personBookings.has(sKey) || personBookings.has(pKey)) continue;

          // Book it
          personBookings.add(sKey);
          personBookings.add(pKey);

          const startTime = calculateScheduledTime(d, slot, baseDate);
          const endTime   = new Date(startTime.getTime() + 60 * 60 * 1000);

          toCreate.push({
            candidateId: candidate.id,
            oc1Id:       spmc.id,
            oc2Id:       iv.reviewer1 ? iv.oc2.id : partner.id,
            reviewer1Id: iv.reviewer1 ? partner.id : null,
            reviewer2Id: null,
            startTime,
            endTime,
            dayNumber:   d,
            status:      'SCHEDULED',
            panelId:     `${spmc.name}+${partner.name}`,
            rescheduleReason: `Weekend override applied: ${date}`,
            rescheduleCount:  (iv.rescheduleCount || 0) + 1,
          });

          toDelete.push(iv.id);
          results.push({ candidateName: candidate.name, from: `Day ${dayNumber}`, to: `Day ${d} (${slot})` });
          placed = true;
          break outer;
        }
      }
    }

    if (!placed) {
      results.push({ candidateName: candidate.name, from: `Day ${dayNumber}`, to: null, error: 'No free slot found' });
    }
  }

  // ── 8. Commit: delete trimmed interviews, insert new ones ────────────────
  await prisma.$transaction(async (tx) => {
    if (toDelete.length > 0) {
      await tx.interview.deleteMany({ where: { id: { in: toDelete } } });
    }
    if (toCreate.length > 0) {
      await tx.interview.createMany({ data: toCreate });
    }
  });

  const moved        = toCreate.length;
  const couldNotPlace = trimmed.length - moved;

  console.log(`[WeekendOverride] Applied for ${date}: moved ${moved}, could not place ${couldNotPlace}`);

  return {
    success: true,
    moved,
    couldNotPlace,
    details: results,
    message: `${moved} interview(s) moved outside the window. ${couldNotPlace > 0 ? `${couldNotPlace} could not be placed — check their availability.` : 'All placed successfully.'}`,
  };
}

/**
 * applyInterviewerUnavailability
 *
 * Moves a specific interview to the END of the schedule because one or both
 * interviewers are unavailable. The candidate stays the same; a new panel is
 * found from whoever IS available on the new date. The original interview slot
 * is simply deleted (not filled — no other candidate is displaced).
 *
 * This is intentionally separate from smartReschedule (which is for candidate
 * unavailability and may trigger swaps + partial rebuilds).
 *
 * @param {string} interviewId  - The interview to move
 * @param {string} [reason]     - Human-readable reason for the move
 * @returns {object}            - { success, message, from, to }
 */
export async function applyInterviewerUnavailability(interviewId, reason = 'Interviewer unavailable') {
  try {
    // ── 1. Load the interview ──────────────────────────────────────────────
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        candidate: {
          select: { id: true, name: true, rollNumber: true, availability: true, blockedDates: true },
        },
      },
    });

    if (!interview) return { success: false, message: 'Interview not found' };
    if (interview.isCompleted || interview.status === 'COMPLETED') {
      return { success: false, message: 'Cannot move a completed interview' };
    }

    const candidate = interview.candidate;
    const baseDate  = new Date(process.env.SCHEDULE_START_DATE);

    // ── 2. Find the last scheduled day so we try to fit into it first ────
    const lastScheduled = await prisma.interview.findFirst({
      where: { id: { not: interviewId } }, // exclude the one we're moving
      orderBy: { dayNumber: 'desc' },
      select: { dayNumber: true },
    });
    // Start searching from whichever is greater: the last scheduled day, or the
    // interview's own day. This handles two cases:
    //   a) Interview is NOT the last: search starts from the actual last day,
    //      so any free slots on that day are used before extending the schedule.
    //   b) Interview IS the last: lastScheduled returns the second-highest day
    //      which is earlier — taking the max prevents searching backwards into
    //      the middle of the schedule.
    // If all slots on that day are taken the loop naturally advances to day + 1.
    const appendFromDay = Math.max(
      lastScheduled?.dayNumber ?? interview.dayNumber,
      interview.dayNumber
    );

    // ── 3. Fetch all interviewers (OCs + reviewers) + weekend overrides ──
    const [allOCs, allReviewers, weekendOverrideRows] = await Promise.all([
      prisma.oC.findMany({ select: { id: true, name: true, availability: true } }),
      prisma.reviewer.findMany({ select: { id: true, name: true, availability: true } }),
      prisma.weekendOverride.findMany({ select: { date: true, startSlot: true, endSlot: true } }),
    ]);

    // Build override map keyed by ISO date string — same shape as scheduler.js
    const weekendOverrides = Object.fromEntries(
      weekendOverrideRows.map(r => [r.date, { startSlot: r.startSlot, endSlot: r.endSlot }])
    );

    // Default weekend window (mirrors scheduler.js constants)
    const DEFAULT_WEEKEND_START = '11:30AM-12:30PM';
    const DEFAULT_WEEKEND_END   = '11:30PM-12:30AM';

    /**
     * Returns a Set of allowed slot strings for a given calendar date,
     * or null (no restriction) for weekdays. Mirrors scheduler.js getAllowedSlots().
     */
    function getAllowedSlotsLocal(calDate) {
      const dow = calDate.getUTCDay(); // 0=Sun, 6=Sat
      if (dow !== 0 && dow !== 6) return null; // weekday — unrestricted
      const isoDate = calDate.toISOString().slice(0, 10);
      const ov = weekendOverrides[isoDate];
      const startSlot = ov?.startSlot ?? DEFAULT_WEEKEND_START;
      const endSlot   = ov?.endSlot   ?? DEFAULT_WEEKEND_END;
      const si = ALL_SLOTS_ORDERED.indexOf(startSlot);
      const ei = ALL_SLOTS_ORDERED.indexOf(endSlot);
      if (si === -1 || ei === -1) return null;
      return new Set(ALL_SLOTS_ORDERED.slice(si, ei + 1));
    }

    if (allOCs.length < 2) {
      return { success: false, message: 'At least 2 OCs required to form a panel' };
    }

    // ── 4. Build existing bookings map (days >= appendFromDay) ────────────
    const JS_TO_DAY_NAME_LOCAL = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

    function utcToSlotStr(startTime) {
      const d   = new Date(startTime);
      let h     = d.getUTCHours() + 5;
      let m     = d.getUTCMinutes() + 30;
      if (m >= 60) { m -= 60; h += 1; }
      if (h >= 24)   h -= 24;
      const mer  = h >= 12 ? 'PM' : 'AM';
      const disp = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      const pfx  = m === 0 ? `${disp}${mer}` : `${disp}:${String(m).padStart(2,'0')}${mer}`;
      return ALL_SLOTS_ORDERED.find(s => s.startsWith(pfx)) || null;
    }

    const existingFuture = await prisma.interview.findMany({
      where: { dayNumber: { gte: appendFromDay }, id: { not: interviewId } },
      select: { oc1Id: true, oc2Id: true, reviewer1Id: true, dayNumber: true, startTime: true },
    });
    const personBookings = new Set();
    // slotOccupancy[`day<N>-<slot>`] = number of interviews already in that slot
    // Used to prefer filling partially-occupied slots (concurrent panels) before opening new ones.
    const slotOccupancy = {};
    existingFuture.forEach(iv => {
      const slot = utcToSlotStr(iv.startTime);
      if (!slot) return;
      [iv.oc1Id, iv.oc2Id, iv.reviewer1Id].filter(Boolean).forEach(pid => {
        personBookings.add(`${pid}-day${iv.dayNumber}-${slot}`);
      });
      const key = `day${iv.dayNumber}-${slot}`;
      slotOccupancy[key] = (slotOccupancy[key] || 0) + 1;
    });

    // ── 5. Build candidate panel-pair combinations ────────────────────────
    // Try OC+Reviewer pairs first, then OC+OC pairs (same logic as scheduler.js)
    const panelCombinations = [];
    for (const spmc of allOCs) {
      for (const reviewer of allReviewers) {
        panelCombinations.push({ spmc, partner: reviewer, type: 'OC_REVIEWER' });
      }
    }
    for (let i = 0; i < allOCs.length; i++) {
      for (let j = i + 1; j < allOCs.length; j++) {
        panelCombinations.push({ spmc: allOCs[i], partner: allOCs[j], type: 'OC_OC' });
      }
    }

    // ── 6. Find first free slot for the candidate after appendFromDay ─────
    const MAX_LOOK_AHEAD = 999;
    let newSlot = null;

    outer: for (let d = appendFromDay; d < appendFromDay + MAX_LOOK_AHEAD; d++) {
      const calDate = new Date(baseDate);
      calDate.setUTCDate(calDate.getUTCDate() + (d - 1));
      const dayName = JS_TO_DAY_NAME_LOCAL[calDate.getUTCDay()];

      // Skip if candidate has this date blocked
      const isoD = calDate.toISOString().slice(0, 10);
      if ((candidate.blockedDates || []).includes(isoD)) continue;

      // Enforce weekend window (default or per-date override)
      const allowedSlots = getAllowedSlotsLocal(calDate); // null = weekday, no restriction

      const candidateSlots = (candidate.availability?.[dayName] || [])
        .filter(s => !allowedSlots || allowedSlots.has(s));
      if (candidateSlots.length === 0) continue;

      for (const { spmc, partner } of panelCombinations) {
        const spmcSlots    = (spmc.availability?.[dayName]    || [])
          .filter(s => !allowedSlots || allowedSlots.has(s));
        const partnerSlots = (partner.availability?.[dayName] || [])
          .filter(s => !allowedSlots || allowedSlots.has(s));

        const commonSlots = candidateSlots.filter(s =>
          spmcSlots.includes(s) && partnerSlots.includes(s)
        );

        commonSlots.sort((a, b) => {
          // Primary: prefer slots that already have a concurrent interview on this day
          // (pack existing slots before opening new ones — maximises concurrency, minimises total days)
          const occA = slotOccupancy[`day${d}-${a}`] || 0;
          const occB = slotOccupancy[`day${d}-${b}`] || 0;
          if (occB !== occA) return occB - occA; // higher occupancy first
          // Secondary: earliest slot
          const tA = parseSlotTime(a), tB = parseSlotTime(b);
          return (tA.hours * 60 + tA.minutes) - (tB.hours * 60 + tB.minutes);
        });

        for (const slot of commonSlots) {
          const sKey = `${spmc.id}-day${d}-${slot}`;
          const pKey = `${partner.id}-day${d}-${slot}`;
          if (personBookings.has(sKey) || personBookings.has(pKey)) continue;

          const startTime = calculateScheduledTime(d, slot, baseDate);
          const endTime   = new Date(startTime.getTime() + 60 * 60 * 1000);

          newSlot = {
            dayNumber:   d,
            slot,
            startTime,
            endTime,
            spmc,
            partner,
            type:        panelCombinations.find(p => p.spmc === spmc && p.partner === partner)?.type,
          };

          // Mark as booked to prevent double-booking within the same search
          personBookings.add(sKey);
          personBookings.add(pKey);

          break outer;
        }
      }
    }

    if (!newSlot) {
      return {
        success: false,
        message: `Could not find a free slot for ${candidate.name} after Day ${appendFromDay - 1}. Check their availability.`,
      };
    }

    // ── 7. Commit: delete old interview, create new one ───────────────────
    const isOCOC = newSlot.type === 'OC_OC';
    // For OC+Reviewer panels, oc2Id must still be a real OC (schema: String, not optional).
    // Mirror scheduler.js: oc2 = "the other SPMC" (any OC that isn't oc1).
    const otherOC = isOCOC
      ? newSlot.partner                                              // partner IS the second OC
      : allOCs.find(o => o.id !== newSlot.spmc.id) || newSlot.spmc; // fallback: first available other OC

    await prisma.$transaction(async (tx) => {
      await tx.interview.delete({ where: { id: interviewId } });

      await tx.interview.create({
        data: {
          candidateId:      candidate.id,
          oc1Id:            newSlot.spmc.id,
          oc2Id:            otherOC.id,
          reviewer1Id:      isOCOC ? null : newSlot.partner.id,
          reviewer2Id:      null,
          startTime:        newSlot.startTime,
          endTime:          newSlot.endTime,
          dayNumber:        newSlot.dayNumber,
          status:           'SCHEDULED',
          panelId:          `${newSlot.spmc.name}+${newSlot.partner.name}`,
          rescheduleReason: reason,
          rescheduleCount:  (interview.rescheduleCount || 0) + 1,
          lastRescheduledAt: new Date(),
        },
      });

      await tx.candidate.update({
        where: { id: candidate.id },
        data:  { status: 'SCHEDULED' },
      });
    });

    console.log(`[InterviewerUnavailable] ${candidate.name}: Day ${interview.dayNumber} → Day ${newSlot.dayNumber} (${newSlot.slot}) with ${newSlot.spmc.name}+${newSlot.partner.name}`);

    return {
      success: true,
      message: `${candidate.name}'s interview moved from Day ${interview.dayNumber} to Day ${newSlot.dayNumber} (${newSlot.slot}) with panel ${newSlot.spmc.name}+${newSlot.partner.name}`,
      from:    `Day ${interview.dayNumber}`,
      to:      `Day ${newSlot.dayNumber} (${newSlot.slot})`,
      panel:   `${newSlot.spmc.name}+${newSlot.partner.name}`,
    };

  } catch (error) {
    console.error('[InterviewerUnavailable] Error:', error);
    return { success: false, message: `Failed: ${error.message}` };
  }
}

export default smartReschedule;
