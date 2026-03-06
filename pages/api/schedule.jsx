import { prisma } from '../../lib/prisma';
import { scheduleInterviews } from '../../lib/scheduler';
import { requireAuth } from '../../lib/auth';

export default async function handler(req, res) {
  // Check authentication
  const session = await requireAuth(req, res);
  if (!session) return; // requireAuth already sent error response

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { startDate, maxDays } = req.body;

    // Fetch all candidates and OCs
    const candidates = await prisma.candidate.findMany({
      select: {
        id: true,
        name: true,
        rollNumber: true,
        availability: true,
        blockedDates: true,
      },
    });

    const ocs = await prisma.oC.findMany({
      select: {
        id: true,
        name: true,
        availability: true,
      },
    });

    const reviewers = await prisma.reviewer.findMany({
      select: {
        id: true,
        name: true,
        availability: true,
      },
    });

    if (ocs.length < 2) {
      return res.status(400).json({ error: 'At least 2 OCs are required' });
    }

    // Fetch weekend overrides and build a lookup map { "YYYY-MM-DD": { startSlot, endSlot } }
    const overrideRows = await prisma.weekendOverride.findMany();
    const weekendOverrides = Object.fromEntries(
      overrideRows.map(r => [r.date, { startSlot: r.startSlot, endSlot: r.endSlot }])
    );

    // Run scheduling algorithm
    const stats = scheduleInterviews(
      candidates,
      ocs,
      reviewers,
      startDate ? new Date(startDate) : new Date(process.env.SCHEDULE_START_DATE),
      maxDays || 999,
      weekendOverrides
    );

    // Constraint violation check — verify no scheduled interview falls on a blocked date
    const scheduleStart = startDate ? new Date(startDate) : new Date(process.env.SCHEDULE_START_DATE);
    const constraintViolations = stats.scheduledInterviews
      .filter(interview => {
        const candidate = candidates.find(c => c.id === interview.candidateId);
        if (!candidate?.blockedDates?.length) return false;
        const d = new Date(scheduleStart);
        d.setUTCDate(d.getUTCDate() + (interview.dayNumber - 1));
        return candidate.blockedDates.includes(d.toISOString().slice(0, 10));
      })
      .map(interview => {
        const candidate = candidates.find(c => c.id === interview.candidateId);
        const d = new Date(scheduleStart);
        d.setUTCDate(d.getUTCDate() + (interview.dayNumber - 1));
        return {
          candidateName: candidate.name,
          rollNumber: candidate.rollNumber,
          scheduledDate: d.toISOString().slice(0, 10),
          slot: interview.slot,
          blockedDates: candidate.blockedDates,
        };
      });

    if (constraintViolations.length > 0) {
      console.error(`[Schedule] CONSTRAINT VIOLATIONS: ${constraintViolations.length} interview(s) placed on blocked dates!`, constraintViolations);
    }

    // Delete existing interviews and reset all candidate statuses
    await prisma.$transaction([
      prisma.interview.deleteMany({}),
      prisma.candidate.updateMany({
        data: { status: 'PENDING' }
      })
    ]);

    // Insert scheduled interviews and update candidate statuses
    if (stats.scheduledInterviews.length > 0) {
      // Create interviews
      await prisma.interview.createMany({
        data: stats.scheduledInterviews,
      });

      // Update scheduled candidates' status
      const scheduledCandidateIds = stats.scheduledInterviews.map(i => i.candidateId);
      await prisma.candidate.updateMany({
        where: {
          id: { in: scheduledCandidateIds }
        },
        data: { status: 'SCHEDULED' }
      });
    }

    return res.status(200).json({
      success: true,
      stats: {
        totalCandidates: stats.totalCandidates,
        scheduled: stats.scheduled,
        unscheduled: stats.unscheduled,
        daysUsed: stats.daysUsed,
        weeksUsed: stats.weeksUsed,
      },
      constraintViolations,
      unscheduledCandidates: stats.unscheduledCandidates.map(item => ({
        name: item.candidate.name,
        rollNumber: item.candidate.rollNumber,
        reason: item.reason,
        availabilityScore: item.availabilityScore,
        blockedDates: item.candidate.blockedDates || [],
      })),
    });
  } catch (error) {
    console.error('Scheduling error:', error);
    return res.status(500).json({ error: error.message });
  }
}
