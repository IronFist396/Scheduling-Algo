// Reschedule Logic - Smart interview rescheduling with swap and rebuild capabilities

import { prisma } from './prisma';
import { scheduleInterviews, calculateAvailabilityScore } from './scheduler';

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

/**
 * Check if rescheduling would create a loop
 * Prevents A→B→A scenarios
 */
async function checkForLoop(interviewId, candidateId) {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    select: {
      lastRescheduledFrom: true,
      lastRescheduledAt: true,
    },
  });

  if (!interview) return false;

  // If this slot was filled by moving this exact candidate away < 24 hours ago
  if (
    interview.lastRescheduledFrom === candidateId &&
    interview.lastRescheduledAt &&
    Date.now() - new Date(interview.lastRescheduledAt).getTime() < 24 * 60 * 60 * 1000
  ) {
    return true; // Loop detected!
  }

  return false;
}

/**
 * Get the current week number based on a day number
 */
function getCurrentWeek(dayNumber) {
  return Math.ceil(dayNumber / 5);
}

/**
 * Tier 1: Try to find an exact swap candidate
 * Find someone in future weeks scheduled at the same day-of-week and time slot
 */
async function trySwap(interview, currentWeekEnd) {
  const dayOfWeek = DAYS_OF_WEEK[(interview.dayNumber - 1) % 5];
  const slotTime = interview.startTime;

  // Find candidates scheduled in future weeks at the same weekday/time
  const swapCandidates = await prisma.interview.findMany({
    where: {
      dayNumber: { gt: currentWeekEnd }, // Only future weeks
      status: 'SCHEDULED',
      isCompleted: false,
      // Same day of week (every 5 days cycle)
      dayNumber: {
        gte: currentWeekEnd + 1,
      },
    },
    include: {
      candidate: {
        select: {
          id: true,
          name: true,
          availability: true,
        },
      },
    },
  });

  // Filter to find candidates with matching weekday and time
  for (const swapInterview of swapCandidates) {
    const swapDayOfWeek = DAYS_OF_WEEK[(swapInterview.dayNumber - 1) % 5];
    
    // Check if same weekday
    if (swapDayOfWeek !== dayOfWeek) continue;

    // Check if same time slot (compare hours and minutes)
    const originalTime = new Date(interview.startTime);
    const swapTime = new Date(swapInterview.startTime);
    
    if (
      originalTime.getHours() === swapTime.getHours() &&
      originalTime.getMinutes() === swapTime.getMinutes()
    ) {
      // Found a swap candidate!
      return swapInterview;
    }
  }

  return null; // No swap found
}

/**
 * Tier 2: Rebuild all future weeks optimally
 * Take all future interviews, delete them, and reschedule with the algorithm
 */
async function rebuildFutureWeeks(currentWeekEnd, originalCandidateId, reason) {
  // Get all future interviews (not completed, not in current/past weeks)
  const futureInterviews = await prisma.interview.findMany({
    where: {
      dayNumber: { gt: currentWeekEnd },
      isCompleted: false,
    },
    include: {
      candidate: {
        select: {
          id: true,
          name: true,
          rollNumber: true,
          availability: true,
        },
      },
    },
  });

  // Extract all candidates from future interviews + the unavailable candidate
  const candidatesToReschedule = futureInterviews.map((i) => i.candidate);

  // Add the original candidate who became unavailable
  const originalCandidate = await prisma.candidate.findUnique({
    where: { id: originalCandidateId },
    select: {
      id: true,
      name: true,
      rollNumber: true,
      availability: true,
    },
  });

  if (originalCandidate) {
    candidatesToReschedule.push(originalCandidate);
  }

  // Get OCs
  const ocs = await prisma.oC.findMany({
    select: {
      id: true,
      name: true,
      availability: true,
    },
  });

  if (ocs.length < 2) {
    throw new Error('At least 2 OCs required for rescheduling');
  }

  // Calculate start date based on current week end
  // We want to start scheduling from the next week
  const startDayNumber = currentWeekEnd + 1;
  
  // Use a fixed base date for scheduling calculations
  const baseDate = new Date('2025-03-01');
  
  // Run the scheduler for future candidates only
  console.log(`🔄 Rescheduling ${candidatesToReschedule.length} candidates from day ${startDayNumber}...`);
  
  const stats = scheduleInterviews(
    candidatesToReschedule,
    ocs,
    baseDate,
    999 // Unlimited days
  );

  // Filter scheduled interviews to only include those from startDayNumber onwards
  const newSchedule = stats.scheduledInterviews.filter(
    (interview) => interview.dayNumber >= startDayNumber
  );

  return {
    newSchedule,
    affectedCount: candidatesToReschedule.length,
    stats,
  };
}

/**
 * Main reschedule function
 * Orchestrates the entire reschedule process
 */
export async function smartReschedule(interviewId, reason = 'Candidate unavailable') {
  try {
    // Get the interview to reschedule
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            availability: true,
          },
        },
        oc1: { select: { id: true, name: true } },
        oc2: { select: { id: true, name: true } },
      },
    });

    if (!interview) {
      return { success: false, message: 'Interview not found' };
    }

    // Protection: Don't reschedule completed interviews
    if (interview.isCompleted || interview.status === 'COMPLETED') {
      return { success: false, message: 'Cannot reschedule a completed interview' };
    }

    // Protection: Check for loops
    const isLoop = await checkForLoop(interviewId, interview.candidateId);
    if (isLoop) {
      return {
        success: false,
        message: 'Loop detected! This candidate was just moved from this slot. Please wait 24 hours or choose manual intervention.',
      };
    }

    // Determine current week boundary
    const currentWeek = getCurrentWeek(interview.dayNumber);
    const currentWeekEnd = currentWeek * 5;

    console.log(`\n📋 Rescheduling interview for ${interview.candidate.name}`);
    console.log(`   Original slot: Day ${interview.dayNumber}, Week ${currentWeek}`);
    console.log(`   Current week ends at Day ${currentWeekEnd}`);

    // TIER 1: Try exact swap
    console.log('\n🔄 Attempting Tier 1: Exact Swap...');
    const swapCandidate = await trySwap(interview, currentWeekEnd);

    if (swapCandidate) {
      console.log(`✅ Swap found: ${swapCandidate.candidate.name} (Day ${swapCandidate.dayNumber})`);

      // Perform the swap in a transaction
      await prisma.$transaction([
        // Update original interview - swap candidate
        prisma.interview.update({
          where: { id: interviewId },
          data: {
            candidateId: swapCandidate.candidateId,
            lastRescheduledFrom: interview.candidateId,
            lastRescheduledTo: swapCandidate.candidateId,
            lastRescheduledAt: new Date(),
            rescheduleReason: reason,
            rescheduleCount: { increment: 1 },
          },
        }),
        // Update swap interview - original candidate
        prisma.interview.update({
          where: { id: swapCandidate.id },
          data: {
            candidateId: interview.candidateId,
            lastRescheduledFrom: swapCandidate.candidateId,
            lastRescheduledTo: interview.candidateId,
            lastRescheduledAt: new Date(),
            rescheduleReason: `Swapped with ${interview.candidate.name} due to: ${reason}`,
            rescheduleCount: { increment: 1 },
          },
        }),
        // Update candidate statuses
        prisma.candidate.update({
          where: { id: interview.candidateId },
          data: { status: 'SCHEDULED' },
        }),
        prisma.candidate.update({
          where: { id: swapCandidate.candidateId },
          data: { status: 'SCHEDULED' },
        }),
      ]);

      return {
        success: true,
        method: 'SWAP',
        message: `Successfully swapped ${interview.candidate.name} with ${swapCandidate.candidate.name}`,
        affectedCandidates: [
          {
            name: interview.candidate.name,
            oldSlot: `Day ${interview.dayNumber}`,
            newSlot: `Day ${swapCandidate.dayNumber}`,
          },
          {
            name: swapCandidate.candidate.name,
            oldSlot: `Day ${swapCandidate.dayNumber}`,
            newSlot: `Day ${interview.dayNumber}`,
          },
        ],
      };
    }

    // TIER 2: Rebuild future weeks
    console.log('\n🔨 Tier 1 failed. Attempting Tier 2: Rebuild Future Weeks...');

    const { newSchedule, affectedCount, stats } = await rebuildFutureWeeks(
      currentWeekEnd,
      interview.candidateId,
      reason
    );

    // Delete all future interviews and the current one
    await prisma.$transaction([
      // Delete original interview that needs rescheduling
      prisma.interview.delete({
        where: { id: interviewId },
      }),
      // Delete all future interviews
      prisma.interview.deleteMany({
        where: {
          dayNumber: { gt: currentWeekEnd },
          isCompleted: false,
        },
      }),
      // Reset candidate statuses
      prisma.candidate.updateMany({
        where: {
          interviews: {
            some: {
              dayNumber: { gt: currentWeekEnd },
              isCompleted: false,
            },
          },
        },
        data: { status: 'PENDING' },
      }),
    ]);

    // Insert new schedule
    if (newSchedule.length > 0) {
      await prisma.interview.createMany({
        data: newSchedule.map((interview) => ({
          ...interview,
          rescheduleReason: `Rebuilt schedule due to: ${reason}`,
          rescheduleCount: 1,
        })),
      });

      // Update candidate statuses
      const candidateIds = newSchedule.map((i) => i.candidateId);
      await prisma.candidate.updateMany({
        where: { id: { in: candidateIds } },
        data: { status: 'SCHEDULED' },
      });
    }

    console.log(`✅ Rebuild complete: ${newSchedule.length} interviews rescheduled`);

    return {
      success: true,
      method: 'REBUILD',
      message: `Successfully rebuilt future schedule. ${newSchedule.length} interviews rescheduled optimally.`,
      affectedCount,
      scheduled: newSchedule.length,
      unscheduled: stats.unscheduled,
    };
  } catch (error) {
    console.error('Error in smartReschedule:', error);
    return {
      success: false,
      message: `Reschedule failed: ${error.message}`,
    };
  }
}

export default smartReschedule;
