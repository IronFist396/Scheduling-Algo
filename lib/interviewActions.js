import { prisma } from './prisma';
import { startOfDay, endOfDay, format } from 'date-fns';
import { smartReschedule } from './rescheduleLogic';

/**
 * Function A: Get today's interviews
 * Fetches all interviews scheduled for today, sorted by start time
 */
export async function getTodayInterviews() {
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

  const interviews = await prisma.interview.findMany({
    where: {
      startTime: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
    include: {
      candidate: {
        select: {
          id: true,
          name: true,
          email: true,
          rollNumber: true,
          department: true,
          year: true,
          status: true,
        },
      },
      oc1: {
        select: {
          id: true,
          name: true,
        },
      },
      oc2: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      startTime: 'asc',
    },
  });

  return interviews;
}

/**
 * Function B: Mark interview as complete
 * Updates both Interview and Candidate status to COMPLETED
 * Sets completed flag to prevent rescheduling
 */
export async function markInterviewComplete(interviewId) {
  try {
    // Get the interview to find the candidate
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      select: { candidateId: true },
    });

    if (!interview) {
      return { success: false, message: 'Interview not found' };
    }

    // Update both interview and candidate in a transaction
    await prisma.$transaction([
      prisma.interview.update({
        where: { id: interviewId },
        data: { 
          status: 'COMPLETED',
          isCompleted: true 
        },
      }),
      prisma.candidate.update({
        where: { id: interview.candidateId },
        data: { status: 'COMPLETED' },
      }),
    ]);

    return { success: true, message: 'Interview marked as complete' };
  } catch (error) {
    console.error('Error marking interview complete:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Function C: Reschedule an interview
 * Uses smart reschedule logic with swap and rebuild capabilities
 */
export async function rescheduleInterview(interviewId, reason = 'Candidate unavailable') {
  try {
    const result = await smartReschedule(interviewId, reason);
    return result;
  } catch (error) {
    console.error('Error rescheduling interview:', error);
    return { success: false, message: error.message };
  }
}
