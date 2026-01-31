import { prisma } from '../../lib/prisma';
import { scheduleInterviews } from '../../lib/scheduler';

export default async function handler(req, res) {
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
      },
    });

    const ocs = await prisma.oC.findMany({
      select: {
        id: true,
        name: true,
        availability: true,
      },
    });

    if (ocs.length < 2) {
      return res.status(400).json({ error: 'At least 2 OCs are required' });
    }

    // Run scheduling algorithm
    const stats = scheduleInterviews(
      candidates,
      ocs,
      startDate ? new Date(startDate) : new Date('2026-01-12'), // January 12, 2026 (Monday)
      maxDays || 999 // Unlimited by default
    );

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
      unscheduledCandidates: stats.unscheduledCandidates.map(item => ({
        name: item.candidate.name,
        rollNumber: item.candidate.rollNumber,
        reason: item.reason,
        availabilityScore: item.availabilityScore,
      })),
    });
  } catch (error) {
    console.error('Scheduling error:', error);
    return res.status(500).json({ error: error.message });
  }
}
