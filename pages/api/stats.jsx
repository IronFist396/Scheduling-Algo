import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stats = await prisma.$transaction([
      prisma.candidate.count(),
      prisma.interview.count(),
      prisma.interview.count({ where: { status: 'SCHEDULED' } }),
      prisma.interview.count({ where: { status: 'COMPLETED' } }),
      prisma.oC.findMany({
        select: {
          id: true,
          name: true,
          email: true,
        },
      }),
      // Get the maximum day number to calculate weeks used
      prisma.interview.findFirst({
        orderBy: { dayNumber: 'desc' },
        select: { dayNumber: true },
      }),
    ]);

    const [totalCandidates, totalInterviews, scheduled, completed, ocs, maxDayInterview] = stats;
    
    const daysUsed = maxDayInterview?.dayNumber || 0;
    const weeksUsed = Math.ceil(daysUsed / 5);

    return res.status(200).json({
      totalCandidates,
      totalInterviews,
      scheduled,
      completed,
      unscheduled: totalCandidates - totalInterviews,
      ocs,
      daysUsed,
      weeksUsed,
      scheduleStartDate: process.env.SCHEDULE_START_DATE,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({ error: error.message });
  }
}
