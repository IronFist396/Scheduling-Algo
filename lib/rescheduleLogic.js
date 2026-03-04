// Reschedule Logic
//
// Two-tier strategy:
//   Tier 1 — Same-slot swap with a future-week candidate
//             (same weekday + same time = availability guaranteed, zero disruption)
//   Tier 2 — Backfill vacated slot + partial rebuild from next week
//             Current week untouched. Vacated slot gets one backfill attempt
//             before the scheduler rebuilds Week N+1 onwards.

import { prisma } from './prisma';
import { scheduleInterviews } from './scheduler';
import { parseSlotTime } from './scheduler';

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

export default smartReschedule;
